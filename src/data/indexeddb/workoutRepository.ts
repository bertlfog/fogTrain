import type { IDBPCursorWithValue } from "idb";

import { DataError } from "../errors";
import type { WorkoutRepository } from "../repositories";
import type { Workout } from "../../model";
import { read, write } from "./database";
import type { TrainingDb, TrainingDbSchema } from "./schema";

type StartedAtCursor<Mode extends IDBTransactionMode> = IDBPCursorWithValue<
  TrainingDbSchema,
  ["workouts"],
  "workouts",
  "startedAt",
  Mode
> | null;

/** Neuestes offenes Workout; durchsucht von neu nach alt. */
async function findOpen<Mode extends IDBTransactionMode>(
  first: StartedAtCursor<Mode>,
): Promise<Workout | undefined> {
  let cursor = first;
  while (cursor) {
    if (cursor.value.endedAt === undefined) {
      return cursor.value;
    }
    cursor = await cursor.continue();
  }
  return undefined;
}

export function createWorkoutRepository(db: TrainingDb): WorkoutRepository {
  return {
    start: (workout) =>
      write(db, ["workouts"], async (tx) => {
        const store = tx.objectStore("workouts");
        if (workout.endedAt === undefined) {
          const open = await findOpen(
            await store.index("startedAt").openCursor(null, "prev"),
          );
          if (open !== undefined && open.id !== workout.id) {
            throw new DataError(
              "conflict",
              `Workout ${open.id} ist noch offen`,
            );
          }
        }
        await store.put(workout);
      }),

    finish: (id, endedAt) =>
      write(db, ["workouts"], async (tx) => {
        const store = tx.objectStore("workouts");
        const current = await store.get(id);
        if (!current) {
          throw new DataError("not_found", `Workout ${id} nicht gefunden`);
        }
        await store.put({ ...current, endedAt });
      }),

    getOpen: () =>
      read(async () =>
        findOpen(
          await db
            .transaction("workouts")
            .store.index("startedAt")
            .openCursor(null, "prev"),
        ),
      ),

    get: (id) =>
      read(async () => {
        const tx = db.transaction(["workouts", "loggedSets"], "readonly");
        const workout = await tx.objectStore("workouts").get(id);
        if (!workout) {
          return undefined;
        }
        const sets = await tx
          .objectStore("loggedSets")
          .index("workoutId")
          .getAll(id);
        await tx.done;
        return {
          workout,
          sets: sets.sort(
            (a, b) =>
              a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber,
          ),
        };
      }),

    list: (opts) =>
      read(async () => {
        const range =
          opts?.before === undefined
            ? null
            : IDBKeyRange.upperBound(opts.before, true);
        const result: Workout[] = [];
        let cursor = await db
          .transaction("workouts")
          .store.index("startedAt")
          .openCursor(range, "prev");
        while (
          cursor &&
          (opts?.limit === undefined || result.length < opts.limit)
        ) {
          result.push(cursor.value);
          cursor = await cursor.continue();
        }
        return result;
      }),

    saveSet: (set) =>
      write(db, ["workouts", "loggedSets"], async (tx) => {
        const exists = await tx.objectStore("workouts").count(set.workoutId);
        if (exists === 0) {
          throw new DataError(
            "not_found",
            `Workout ${set.workoutId} nicht gefunden`,
          );
        }
        await tx.objectStore("loggedSets").put(set);
      }),

    removeSet: (id) =>
      write(db, ["loggedSets"], async (tx) => {
        await tx.objectStore("loggedSets").delete(id);
      }),

    listSetsByExercise: (exerciseId) =>
      read(async () => {
        const sets = await db.getAllFromIndex(
          "loggedSets",
          "exerciseId",
          exerciseId,
        );
        return sets.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
      }),

    remove: (id) =>
      write(db, ["workouts", "loggedSets"], async (tx) => {
        const store = tx.objectStore("workouts");
        if ((await store.count(id)) === 0) {
          throw new DataError("not_found", `Workout ${id} nicht gefunden`);
        }
        const sets = tx.objectStore("loggedSets");
        for (const key of await sets.index("workoutId").getAllKeys(id)) {
          await sets.delete(key);
        }
        await store.delete(id);
      }),
  };
}
