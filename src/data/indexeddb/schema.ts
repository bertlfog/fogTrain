import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from "idb";

import { DataError } from "../errors";
import { SCHEMA_VERSION } from "../../model";
import type {
  Exercise,
  ExerciseImage,
  Id,
  IsoDateTime,
  LoggedSet,
  Plan,
  PlanItem,
  Workout,
} from "../../model";

export const DB_NAME = "trainingapp";

/** Typisiertes Schema der IndexedDB (Stores und Indizes, SPEC Abschnitt 3). */
export interface TrainingDbSchema extends DBSchema {
  exercises: { key: Id; value: Exercise };
  exerciseImages: {
    key: Id;
    value: ExerciseImage;
    indexes: { exerciseId: Id };
  };
  plans: { key: Id; value: Plan };
  planItems: {
    key: Id;
    value: PlanItem;
    // exerciseId: Löschregel der Übung (archivieren statt löschen)
    indexes: { planId: Id; exerciseId: Id };
  };
  workouts: {
    key: Id;
    value: Workout;
    // planId: Löschregel des Plans (archivieren statt löschen)
    indexes: { startedAt: IsoDateTime; planId: Id };
  };
  loggedSets: {
    key: Id;
    value: LoggedSet;
    indexes: { workoutId: Id; exerciseId: Id };
  };
}

export type TrainingDb = IDBPDatabase<TrainingDbSchema>;

type UpgradeTransaction = IDBPTransaction<
  TrainingDbSchema,
  StoreNames<TrainingDbSchema>[],
  "versionchange"
>;

type Migration = (db: TrainingDb, tx: UpgradeTransaction) => void;

/**
 * Migrationen je Zielversion. Version N→N+1 ist ein Eintrag `N+1`;
 * die IndexedDB-Version ist `SCHEMA_VERSION` (SPEC Abschnitt 3).
 */
export const migrations: Readonly<Record<number, Migration>> = {
  1: (db) => {
    db.createObjectStore("exercises", { keyPath: "id" });

    const images = db.createObjectStore("exerciseImages", { keyPath: "id" });
    images.createIndex("exerciseId", "exerciseId");

    db.createObjectStore("plans", { keyPath: "id" });

    const planItems = db.createObjectStore("planItems", { keyPath: "id" });
    planItems.createIndex("planId", "planId");
    planItems.createIndex("exerciseId", "exerciseId");

    const workouts = db.createObjectStore("workouts", { keyPath: "id" });
    workouts.createIndex("startedAt", "startedAt");
    workouts.createIndex("planId", "planId");

    const sets = db.createObjectStore("loggedSets", { keyPath: "id" });
    sets.createIndex("workoutId", "workoutId");
    sets.createIndex("exerciseId", "exerciseId");
  },
};

/** Führt alle Migrationen von `oldVersion` bis zur Zielversion nacheinander aus. */
export function upgrade(
  db: TrainingDb,
  oldVersion: number,
  newVersion: number | null,
  tx: UpgradeTransaction,
): void {
  const target = newVersion ?? SCHEMA_VERSION;
  for (let version = oldVersion + 1; version <= target; version++) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new DataError(
        "version",
        `Keine Migration auf Datenbankversion ${version} vorhanden`,
      );
    }
    migrate(db, tx);
  }
}
