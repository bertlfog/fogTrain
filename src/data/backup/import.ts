import { SCHEMA_VERSION } from "../../model";
import type {
  Exercise,
  ExerciseImage,
  ExportFile,
  LoggedSet,
  Plan,
  PlanItem,
  Workout,
} from "../../model";
import { DataError } from "../errors";
import type { Repositories, RepositoryData } from "../repositories";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { migrateToLatest } from "./migrations";

export interface ImportSummary {
  exercises: number;
  exerciseImages: number;
  plans: number;
  workouts: number;
}

export interface ImportValidationResult {
  file: ExportFile;
  summary: ImportSummary;
}

interface ValidatedBackup extends ImportValidationResult {
  repositoryData: RepositoryData;
}

type JsonRecord = Record<string, unknown>;

const invalid = (message: string): never => {
  throw new DataError("invalid", `Backup ungültig: ${message}`);
};

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid(`${path} muss ein Objekt sein.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return invalid(`${path} muss eine Liste sein.`);
  return value;
}

function string(
  value: unknown,
  path: string,
  options: { nonempty?: boolean; maxLength?: number } = {},
): string {
  if (
    typeof value !== "string" ||
    (options.nonempty && value.trim().length === 0) ||
    (options.maxLength !== undefined && value.length > options.maxLength)
  ) {
    return invalid(`${path} ist ungültig.`);
  }
  return value;
}

function isoDate(value: unknown, path: string): string {
  const date = string(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString() !== date
  ) {
    return invalid(`${path} muss ein gültiger UTC-Zeitstempel sein.`);
  }
  return date;
}

function integer(value: unknown, path: string, minimum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    return invalid(`${path} muss eine ganze Zahl ab ${minimum} sein.`);
  }
  return value;
}

function finiteNumber(value: unknown, path: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    return invalid(`${path} muss mindestens ${minimum} betragen.`);
  }
  return value;
}

function optionalInteger(
  source: JsonRecord,
  key: string,
  path: string,
  minimum: number,
): number | undefined {
  return source[key] === undefined
    ? undefined
    : integer(source[key], path, minimum);
}

function optionalNumber(
  source: JsonRecord,
  key: string,
  path: string,
  minimum: number,
): number | undefined {
  return source[key] === undefined
    ? undefined
    : finiteNumber(source[key], path, minimum);
}

function optionalString(
  source: JsonRecord,
  key: string,
  path: string,
): string | undefined {
  return source[key] === undefined ? undefined : string(source[key], path);
}

function optionalDate(
  source: JsonRecord,
  key: string,
  path: string,
): string | undefined {
  return source[key] === undefined ? undefined : isoDate(source[key], path);
}

function uniqueIds<T extends { id: string }>(values: T[], path: string): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id))
      invalid(`${path} enthält die ID ${value.id} mehrfach.`);
    ids.add(value.id);
  }
}

function parseExercise(value: unknown, index: number): Exercise {
  const path = `data.exercises[${index}]`;
  const source = record(value, path);
  const defaultSets = optionalInteger(
    source,
    "defaultSets",
    `${path}.defaultSets`,
    1,
  );
  const defaultReps = optionalInteger(
    source,
    "defaultReps",
    `${path}.defaultReps`,
    1,
  );
  const defaultWeightKg = optionalNumber(
    source,
    "defaultWeightKg",
    `${path}.defaultWeightKg`,
    0,
  );
  const defaultDurationSec = optionalInteger(
    source,
    "defaultDurationSec",
    `${path}.defaultDurationSec`,
    1,
  );
  const archivedAt = optionalDate(source, "archivedAt", `${path}.archivedAt`);
  return {
    id: string(source["id"], `${path}.id`, { nonempty: true }),
    name: string(source["name"], `${path}.name`, {
      nonempty: true,
      maxLength: 100,
    }),
    description: string(source["description"], `${path}.description`, {
      maxLength: 2000,
    }),
    createdAt: isoDate(source["createdAt"], `${path}.createdAt`),
    updatedAt: isoDate(source["updatedAt"], `${path}.updatedAt`),
    ...(defaultSets !== undefined ? { defaultSets } : {}),
    ...(defaultReps !== undefined ? { defaultReps } : {}),
    ...(defaultWeightKg !== undefined ? { defaultWeightKg } : {}),
    ...(defaultDurationSec !== undefined ? { defaultDurationSec } : {}),
    ...(archivedAt !== undefined ? { archivedAt } : {}),
  };
}

function parseImage(
  value: unknown,
  index: number,
): { image: ExerciseImage; dataBase64: string } {
  const path = `data.exerciseImages[${index}]`;
  const source = record(value, path);
  const dataBase64 = string(source["dataBase64"], `${path}.dataBase64`);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64ToBytes(dataBase64);
  } catch (error) {
    throw new DataError(
      "invalid",
      `Backup ungültig: ${path}.dataBase64 ist kein Base64.`,
      {
        cause: error,
      },
    );
  }
  if (bytes.length === 0 || bytesToBase64(bytes) !== dataBase64) {
    return invalid(`${path}.dataBase64 ist nicht kanonisch oder leer.`);
  }
  const mimeType = string(source["mimeType"], `${path}.mimeType`, {
    nonempty: true,
  });
  if (!/^image\/[a-z0-9.+-]+$/i.test(mimeType)) {
    return invalid(`${path}.mimeType muss ein Bild-MIME-Type sein.`);
  }
  return {
    image: {
      id: string(source["id"], `${path}.id`, { nonempty: true }),
      exerciseId: string(source["exerciseId"], `${path}.exerciseId`, {
        nonempty: true,
      }),
      mimeType,
      data: new Blob([bytes], { type: mimeType }),
      sortOrder: integer(source["sortOrder"], `${path}.sortOrder`, 0),
      createdAt: isoDate(source["createdAt"], `${path}.createdAt`),
    },
    dataBase64,
  };
}

function parsePlan(value: unknown, index: number): Plan {
  const path = `data.plans[${index}]`;
  const source = record(value, path);
  const archivedAt = optionalDate(source, "archivedAt", `${path}.archivedAt`);
  return {
    id: string(source["id"], `${path}.id`, { nonempty: true }),
    name: string(source["name"], `${path}.name`, {
      nonempty: true,
      maxLength: 100,
    }),
    createdAt: isoDate(source["createdAt"], `${path}.createdAt`),
    updatedAt: isoDate(source["updatedAt"], `${path}.updatedAt`),
    ...(archivedAt !== undefined ? { archivedAt } : {}),
  };
}

function parsePlanItem(value: unknown, index: number): PlanItem {
  const path = `data.planItems[${index}]`;
  const source = record(value, path);
  const targetReps = optionalInteger(
    source,
    "targetReps",
    `${path}.targetReps`,
    1,
  );
  const targetWeightKg = optionalNumber(
    source,
    "targetWeightKg",
    `${path}.targetWeightKg`,
    0,
  );
  const targetDurationSec = optionalInteger(
    source,
    "targetDurationSec",
    `${path}.targetDurationSec`,
    1,
  );
  return {
    id: string(source["id"], `${path}.id`, { nonempty: true }),
    planId: string(source["planId"], `${path}.planId`, { nonempty: true }),
    exerciseId: string(source["exerciseId"], `${path}.exerciseId`, {
      nonempty: true,
    }),
    position: integer(source["position"], `${path}.position`, 0),
    targetSets: integer(source["targetSets"], `${path}.targetSets`, 1),
    ...(targetReps !== undefined ? { targetReps } : {}),
    ...(targetWeightKg !== undefined ? { targetWeightKg } : {}),
    ...(targetDurationSec !== undefined ? { targetDurationSec } : {}),
  };
}

function parseWorkout(value: unknown, index: number): Workout {
  const path = `data.workouts[${index}]`;
  const source = record(value, path);
  const planId = optionalString(source, "planId", `${path}.planId`);
  const planNameSnapshot = optionalString(
    source,
    "planNameSnapshot",
    `${path}.planNameSnapshot`,
  );
  const endedAt = optionalDate(source, "endedAt", `${path}.endedAt`);
  const note = optionalString(source, "note", `${path}.note`);
  return {
    id: string(source["id"], `${path}.id`, { nonempty: true }),
    startedAt: isoDate(source["startedAt"], `${path}.startedAt`),
    ...(planId !== undefined ? { planId } : {}),
    ...(planNameSnapshot !== undefined ? { planNameSnapshot } : {}),
    ...(endedAt !== undefined ? { endedAt } : {}),
    ...(note !== undefined ? { note } : {}),
  };
}

function parseLoggedSet(value: unknown, index: number): LoggedSet {
  const path = `data.loggedSets[${index}]`;
  const source = record(value, path);
  const reps = optionalInteger(source, "reps", `${path}.reps`, 1);
  const weightKg = optionalNumber(source, "weightKg", `${path}.weightKg`, 0);
  const durationSec = optionalInteger(
    source,
    "durationSec",
    `${path}.durationSec`,
    1,
  );
  if (
    reps === undefined &&
    weightKg === undefined &&
    durationSec === undefined
  ) {
    return invalid(`${path} muss mindestens einen Satzwert enthalten.`);
  }
  return {
    id: string(source["id"], `${path}.id`, { nonempty: true }),
    workoutId: string(source["workoutId"], `${path}.workoutId`, {
      nonempty: true,
    }),
    exerciseId: string(source["exerciseId"], `${path}.exerciseId`, {
      nonempty: true,
    }),
    exerciseNameSnapshot: string(
      source["exerciseNameSnapshot"],
      `${path}.exerciseNameSnapshot`,
      { nonempty: true },
    ),
    exerciseOrder: integer(source["exerciseOrder"], `${path}.exerciseOrder`, 0),
    setNumber: integer(source["setNumber"], `${path}.setNumber`, 1),
    ...(reps !== undefined ? { reps } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    loggedAt: isoDate(source["loggedAt"], `${path}.loggedAt`),
  };
}

function validateRelations(data: RepositoryData): void {
  const exerciseIds = new Set(data.exercises.map((item) => item.id));
  const planIds = new Set(data.plans.map((item) => item.id));
  const workoutIds = new Set(data.workouts.map((item) => item.id));
  const planPositions = new Map<string, Set<number>>();
  const imagePositions = new Map<string, Set<number>>();
  let openWorkouts = 0;

  for (const image of data.exerciseImages) {
    if (!exerciseIds.has(image.exerciseId)) {
      invalid(`Bild ${image.id} verweist auf eine unbekannte Übung.`);
    }
    const positions = imagePositions.get(image.exerciseId) ?? new Set<number>();
    if (positions.has(image.sortOrder)) {
      invalid(
        `Bilder der Übung ${image.exerciseId} haben doppelte Sortierungen.`,
      );
    }
    positions.add(image.sortOrder);
    imagePositions.set(image.exerciseId, positions);
  }

  for (const item of data.planItems) {
    if (!planIds.has(item.planId)) {
      invalid(`Planeintrag ${item.id} verweist auf einen unbekannten Plan.`);
    }
    if (!exerciseIds.has(item.exerciseId)) {
      invalid(`Planeintrag ${item.id} verweist auf eine unbekannte Übung.`);
    }
    const positions = planPositions.get(item.planId) ?? new Set<number>();
    if (positions.has(item.position)) {
      invalid(`Plan ${item.planId} enthält doppelte Positionen.`);
    }
    positions.add(item.position);
    planPositions.set(item.planId, positions);
  }

  for (const [planId, positions] of planPositions) {
    const sorted = [...positions].sort((a, b) => a - b);
    if (sorted.some((position, index) => position !== index)) {
      invalid(`Plan ${planId} hat keine lückenlose Reihenfolge.`);
    }
  }

  for (const workout of data.workouts) {
    if (workout.planId !== undefined && !planIds.has(workout.planId)) {
      invalid(`Workout ${workout.id} verweist auf einen unbekannten Plan.`);
    }
    if (workout.endedAt === undefined) openWorkouts++;
  }
  if (openWorkouts > 1) {
    invalid("Es darf höchstens ein offenes Workout enthalten sein.");
  }

  for (const set of data.loggedSets) {
    if (!workoutIds.has(set.workoutId)) {
      invalid(`Satz ${set.id} verweist auf ein unbekanntes Workout.`);
    }
    if (!exerciseIds.has(set.exerciseId)) {
      invalid(`Satz ${set.id} verweist auf eine unbekannte Übung.`);
    }
  }
}

function validateBackup(raw: unknown): ValidatedBackup {
  const migrated = migrateToLatest(raw);
  if (migrated["app"] !== "TrainingApp") {
    return invalid("Die Datei stammt nicht aus der TrainingApp.");
  }
  if (migrated["schemaVersion"] !== SCHEMA_VERSION) {
    throw new DataError(
      "version",
      `Backup ungültig: Schema-Version ${String(migrated["schemaVersion"])} wird nicht unterstützt.`,
    );
  }
  const exportedAt = isoDate(migrated["exportedAt"], "exportedAt");
  const source = record(migrated["data"], "data");
  const exercises = array(source["exercises"], "data.exercises").map(
    parseExercise,
  );
  const parsedImages = array(
    source["exerciseImages"],
    "data.exerciseImages",
  ).map(parseImage);
  const exerciseImages = parsedImages.map(({ image }) => image);
  const plans = array(source["plans"], "data.plans").map(parsePlan);
  const planItems = array(source["planItems"], "data.planItems").map(
    parsePlanItem,
  );
  const workouts = array(source["workouts"], "data.workouts").map(parseWorkout);
  const loggedSets = array(source["loggedSets"], "data.loggedSets").map(
    parseLoggedSet,
  );

  uniqueIds(exercises, "data.exercises");
  uniqueIds(exerciseImages, "data.exerciseImages");
  uniqueIds(plans, "data.plans");
  uniqueIds(planItems, "data.planItems");
  uniqueIds(workouts, "data.workouts");
  uniqueIds(loggedSets, "data.loggedSets");

  const repositoryData: RepositoryData = {
    exercises,
    exerciseImages,
    plans,
    planItems,
    workouts,
    loggedSets,
  };
  validateRelations(repositoryData);

  const file: ExportFile = {
    app: "TrainingApp",
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    data: {
      exercises,
      exerciseImages: parsedImages.map(({ image, dataBase64 }) => ({
        id: image.id,
        exerciseId: image.exerciseId,
        mimeType: image.mimeType,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt,
        dataBase64,
      })),
      plans,
      planItems,
      workouts,
      loggedSets,
    },
  };
  return {
    file,
    repositoryData,
    summary: {
      exercises: exercises.length,
      exerciseImages: exerciseImages.length,
      plans: plans.length,
      workouts: workouts.length,
    },
  };
}

export function createBackupImporter(repositories: Repositories) {
  return {
    validate(raw: unknown): ImportValidationResult {
      const { file, summary } = validateBackup(raw);
      return { file, summary };
    },

    async importReplaceAll(raw: unknown): Promise<ImportSummary> {
      const { repositoryData, summary } = validateBackup(raw);
      await repositories.replaceAll(repositoryData);
      return summary;
    },
  };
}
