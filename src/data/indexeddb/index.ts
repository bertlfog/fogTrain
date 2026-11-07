import type { Repositories } from "../repositories";
import { openTrainingDb } from "./database";
import { createExerciseRepository } from "./exerciseRepository";
import { createPlanRepository } from "./planRepository";
import { DB_NAME } from "./schema";
import { createWorkoutRepository } from "./workoutRepository";

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
    },
    close: () => db.close(),
  };
}
