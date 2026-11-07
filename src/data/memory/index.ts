import { DataError } from "../errors";
import type { Repositories } from "../repositories";
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

/**
 * In-Memory-Implementierung der Repositories für Tests (SPEC Abschnitt 4).
 * Verhält sich wie die IndexedDB-Implementierung (gleiche Contract-Suite).
 * Datensätze sind flach; Kopien verhindern, dass Aufrufer den Bestand ändern.
 */

function compareName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
}

export function createMemoryRepositories(): Repositories {
  const exercises = new Map<Id, Exercise>();
  const exerciseImages = new Map<Id, ExerciseImage>();
  const plans = new Map<Id, Plan>();
  const planItems = new Map<Id, PlanItem>();
  const workouts = new Map<Id, Workout>();
  const loggedSets = new Map<Id, LoggedSet>();

  const values = <T>(map: Map<Id, T>): T[] =>
    [...map.values()].map((v) => ({ ...v }));

  const itemsOfPlan = (planId: Id): PlanItem[] =>
    values(planItems)
      .filter((i) => i.planId === planId)
      .sort((a, b) => a.position - b.position);

  const setsOfWorkout = (workoutId: Id): LoggedSet[] =>
    values(loggedSets)
      .filter((s) => s.workoutId === workoutId)
      .sort(
        (a, b) =>
          a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber,
      );

  const openWorkout = (): Workout | undefined =>
    values(workouts).find((w) => w.endedAt === undefined);

  const archive = <T extends { archivedAt?: IsoDateTime }>(
    map: Map<Id, T>,
    id: Id,
  ): void => {
    const current = map.get(id);
    if (current) {
      map.set(id, { ...current, archivedAt: new Date().toISOString() });
    }
  };

  return {
    exercises: {
      async list(opts) {
        return values(exercises)
          .filter((e) => opts?.includeArchived || e.archivedAt === undefined)
          .sort(compareName);
      },
      async get(id) {
        const found = exercises.get(id);
        return found ? { ...found } : undefined;
      },
      async save(exercise) {
        exercises.set(exercise.id, { ...exercise });
      },
      async remove(id) {
        if (!exercises.has(id)) {
          throw new DataError("not_found", `Übung ${id} nicht gefunden`);
        }
        const referenced =
          values(planItems).some((i) => i.exerciseId === id) ||
          values(loggedSets).some((s) => s.exerciseId === id);
        if (referenced) {
          archive(exercises, id);
          return "archived";
        }
        for (const image of values(exerciseImages)) {
          if (image.exerciseId === id) exerciseImages.delete(image.id);
        }
        exercises.delete(id);
        return "deleted";
      },
      async listImages(exerciseId) {
        return values(exerciseImages)
          .filter((i) => i.exerciseId === exerciseId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
      async saveImage(image) {
        if (!exercises.has(image.exerciseId)) {
          throw new DataError(
            "not_found",
            `Übung ${image.exerciseId} nicht gefunden`,
          );
        }
        exerciseImages.set(image.id, { ...image });
      },
      async removeImage(id) {
        exerciseImages.delete(id);
      },
    },

    plans: {
      async list(opts) {
        return values(plans)
          .filter((p) => opts?.includeArchived || p.archivedAt === undefined)
          .sort(compareName);
      },
      async get(id) {
        const plan = plans.get(id);
        return plan ? { plan: { ...plan }, items: itemsOfPlan(id) } : undefined;
      },
      async save(plan, items) {
        // Alles prüfen, bevor etwas verändert wird: Der Altzustand bleibt bei
        // einem Fehler damit unangetastet (Rollback-Verhalten wie bei IndexedDB).
        for (const item of items) {
          if (item.planId !== plan.id) {
            throw new DataError(
              "invalid",
              `Planeintrag ${item.id} gehört nicht zu Plan ${plan.id}`,
            );
          }
          if (!exercises.has(item.exerciseId)) {
            throw new DataError(
              "not_found",
              `Übung ${item.exerciseId} nicht gefunden`,
            );
          }
        }
        for (const old of itemsOfPlan(plan.id)) planItems.delete(old.id);
        plans.set(plan.id, { ...plan });
        for (const item of items) planItems.set(item.id, { ...item });
      },
      async remove(id) {
        if (!plans.has(id)) {
          throw new DataError("not_found", `Plan ${id} nicht gefunden`);
        }
        if (values(workouts).some((w) => w.planId === id)) {
          archive(plans, id);
          return "archived";
        }
        for (const item of itemsOfPlan(id)) planItems.delete(item.id);
        plans.delete(id);
        return "deleted";
      },
    },

    workouts: {
      async start(workout) {
        const open = openWorkout();
        if (
          workout.endedAt === undefined &&
          open !== undefined &&
          open.id !== workout.id
        ) {
          throw new DataError("conflict", `Workout ${open.id} ist noch offen`);
        }
        workouts.set(workout.id, { ...workout });
      },
      async finish(id, endedAt) {
        const current = workouts.get(id);
        if (!current) {
          throw new DataError("not_found", `Workout ${id} nicht gefunden`);
        }
        workouts.set(id, { ...current, endedAt });
      },
      async getOpen() {
        return openWorkout();
      },
      async get(id) {
        const workout = workouts.get(id);
        return workout
          ? { workout: { ...workout }, sets: setsOfWorkout(id) }
          : undefined;
      },
      async list(opts) {
        const before = opts?.before;
        const sorted = values(workouts)
          .filter((w) => before === undefined || w.startedAt < before)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        return opts?.limit === undefined ? sorted : sorted.slice(0, opts.limit);
      },
      async saveSet(set) {
        if (!workouts.has(set.workoutId)) {
          throw new DataError(
            "not_found",
            `Workout ${set.workoutId} nicht gefunden`,
          );
        }
        loggedSets.set(set.id, { ...set });
      },
      async removeSet(id) {
        loggedSets.delete(id);
      },
      async listSetsByExercise(exerciseId) {
        return values(loggedSets)
          .filter((s) => s.exerciseId === exerciseId)
          .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
      },
      async remove(id) {
        if (!workouts.has(id)) {
          throw new DataError("not_found", `Workout ${id} nicht gefunden`);
        }
        for (const set of setsOfWorkout(id)) loggedSets.delete(set.id);
        workouts.delete(id);
      },
    },
  };
}
