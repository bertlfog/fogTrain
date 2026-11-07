import { SCHEMA_VERSION } from "../../../model";
import { DataError } from "../../errors";

/** Export-Dokument als rohes JSON (noch nicht gegen `ExportFile` geprüft). */
export type RawExport = Record<string, unknown>;

/**
 * Reine Funktion, die ein Export-Dokument von Version N auf N+1 hebt
 * (SPEC Abschnitt 3: `migrations/vN-to-vN+1.ts`). Sie verändert ihre Eingabe
 * nicht und setzt `schemaVersion` nicht selbst; das übernimmt der Rahmen.
 */
export type Migration = (file: RawExport) => RawExport;

export type MigrationRegistry = Readonly<Record<number, Migration>>;

/**
 * Registry: Schlüssel ist die Ausgangsversion N, Wert die Migration N → N+1.
 * Bei Version 1 gibt es noch keine; der Rahmen steht für spätere Versionen.
 */
export const migrations: MigrationRegistry = {};

function asRawExport(raw: unknown): RawExport {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DataError("invalid", "Export-Datei ist kein JSON-Objekt");
  }
  return raw as RawExport;
}

function readVersion(file: RawExport): number {
  const version = file["schemaVersion"];
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new DataError(
      "invalid",
      "Export-Datei enthält keine gültige Schema-Version",
    );
  }
  return version;
}

/**
 * Hebt ein Export-Dokument Schritt für Schritt auf `target`.
 * Neuere Versionen als `target` werden abgelehnt (DataError `version`).
 */
export function migrateToVersion(
  raw: unknown,
  target: number,
  registry: MigrationRegistry,
): RawExport {
  let file = asRawExport(raw);
  let version = readVersion(file);

  if (version > target) {
    throw new DataError(
      "version",
      `Export-Datei hat Schema-Version ${version}, die App kennt nur ${target}`,
    );
  }

  while (version < target) {
    const migrate = registry[version];
    if (!migrate) {
      throw new DataError(
        "version",
        `Keine Migration von Schema-Version ${version} auf ${version + 1} vorhanden`,
      );
    }
    file = { ...migrate(file), schemaVersion: version + 1 };
    version += 1;
  }
  return file;
}

/** Hebt ein Export-Dokument auf die aktuelle `SCHEMA_VERSION`. */
export function migrateToLatest(raw: unknown): RawExport {
  return migrateToVersion(raw, SCHEMA_VERSION, migrations);
}
