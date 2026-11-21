import type { Repositories } from "../repositories";
import { openTrainingDb } from "./database";
import { createExerciseRepository } from "./exerciseRepository";
import { createPlanRepository } from "./planRepository";
import { DB_NAME } from "./schema";
import type { TrainingDb } from "./schema";
import { write } from "./database";
import { createWorkoutRepository } from "./workoutRepository";
import type { RepositoryData } from "../repositories";

const STORES = [
  "exercises",
  "exerciseImages",
  "plans",
  "planItems",
  "workouts",
  "loggedSets",
] as const;

async function replaceAll(db: TrainingDb, data: RepositoryData): Promise<void> {
  await write(db, [...STORES], async (tx) => {
    for (const name of STORES) {
      await tx.objectStore(name).clear();
    }

    for (const value of data.exercises) {
      await tx.objectStore("exercises").put(value);
    }
    for (const value of data.exerciseImages) {
      await tx.objectStore("exerciseImages").put(value);
    }
    for (const value of data.plans) {
      await tx.objectStore("plans").put(value);
    }
    for (const value of data.planItems) {
      await tx.objectStore("planItems").put(value);
    }
    for (const value of data.workouts) {
      await tx.objectStore("workouts").put(value);
    }
    for (const value of data.loggedSets) {
      await tx.objectStore("loggedSets").put(value);
    }
  });
}

export { DB_NAME } from "./schema";

export interface IndexedDbHandle {
  repositories: Repositories;
  /** Gibt die Datenbankverbindung frei (Tests, Seitenwechsel). */
  close(): void;
}

/**
 * Öffnet die IndexedDB-Datenbank (legt sie bei Bedarf an oder migriert sie)
 * und liefert die Repositories. Einzige Stelle der App, die IndexedDB kennt.
 */
export async function openIndexedDbRepositories(
  name: string = DB_NAME,
): Promise<IndexedDbHandle> {
  const db = await openTrainingDb(name);
  return {
    repositories: {
      exercises: createExerciseRepository(db),
      plans: createPlanRepository(db),
      workouts: createWorkoutRepository(db),
      replaceAll: (data) => replaceAll(db, data),
    },
    close: () => db.close(),
  };
}
