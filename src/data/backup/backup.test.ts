import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";

import { openDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import type { ExportFile } from "../../model";
import { exercise } from "../contract";
import { openIndexedDbRepositories } from "../indexeddb";
import type { IndexedDbHandle } from "../indexeddb";
import { createMemoryRepositories } from "../memory";
import type { Repositories } from "../repositories";
import { backupFileName, base64ToBytes, createBackupService } from "./index";

const loadFixture = (): ExportFile =>
  JSON.parse(
    readFileSync(new URL("./fixtures/export-v1.json", import.meta.url), "utf8"),
  ) as ExportFile;

/** Legt die Fixture-Daten über die Repositories an (ohne Export-Umweg). */
async function populate(repos: Repositories, file: ExportFile): Promise<void> {
  const { data } = file;
  for (const e of data.exercises) await repos.exercises.save(e);
  for (const { dataBase64, ...meta } of data.exerciseImages) {
    await repos.exercises.saveImage({
      ...meta,
      data: new Blob([base64ToBytes(dataBase64)], { type: meta.mimeType }),
    });
  }
  for (const p of data.plans) {
    await repos.plans.save(
      p,
      data.planItems.filter((i) => i.planId === p.id),
    );
  }
  for (const w of data.workouts) await repos.workouts.start(w);
  for (const s of data.loggedSets) await repos.workouts.saveSet(s);
}

let counter = 0;
const open: IndexedDbHandle[] = [];

afterEach(() => {
  while (open.length > 0) open.pop()?.close();
});

async function openIndexedDb(name = `trainingapp-backup-test-${++counter}`) {
  const handle = await openIndexedDbRepositories(name);
  open.push(handle);
  return { handle, name };
}

const implementations: Array<[string, () => Promise<Repositories>]> = [
  ["In-Memory", async () => createMemoryRepositories()],
  [
    "IndexedDB (fake-indexeddb)",
    async () => (await openIndexedDb()).handle.repositories,
  ],
];

describe.each(implementations)(
  "BackupService.exportAll: %s",
  (_label, create) => {
    it("exportiert leere Repositories als gültiges, leeres Dokument", async () => {
      const service = createBackupService(await create(), {
        now: () => new Date("2026-03-01T12:00:00.000Z"),
      });

      expect(await service.exportAll()).toEqual({
        app: "TrainingApp",
        schemaVersion: 1,
        exportedAt: "2026-03-01T12:00:00.000Z",
        data: {
          exercises: [],
          exerciseImages: [],
          plans: [],
          planItems: [],
          workouts: [],
          loggedSets: [],
        },
      });
    });

    it("entspricht der eingefrorenen Version-1-Fixture (alle Stores, archivierte Übung, Bild)", async () => {
      const fixture = loadFixture();
      const repos = await create();
      await populate(repos, fixture);

      const service = createBackupService(repos, {
        now: () => new Date(fixture.exportedAt),
      });
      expect(await service.exportAll()).toEqual(fixture);
    });

    it("liefert unabhängig von der Anlegereihenfolge dieselbe Datei", async () => {
      const fixture = loadFixture();
      const reversed: ExportFile = {
        ...fixture,
        data: {
          ...fixture.data,
          exercises: [...fixture.data.exercises].reverse(),
          loggedSets: [...fixture.data.loggedSets].reverse(),
        },
      };
      const repos = await create();
      await populate(repos, reversed);

      const service = createBackupService(repos, {
        now: () => new Date(fixture.exportedAt),
      });
      expect(await service.exportAll()).toEqual(fixture);
    });

    it("erzeugt Daten, die JSON unverändert überstehen", async () => {
      const repos = await create();
      await populate(repos, loadFixture());

      const file = await createBackupService(repos).exportAll();
      expect(JSON.parse(JSON.stringify(file))).toEqual(file);
    });

    it("macht Bild-Bytes aus dem Base64-Wert unverändert rekonstruierbar", async () => {
      const original = Uint8Array.from({ length: 256 }, (_, i) => 255 - i);
      const repos = await create();
      await repos.exercises.save(exercise("e1"));
      await repos.exercises.saveImage({
        id: "i1",
        exerciseId: "e1",
        mimeType: "image/jpeg",
        data: new Blob([original], { type: "image/jpeg" }),
        sortOrder: 0,
        createdAt: "2026-01-01T10:00:00.000Z",
      });

      const file = await createBackupService(repos).exportAll();
      const [image] = file.data.exerciseImages;
      expect(image?.mimeType).toBe("image/jpeg");
      expect([...base64ToBytes(image?.dataBase64 ?? "")]).toEqual([
        ...original,
      ]);
      expect(image).not.toHaveProperty("data");
    });

    it("enthält archivierte Pläne, auf die der Verlauf verweist", async () => {
      const fixture = loadFixture();
      const repos = await create();
      await populate(repos, fixture);
      expect(await repos.plans.remove("p-1")).toBe("archived");

      const file = await createBackupService(repos).exportAll();
      expect(file.data.plans.map((p) => p.id)).toEqual(["p-1"]);
      expect(file.data.plans[0]?.archivedAt).toBeDefined();
      expect(file.data.planItems).toHaveLength(2);
    });
  },
);

describe("backupFileName", () => {
  it("folgt der Konvention trainingapp-backup-YYYY-MM-DD.json", () => {
    expect(backupFileName(new Date(2026, 10, 7, 23, 59))).toBe(
      "trainingapp-backup-2026-11-07.json",
    );
  });

  it("füllt Monat und Tag mit führenden Nullen auf", () => {
    expect(backupFileName(new Date(2026, 0, 5, 0, 1))).toBe(
      "trainingapp-backup-2026-01-05.json",
    );
  });
});

describe("Performance N7", () => {
  it("exportiert 500 Workouts (10 000 Sätze, ohne Bilder) in unter 3 s", async () => {
    const { handle, name } = await openIndexedDb();
    await handle.repositories.exercises.save(exercise("e1"));

    // Bestand in einer einzigen Transaktion anlegen (schnell, nicht gemessen).
    const raw = await openDB(name);
    const tx = raw.transaction(["workouts", "loggedSets"], "readwrite");
    for (let w = 0; w < 500; w++) {
      const startedAt = new Date(
        Date.UTC(2024, 0, 1) + w * 86_400_000,
      ).toISOString();
      void tx.objectStore("workouts").put({
        id: `w-${w}`,
        startedAt,
        endedAt: startedAt,
      });
      for (let s = 0; s < 20; s++) {
        void tx.objectStore("loggedSets").put({
          id: `s-${w}-${s}`,
          workoutId: `w-${w}`,
          exerciseId: "e1",
          exerciseNameSnapshot: "Übung e1",
          exerciseOrder: 0,
          setNumber: s + 1,
          reps: 10,
          weightKg: 20,
          loggedAt: startedAt,
        });
      }
    }
    await tx.done;
    raw.close();

    const service = createBackupService(handle.repositories);
    const start = performance.now();
    const file = await service.exportAll();
    const json = JSON.stringify(file);
    const duration = performance.now() - start;

    console.info(
      `N7: Export von 500 Workouts / 10 000 Sätzen: ${duration.toFixed(0)} ms (${(json.length / 1024).toFixed(0)} kB)`,
    );
    expect(file.data.workouts).toHaveLength(500);
    expect(file.data.loggedSets).toHaveLength(10_000);
    expect(duration).toBeLessThan(3000);
  }, 60_000);
});
