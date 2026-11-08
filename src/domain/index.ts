import type { Exercise, Id, LoggedSet, PlanItem } from "../model";

export interface ExerciseInput {
  name: string;
  description: string;
  defaultSets?: number;
  defaultReps?: number;
  defaultWeightKg?: number;
  defaultDurationSec?: number;
}

export function validateExercise(input: ExerciseInput): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push("Bitte gib einen Übungsnamen ein.");
  if (name.length > 100)
    errors.push("Der Übungsname darf höchstens 100 Zeichen lang sein.");
  if (input.description.length > 2000)
    errors.push("Die Beschreibung darf höchstens 2000 Zeichen lang sein.");
  if (
    input.defaultSets !== undefined &&
    (!Number.isInteger(input.defaultSets) || input.defaultSets < 1)
  )
    errors.push("Sätze müssen eine positive ganze Zahl sein.");
  if (
    input.defaultReps !== undefined &&
    (!Number.isInteger(input.defaultReps) || input.defaultReps < 1)
  )
    errors.push("Wiederholungen müssen eine positive ganze Zahl sein.");
  if (
    input.defaultWeightKg !== undefined &&
    (!Number.isFinite(input.defaultWeightKg) || input.defaultWeightKg < 0)
  )
    errors.push("Das Gewicht muss mindestens 0 kg betragen.");
  if (
    input.defaultDurationSec !== undefined &&
    (!Number.isInteger(input.defaultDurationSec) ||
      input.defaultDurationSec < 1)
  )
    errors.push("Die Dauer muss eine positive ganze Zahl in Sekunden sein.");
  return errors;
}

export function validatePlanName(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return ["Bitte gib einen Plannamen ein."];
  if (trimmed.length > 100)
    return ["Der Planname darf höchstens 100 Zeichen lang sein."];
  return [];
}

export function imageDimensions(
  width: number,
  height: number,
  maxEdge = 1280,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maxEdge) ||
    maxEdge <= 0
  ) {
    throw new RangeError("Bildmaße und maximale Kante müssen positiv sein.");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function normalizePlanItems(items: PlanItem[]): PlanItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.position - b.item.position || a.index - b.index)
    .map(({ item }, position) => ({ ...item, position }));
}

export function createPlanItem(
  planId: Id,
  exercise: Exercise,
  position: number,
): PlanItem {
  return {
    id: crypto.randomUUID(),
    planId,
    exerciseId: exercise.id,
    position,
    targetSets: exercise.defaultSets ?? 3,
    ...(exercise.defaultReps !== undefined
      ? { targetReps: exercise.defaultReps }
      : {}),
    ...(exercise.defaultWeightKg !== undefined
      ? { targetWeightKg: exercise.defaultWeightKg }
      : {}),
    ...(exercise.defaultDurationSec !== undefined
      ? { targetDurationSec: exercise.defaultDurationSec }
      : {}),
  };
}

export function nextSetNumber(sets: LoggedSet[], exerciseId: Id): number {
  return (
    sets
      .filter((set) => set.exerciseId === exerciseId)
      .reduce((maximum, set) => Math.max(maximum, set.setNumber), 0) + 1
  );
}

export interface SetValues {
  reps?: number;
  weightKg?: number;
  durationSec?: number;
}

export function prefillSetValues(
  exercise: Exercise,
  target?: {
    targetReps?: number;
    targetWeightKg?: number;
    targetDurationSec?: number;
  },
  previous?: SetValues,
): SetValues {
  const reps = previous?.reps ?? target?.targetReps ?? exercise.defaultReps;
  const weightKg =
    previous?.weightKg ?? target?.targetWeightKg ?? exercise.defaultWeightKg;
  const durationSec =
    previous?.durationSec ??
    target?.targetDurationSec ??
    exercise.defaultDurationSec;
  return {
    ...(reps !== undefined ? { reps } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
  };
}

export function bestSet(sets: LoggedSet[]): LoggedSet | undefined {
  return [...sets].sort(
    (a, b) =>
      (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0),
  )[0];
}

export function workoutVolume(sets: LoggedSet[]): number {
  return sets.reduce(
    (total, set) => total + (set.reps ?? 0) * (set.weightKg ?? 0),
    0,
  );
}

export interface ExerciseProgress {
  date: string;
  bestWeightKg?: number;
  bestReps?: number;
  volume: number;
}

export function exerciseProgress(sets: LoggedSet[]): ExerciseProgress[] {
  const byWorkout = new Map<string, LoggedSet[]>();
  for (const set of sets) {
    const bucket = byWorkout.get(set.workoutId) ?? [];
    bucket.push(set);
    byWorkout.set(set.workoutId, bucket);
  }
  return [...byWorkout.entries()]
    .map(([, workoutSets]) => {
      const best = bestSet(workoutSets);
      return {
        date: workoutSets[0]?.loggedAt.slice(0, 10) ?? "",
        ...(best?.weightKg !== undefined
          ? { bestWeightKg: best.weightKg }
          : {}),
        ...(best?.reps !== undefined ? { bestReps: best.reps } : {}),
        volume: workoutVolume(workoutSets),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
