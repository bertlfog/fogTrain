import { DataError } from "../errors";
import type { PlanRepository } from "../repositories";
import { read, write } from "./database";
import type { TrainingDb } from "./schema";

function compareName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
}

export function createPlanRepository(db: TrainingDb): PlanRepository {
  return {
    list: (opts) =>
      read(async () => {
        const all = await db.getAll("plans");
        return all
          .filter((p) => opts?.includeArchived || p.archivedAt === undefined)
          .sort(compareName);
      }),

    get: (id) =>
      read(async () => {
        // Eine Lese-Transaktion über beide Stores: konsistenter Schnappschuss.
        const tx = db.transaction(["plans", "planItems"], "readonly");
        const plan = await tx.objectStore("plans").get(id);
        if (!plan) {
          return undefined;
        }
        const items = await tx
          .objectStore("planItems")
          .index("planId")
          .getAll(id);
        await tx.done;
        return { plan, items: items.sort((a, b) => a.position - b.position) };
      }),

    save: (plan, items) =>
      write(db, ["plans", "planItems", "exercises"], async (tx) => {
        for (const item of items) {
          if (item.planId !== plan.id) {
            throw new DataError(
              "invalid",
              `Planeintrag ${item.id} gehört nicht zu Plan ${plan.id}`,
            );
          }
        }

        const itemStore = tx.objectStore("planItems");
        for (const oldKey of await itemStore
          .index("planId")
          .getAllKeys(plan.id)) {
          await itemStore.delete(oldKey);
        }
        await tx.objectStore("plans").put(plan);

        const exercises = tx.objectStore("exercises");
        for (const item of items) {
          // Schlägt dies mitten im Speichern fehl, bricht `write` die ganze
          // Transaktion ab: Plan und alte Einträge bleiben wie vorher.
          if ((await exercises.count(item.exerciseId)) === 0) {
            throw new DataError(
              "not_found",
              `Übung ${item.exerciseId} nicht gefunden`,
            );
          }
          await itemStore.put(item);
        }
      }),

    remove: (id) =>
      write(db, ["plans", "planItems", "workouts"], async (tx) => {
        const plan = await tx.objectStore("plans").get(id);
        if (!plan) {
          throw new DataError("not_found", `Plan ${id} nicht gefunden`);
        }
        const inHistory = await tx
          .objectStore("workouts")
          .index("planId")
          .count(id);

        if (inHistory > 0) {
          await tx
            .objectStore("plans")
            .put({ ...plan, archivedAt: new Date().toISOString() });
          return "archived" as const;
        }

        const itemStore = tx.objectStore("planItems");
        for (const key of await itemStore.index("planId").getAllKeys(id)) {
          await itemStore.delete(key);
        }
        await tx.objectStore("plans").delete(id);
        return "deleted" as const;
      }),
  };
}
