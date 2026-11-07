import "fake-indexeddb/auto";

import { openDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../../model";
import {
  exercise,
  loggedSet,
  runRepositoryContract,
  workout,
} from "../contract";
import { DataError } from "../errors";
import { openIndexedDbRepositories } from "./index";
import type { IndexedDbHandle } from "./index";
import { migrations, upgrade } from "./schema";
import type { TrainingDb } from "./schema";

let counter = 0;
const freshName = () => `trainingapp-test-${++counter}`;
const open: IndexedDbHandle[] = [];

afterEach(() => {
  while (open.length > 0) open.pop()?.close();
});

async function openFresh(name = freshName()) {
  const handle = await openIndexedDbRepositories(name);
  open.push(handle);
  return handle;
}

runRepositoryContract("IndexedDB (fake-indexeddb)", async () => {
  return (await openFresh()).repositories;
});

describe("IndexedDB: Schema und Version", () => {
  it("legt die Datenbank mit SCHEMA_VERSION, allen Stores und Indizes an", async () => {
    const name = freshName();
    (await openFresh(name)).close();

    const db = await openDB(name);
    try {
      expect(db.version).toBe(SCHEMA_VERSION);
      expect([...db.objectStoreNames].sort()).toEqual([
        "exerciseImages",
        "exercises",
        "loggedSets",
        "planItems",
        "plans",
        "workouts",
      ]);

      const indexes = (store: string) =>
        [...db.transaction(store).store.indexNames].sort();
      expect(indexes("planItems")).toEqual(["exerciseId", "planId"]);
      expect(indexes("exerciseImages")).toEqual(["exerciseId"]);
      expect(indexes("loggedSets")).toEqual(["exerciseId", "workoutId"]);
      expect(indexes("workouts")).toEqual(["planId", "startedAt"]);
    } finally {
      db.close();
    }
  });

  it("behält Daten beim erneuten Öffnen", async () => {
    const name = freshName();
    const first = await openFresh(name);
    await first.repositories.exercises.save(exercise("e1", { name: "Plank" }));
    first.close();

    const second = await openFresh(name);
    expect((await second.repositories.exercises.get("e1"))?.name).toBe("Plank");
  });

  it("lehnt eine Datenbank mit neuerer Version ab (DataError 'version')", async () => {
    const name = freshName();
    const future = await openDB(name, SCHEMA_VERSION + 5);
    future.close();

    const error = await openIndexedDbRepositories(name).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DataError);
    expect((error as DataError).code).toBe("version");
  });

  it("hat für jede Version bis SCHEMA_VERSION eine Migration", () => {
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      expect(migrations[v], `Migration auf Version ${v}`).toBeTypeOf(
        "function",
      );
    }
  });

  it("meldet eine fehlende Migration als DataError 'version'", () => {
    const db = {} as TrainingDb;
    const tx = {} as Parameters<typeof upgrade>[3];
    expect(() =>
      upgrade(db, SCHEMA_VERSION, SCHEMA_VERSION + 1, tx),
    ).toThrowError(DataError);
  });
});

describe("IndexedDB: Performance N5", () => {
  it("speichert einen Satz bei 5000 Sätzen im Bestand unter 100 ms", async () => {
    const { repositories } = await openFresh();
    await repositories.exercises.save(exercise("e1"));
    await repositories.workouts.start(workout("w1"));

    // 5000 Sätze im Bestand anlegen (zügig, ohne zu messen).
    await Promise.all(
      Array.from({ length: 5000 }, (_, i) =>
        repositories.workouts.saveSet(
          loggedSet(`bestand-${i}`, "w1", "e1", { setNumber: i + 1 }),
        ),
      ),
    );

    // Einzelne Speichervorgänge messen und das Maximum bewerten.
    const durations: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await repositories.workouts.saveSet(
        loggedSet(`neu-${i}`, "w1", "e1", { setNumber: 6000 + i }),
      );
      durations.push(performance.now() - start);
    }

    const slowest = Math.max(...durations);
    console.info(
      `N5: längster saveSet bei 5000 Sätzen: ${slowest.toFixed(1)} ms`,
    );
    expect(slowest).toBeLessThan(100);
  }, 60_000);
});
