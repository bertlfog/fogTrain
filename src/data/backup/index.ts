import { SCHEMA_VERSION } from "../../model";
import type { ExportFile } from "../../model";
import type { Repositories } from "../repositories";
import { bytesToBase64 } from "./base64";

export { base64ToBytes, bytesToBase64 } from "./base64";
export { migrateToLatest, migrateToVersion, migrations } from "./migrations";

/**
 * Datensicherung (SPEC Abschnitt 4). Ein Import ist vorerst nicht Teil des
 * MVP; das Format bleibt über `schemaVersion` und `migrations/` importfähig.
 */
export interface BackupService {
  exportAll(): Promise<ExportFile>;
}

export interface BackupServiceOptions {
  /** Uhr für `exportedAt`; in Tests ersetzbar. */
  now?: () => Date;
}

const byId = <T extends { id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const present = <T>(value: T | undefined): value is T => value !== undefined;

/**
 * Dateiname der Sicherung nach SPEC F-E: `trainingapp-backup-YYYY-MM-DD.json`.
 * Das Datum ist das lokale Kalenderdatum des Nutzers.
 */
export function backupFileName(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `trainingapp-backup-${year}-${month}-${day}.json`;
}

/**
 * Baut den Export aus den Repositories und funktioniert damit mit jeder
 * Implementierung (IndexedDB, In-Memory).
 *
 * Archivierte Übungen und Pläne gehören dazu, weil Verlauf und Pläne auf sie
 * verweisen. Alle Listen sind nach `id` sortiert, damit gleiche Daten immer
 * dieselbe Datei ergeben. Die Daten werden in mehreren Lesevorgängen geholt,
 * nicht in einer gemeinsamen Transaktion; während eines Exports sollte
 * deshalb nichts gespeichert werden (Einzelnutzer, Export aus den
 * Einstellungen).
 */
export function createBackupService(
  repositories: Repositories,
  options: BackupServiceOptions = {},
): BackupService {
  const now = options.now ?? (() => new Date());

  return {
    async exportAll() {
      const exercises = await repositories.exercises.list({
        includeArchived: true,
      });
      const plans = await repositories.plans.list({ includeArchived: true });
      const workouts = await repositories.workouts.list();

      // Wird ein Datensatz zwischen Liste und Detailabruf gelöscht, fehlt er
      // im Export (`undefined`) und wird übersprungen.
      const [imageLists, planDetails, workoutDetails] = await Promise.all([
        Promise.all(
          exercises.map((e) => repositories.exercises.listImages(e.id)),
        ),
        Promise.all(plans.map((p) => repositories.plans.get(p.id))),
        Promise.all(workouts.map((w) => repositories.workouts.get(w.id))),
      ]);

      const exerciseImages = await Promise.all(
        imageLists.flat().map(async ({ data, ...meta }) => ({
          ...meta,
          dataBase64: bytesToBase64(new Uint8Array(await data.arrayBuffer())),
        })),
      );

      const presentPlans = planDetails.filter(present);
      const presentWorkouts = workoutDetails.filter(present);

      return {
        app: "TrainingApp",
        schemaVersion: SCHEMA_VERSION,
        exportedAt: now().toISOString(),
        data: {
          exercises: [...exercises].sort(byId),
          exerciseImages: exerciseImages.sort(byId),
          plans: presentPlans.map((d) => d.plan).sort(byId),
          planItems: presentPlans.flatMap((d) => d.items).sort(byId),
          workouts: presentWorkouts.map((d) => d.workout).sort(byId),
          loggedSets: presentWorkouts.flatMap((d) => d.sets).sort(byId),
        },
      };
    },
  };
}
