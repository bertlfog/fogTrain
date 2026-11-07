import { beforeEach, describe, expect, it } from "vitest";

import type {
  Exercise,
  ExerciseImage,
  LoggedSet,
  Plan,
  PlanItem,
  Workout,
} from "../model";
import { DataError } from "./errors";
import type { Repositories } from "./repositories";

/** Baut frische, leere Repositories für je einen Test. */
export type RepositoryFactory = () => Promise<Repositories>;

const T0 = "2026-01-01T10:00:00.000Z";

export const exercise = (
  id: string,
  over: Partial<Exercise> = {},
): Exercise => ({
  id,
  name: `Übung ${id}`,
  description: "",
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

export const plan = (id: string, over: Partial<Plan> = {}): Plan => ({
  id,
  name: `Plan ${id}`,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

export const planItem = (
  id: string,
  planId: string,
  exerciseId: string,
  position: number,
  over: Partial<PlanItem> = {},
): PlanItem => ({ id, planId, exerciseId, position, targetSets: 3, ...over });

export const workout = (id: string, over: Partial<Workout> = {}): Workout => ({
  id,
  startedAt: T0,
  ...over,
});

export const loggedSet = (
  id: string,
  workoutId: string,
  exerciseId: string,
  over: Partial<LoggedSet> = {},
): LoggedSet => ({
  id,
  workoutId,
  exerciseId,
  exerciseNameSnapshot: `Übung ${exerciseId}`,
  exerciseOrder: 0,
  setNumber: 1,
  reps: 10,
  loggedAt: T0,
  ...over,
});

export const image = (
  id: string,
  exerciseId: string,
  sortOrder: number,
): ExerciseImage => ({
  id,
  exerciseId,
  mimeType: "image/png",
  data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  sortOrder,
  createdAt: T0,
});

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DataError);
  expect((error as DataError).code).toBe(code);
}

/**
 * Gemeinsame Contract-Testsuite (SPEC Abschnitt 8): läuft gegen jede
 * Implementierung der Repositories.
 */
export function runRepositoryContract(
  label: string,
  createRepositories: RepositoryFactory,
): void {
  describe(`Repository-Contract: ${label}`, () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
    });

    describe("ExerciseRepository", () => {
      it("speichert, liest und aktualisiert eine Übung", async () => {
        await repos.exercises.save(exercise("e1", { name: "Kniebeuge" }));
        expect((await repos.exercises.get("e1"))?.name).toBe("Kniebeuge");

        await repos.exercises.save(exercise("e1", { name: "Goblet Squat" }));
        expect((await repos.exercises.get("e1"))?.name).toBe("Goblet Squat");
        expect(await repos.exercises.list()).toHaveLength(1);
      });

      it("liefert undefined für unbekannte Ids", async () => {
        expect(await repos.exercises.get("fehlt")).toBeUndefined();
      });

      it("sortiert die Liste nach Name (deutsche Reihenfolge, ohne Groß-/Kleinschreibung)", async () => {
        await repos.exercises.save(exercise("a", { name: "zehen heben" }));
        await repos.exercises.save(exercise("b", { name: "Äußere Rotation" }));
        await repos.exercises.save(exercise("c", { name: "Bizeps-Curl" }));

        const names = (await repos.exercises.list()).map((e) => e.name);
        expect(names).toEqual([
          "Äußere Rotation",
          "Bizeps-Curl",
          "zehen heben",
        ]);
      });

      it("löscht eine unverwendete Übung samt Bildern hart", async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.exercises.saveImage(image("i1", "e1", 0));

        expect(await repos.exercises.remove("e1")).toBe("deleted");
        expect(await repos.exercises.get("e1")).toBeUndefined();
        expect(await repos.exercises.listImages("e1")).toEqual([]);
      });

      it("archiviert eine Übung, die in einem Plan vorkommt", async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.plans.save(plan("p1"), [planItem("pi1", "p1", "e1", 0)]);

        expect(await repos.exercises.remove("e1")).toBe("archived");
        expect((await repos.exercises.get("e1"))?.archivedAt).toBeDefined();
        expect(await repos.exercises.list()).toEqual([]);
        expect(
          await repos.exercises.list({ includeArchived: true }),
        ).toHaveLength(1);
      });

      it("archiviert eine Übung, die im Verlauf vorkommt, und behält Bilder", async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.exercises.saveImage(image("i1", "e1", 0));
        await repos.workouts.start(workout("w1"));
        await repos.workouts.saveSet(loggedSet("s1", "w1", "e1"));

        expect(await repos.exercises.remove("e1")).toBe("archived");
        expect(await repos.exercises.listImages("e1")).toHaveLength(1);
      });

      it("meldet not_found beim Löschen einer fehlenden Übung", async () => {
        await expectCode(repos.exercises.remove("fehlt"), "not_found");
      });

      it("sortiert Bilder nach sortOrder", async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.exercises.saveImage(image("i2", "e1", 1));
        await repos.exercises.saveImage(image("i1", "e1", 0));

        const ids = (await repos.exercises.listImages("e1")).map((i) => i.id);
        expect(ids).toEqual(["i1", "i2"]);
      });

      it("bewahrt die Bild-Bytes", async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.exercises.saveImage(image("i1", "e1", 0));

        const stored = (await repos.exercises.listImages("e1"))[0];
        if (!stored) throw new Error("Bild wurde nicht gespeichert");
        const bytes = new Uint8Array(await stored.data.arrayBuffer());
        expect([...bytes]).toEqual([1, 2, 3]);
        expect(stored.mimeType).toBe("image/png");
      });

      it("meldet not_found beim Bild einer fehlenden Übung", async () => {
        await expectCode(
          repos.exercises.saveImage(image("i1", "fehlt", 0)),
          "not_found",
        );
      });

      it("entfernt ein einzelnes Bild", async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.exercises.saveImage(image("i1", "e1", 0));
        await repos.exercises.removeImage("i1");
        expect(await repos.exercises.listImages("e1")).toEqual([]);
      });
    });

    describe("PlanRepository", () => {
      beforeEach(async () => {
        await repos.exercises.save(exercise("e1"));
        await repos.exercises.save(exercise("e2"));
      });

      it("speichert Plan mit Einträgen und liefert sie nach Position sortiert", async () => {
        await repos.plans.save(plan("p1"), [
          planItem("pi2", "p1", "e2", 1),
          planItem("pi1", "p1", "e1", 0),
        ]);

        const loaded = await repos.plans.get("p1");
        expect(loaded?.plan.id).toBe("p1");
        expect(loaded?.items.map((i) => i.id)).toEqual(["pi1", "pi2"]);
      });

      it("liefert undefined für unbekannte Pläne", async () => {
        expect(await repos.plans.get("fehlt")).toBeUndefined();
      });

      it("ersetzt beim erneuten Speichern die Einträge", async () => {
        await repos.plans.save(plan("p1"), [planItem("pi1", "p1", "e1", 0)]);
        await repos.plans.save(plan("p1", { name: "Neu" }), [
          planItem("pi9", "p1", "e2", 0),
        ]);

        const loaded = await repos.plans.get("p1");
        expect(loaded?.plan.name).toBe("Neu");
        expect(loaded?.items.map((i) => i.id)).toEqual(["pi9"]);
      });

      it("sortiert die Liste nach Name und blendet Archivierte aus", async () => {
        await repos.plans.save(plan("p1", { name: "Beine" }), []);
        await repos.plans.save(plan("p2", { name: "Arme" }), []);
        await repos.plans.save(plan("p3", { name: "Alt", archivedAt: T0 }), []);

        expect((await repos.plans.list()).map((p) => p.name)).toEqual([
          "Arme",
          "Beine",
        ]);
        expect(await repos.plans.list({ includeArchived: true })).toHaveLength(
          3,
        );
      });

      it("Rollback: unbekannte Übung lässt den Altzustand unverändert", async () => {
        await repos.plans.save(plan("p1", { name: "Alt" }), [
          planItem("pi1", "p1", "e1", 0),
        ]);

        await expectCode(
          repos.plans.save(plan("p1", { name: "Neu" }), [
            planItem("pi2", "p1", "e2", 0),
            planItem("pi3", "p1", "gibt-es-nicht", 1),
          ]),
          "not_found",
        );

        const loaded = await repos.plans.get("p1");
        expect(loaded?.plan.name).toBe("Alt");
        expect(loaded?.items.map((i) => i.id)).toEqual(["pi1"]);
      });

      it("Rollback: fehlgeschlagenes Anlegen hinterlässt nichts", async () => {
        await expectCode(
          repos.plans.save(plan("p1"), [
            planItem("pi1", "p1", "gibt-es-nicht", 0),
          ]),
          "not_found",
        );
        expect(await repos.plans.get("p1")).toBeUndefined();
        expect(await repos.plans.list({ includeArchived: true })).toEqual([]);
      });

      it("Rollback: Eintrag mit fremder planId wird abgelehnt (invalid)", async () => {
        await repos.plans.save(plan("p1", { name: "Alt" }), [
          planItem("pi1", "p1", "e1", 0),
        ]);

        await expectCode(
          repos.plans.save(plan("p1", { name: "Neu" }), [
            planItem("pi2", "anderer-plan", "e1", 0),
          ]),
          "invalid",
        );

        const loaded = await repos.plans.get("p1");
        expect(loaded?.plan.name).toBe("Alt");
        expect(loaded?.items.map((i) => i.id)).toEqual(["pi1"]);
      });

      it("löscht einen Plan ohne Verlauf hart samt Einträgen", async () => {
        await repos.plans.save(plan("p1"), [planItem("pi1", "p1", "e1", 0)]);

        expect(await repos.plans.remove("p1")).toBe("deleted");
        expect(await repos.plans.get("p1")).toBeUndefined();
        // Die Übung ist danach nicht mehr durch den Plan referenziert.
        expect(await repos.exercises.remove("e1")).toBe("deleted");
      });

      it("archiviert einen Plan, auf den ein Workout verweist", async () => {
        await repos.plans.save(plan("p1"), [planItem("pi1", "p1", "e1", 0)]);
        await repos.workouts.start(workout("w1", { planId: "p1" }));

        expect(await repos.plans.remove("p1")).toBe("archived");
        expect((await repos.plans.get("p1"))?.plan.archivedAt).toBeDefined();
        expect(await repos.plans.list()).toEqual([]);
      });

      it("meldet not_found beim Löschen eines fehlenden Plans", async () => {
        await expectCode(repos.plans.remove("fehlt"), "not_found");
      });
    });

    describe("WorkoutRepository", () => {
      beforeEach(async () => {
        await repos.exercises.save(exercise("e1"));
      });

      it("startet ein Workout und findet es als offen", async () => {
        await repos.workouts.start(workout("w1"));
        expect((await repos.workouts.getOpen())?.id).toBe("w1");
      });

      it("erlaubt nur ein offenes Workout (conflict)", async () => {
        await repos.workouts.start(workout("w1"));
        await expectCode(
          repos.workouts.start(
            workout("w2", { startedAt: "2026-01-02T10:00:00.000Z" }),
          ),
          "conflict",
        );
        expect(await repos.workouts.get("w2")).toBeUndefined();
      });

      it("erlaubt erneutes Speichern desselben offenen Workouts", async () => {
        await repos.workouts.start(workout("w1"));
        await repos.workouts.start(workout("w1", { note: "aktualisiert" }));
        expect((await repos.workouts.get("w1"))?.workout.note).toBe(
          "aktualisiert",
        );
      });

      it("beendet ein Workout und erlaubt danach ein neues", async () => {
        await repos.workouts.start(workout("w1"));
        await repos.workouts.finish("w1", "2026-01-01T11:00:00.000Z");

        expect(await repos.workouts.getOpen()).toBeUndefined();
        expect((await repos.workouts.get("w1"))?.workout.endedAt).toBe(
          "2026-01-01T11:00:00.000Z",
        );
        await repos.workouts.start(
          workout("w2", { startedAt: "2026-01-02T10:00:00.000Z" }),
        );
        expect((await repos.workouts.getOpen())?.id).toBe("w2");
      });

      it("meldet not_found beim Beenden eines fehlenden Workouts", async () => {
        await expectCode(repos.workouts.finish("fehlt", T0), "not_found");
      });

      it("liefert Sätze nach Übungsreihenfolge und Satznummer", async () => {
        await repos.workouts.start(workout("w1"));
        await repos.workouts.saveSet(
          loggedSet("s3", "w1", "e1", { exerciseOrder: 1, setNumber: 1 }),
        );
        await repos.workouts.saveSet(
          loggedSet("s2", "w1", "e1", { exerciseOrder: 0, setNumber: 2 }),
        );
        await repos.workouts.saveSet(
          loggedSet("s1", "w1", "e1", { exerciseOrder: 0, setNumber: 1 }),
        );

        const loaded = await repos.workouts.get("w1");
        expect(loaded?.sets.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
      });

      it("liefert undefined für unbekannte Workouts", async () => {
        expect(await repos.workouts.get("fehlt")).toBeUndefined();
      });

      it("meldet not_found beim Satz eines fehlenden Workouts", async () => {
        await expectCode(
          repos.workouts.saveSet(loggedSet("s1", "fehlt", "e1")),
          "not_found",
        );
      });

      it("entfernt einzelne Sätze", async () => {
        await repos.workouts.start(workout("w1"));
        await repos.workouts.saveSet(loggedSet("s1", "w1", "e1"));
        await repos.workouts.removeSet("s1");
        expect((await repos.workouts.get("w1"))?.sets).toEqual([]);
      });

      it("listet Workouts neueste zuerst, mit limit und before", async () => {
        const days = ["01", "02", "03", "04"];
        for (const d of days) {
          await repos.workouts.start(
            workout(`w${d}`, {
              startedAt: `2026-01-${d}T10:00:00.000Z`,
              endedAt: `2026-01-${d}T11:00:00.000Z`,
            }),
          );
        }

        expect((await repos.workouts.list()).map((w) => w.id)).toEqual([
          "w04",
          "w03",
          "w02",
          "w01",
        ]);
        expect(
          (await repos.workouts.list({ limit: 2 })).map((w) => w.id),
        ).toEqual(["w04", "w03"]);
        expect(
          (
            await repos.workouts.list({ before: "2026-01-03T10:00:00.000Z" })
          ).map((w) => w.id),
        ).toEqual(["w02", "w01"]);
      });

      it("listet Sätze einer Übung über alle Workouts nach Zeit", async () => {
        await repos.exercises.save(exercise("e2"));
        await repos.workouts.start(
          workout("w1", { endedAt: "2026-01-01T11:00:00.000Z" }),
        );
        await repos.workouts.start(
          workout("w2", { startedAt: "2026-01-02T10:00:00.000Z" }),
        );
        await repos.workouts.saveSet(
          loggedSet("s2", "w2", "e1", { loggedAt: "2026-01-02T10:05:00.000Z" }),
        );
        await repos.workouts.saveSet(
          loggedSet("s1", "w1", "e1", { loggedAt: "2026-01-01T10:05:00.000Z" }),
        );
        await repos.workouts.saveSet(loggedSet("sx", "w1", "e2"));

        const ids = (await repos.workouts.listSetsByExercise("e1")).map(
          (s) => s.id,
        );
        expect(ids).toEqual(["s1", "s2"]);
      });

      it("löscht ein Workout samt Sätzen; die Übung wird danach frei", async () => {
        await repos.workouts.start(workout("w1"));
        await repos.workouts.saveSet(loggedSet("s1", "w1", "e1"));

        await repos.workouts.remove("w1");
        expect(await repos.workouts.get("w1")).toBeUndefined();
        expect(await repos.workouts.listSetsByExercise("e1")).toEqual([]);
        expect(await repos.exercises.remove("e1")).toBe("deleted");
      });

      it("meldet not_found beim Löschen eines fehlenden Workouts", async () => {
        await expectCode(repos.workouts.remove("fehlt"), "not_found");
      });
    });
  });
}
