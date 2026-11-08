import { describe, expect, it } from "vitest";

import type { Exercise, LoggedSet, PlanItem } from "../model";
import {
  bestSet,
  createPlanItem,
  exerciseProgress,
  imageDimensions,
  nextSetNumber,
  normalizePlanItems,
  prefillSetValues,
  validateExercise,
  validatePlanName,
  workoutVolume,
} from "./index";

const exercise: Exercise = {
  id: "exercise-1",
  name: "Kniebeuge",
  description: "",
  defaultSets: 4,
  defaultReps: 8,
  defaultWeightKg: 20,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
};

const item = (id: string, position: number): PlanItem => ({
  id,
  planId: "plan-1",
  exerciseId: exercise.id,
  position,
  targetSets: 3,
});

const set = (
  id: string,
  workoutId: string,
  weightKg: number,
  reps: number,
): LoggedSet => ({
  id,
  workoutId,
  exerciseId: exercise.id,
  exerciseNameSnapshot: exercise.name,
  exerciseOrder: 0,
  setNumber: 1,
  weightKg,
  reps,
  loggedAt: `2026-01-0${workoutId.endsWith("1") ? 1 : 2}T10:00:00.000Z`,
});

describe("Übungs- und Planvalidierung", () => {
  it("weist leere und zu lange Namen sowie ungültige Werte zurück", () => {
    expect(validateExercise({ name: " ", description: "" })).toContain(
      "Bitte gib einen Übungsnamen ein.",
    );
    expect(
      validateExercise({
        name: "x".repeat(101),
        description: "x".repeat(2001),
        defaultSets: 0,
        defaultReps: 0,
      }),
    ).toHaveLength(4);
    expect(validatePlanName(" ")).toHaveLength(1);
    expect(validatePlanName("x".repeat(101))).toHaveLength(1);
  });

  it("akzeptiert gültige optionale Übungswerte", () => {
    expect(
      validateExercise({
        name: "Plank",
        description: "",
        defaultWeightKg: 0,
      }),
    ).toEqual([]);
  });

  it("normalisiert die Planpositionen und übernimmt Übungsstandards", () => {
    expect(
      normalizePlanItems([item("b", 7), item("a", 3)]).map((i) => i.position),
    ).toEqual([0, 1]);
    const newItem = createPlanItem("plan-1", exercise, 2);
    expect(newItem).toMatchObject({
      exerciseId: exercise.id,
      position: 2,
      targetSets: 4,
      targetReps: 8,
      targetWeightKg: 20,
    });
  });

  it("verwendet drei Sätze, wenn für eine Übung kein Standard gesetzt ist", () => {
    const withoutDefault = { ...exercise, defaultSets: undefined };
    expect(createPlanItem("plan-1", withoutDefault, 0).targetSets).toBe(3);
  });

  it("verwendet letzte Werte vor Plan-Sollwerten und Übungsstandards", () => {
    expect(
      prefillSetValues(
        exercise,
        { targetReps: 12, targetWeightKg: 30, targetDurationSec: 60 },
        { reps: 15, weightKg: 22.5 },
      ),
    ).toEqual({ reps: 15, weightKg: 22.5, durationSec: 60 });
    expect(
      prefillSetValues(exercise, { targetReps: 12, targetWeightKg: 30 }),
    ).toEqual({ reps: 12, weightKg: 30 });
  });
});

describe("Bildskalierung", () => {
  it("skaliert proportionserhaltend auf höchstens 1280 px und vergrößert nicht", () => {
    expect(imageDimensions(2400, 1200)).toEqual({ width: 1280, height: 640 });
    expect(imageDimensions(640, 480)).toEqual({ width: 640, height: 480 });
    expect(imageDimensions(1, 2000)).toEqual({ width: 1, height: 1280 });
  });

  it("weist ungültige Abmessungen zurück", () => {
    expect(() => imageDimensions(0, 10)).toThrow(RangeError);
  });
});

describe("Workout- und Fortschrittsberechnung", () => {
  const sets = [
    set("s1", "w1", 20, 10),
    set("s2", "w1", 25, 8),
    set("s3", "w2", 25, 10),
  ];

  it("nummeriert Sätze je Übung und wählt Gewicht vor Wiederholungen", () => {
    const numbered = sets.map((entry, index) => ({
      ...entry,
      setNumber: index + 1,
    }));
    expect(nextSetNumber(numbered, exercise.id)).toBe(4);
    expect(bestSet(sets)).toBe(sets[2]);
  });

  it("berechnet Trainingsvolumen je Workout", () => {
    expect(workoutVolume(sets)).toBe(20 * 10 + 25 * 8 + 25 * 10);
  });

  it("liefert Fortschrittswerte chronologisch je Workout", () => {
    expect(exerciseProgress(sets)).toEqual([
      { date: "2026-01-01", bestWeightKg: 25, bestReps: 8, volume: 400 },
      { date: "2026-01-02", bestWeightKg: 25, bestReps: 10, volume: 250 },
    ]);
  });

  it("behandelt leere Daten", () => {
    expect(bestSet([])).toBeUndefined();
    expect(workoutVolume([])).toBe(0);
    expect(exerciseProgress([])).toEqual([]);
  });
});
