import { DataError } from "../errors";
import type { ExerciseRepository } from "../repositories";
import { read, write } from "./database";
import type { TrainingDb } from "./schema";

function compareName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
}

export function createExerciseRepository(db: TrainingDb): ExerciseRepository {
  return {
    list: (opts) =>
      read(async () => {
        const all = await db.getAll("exercises");
        return all
          .filter((e) => opts?.includeArchived || e.archivedAt === undefined)
          .sort(compareName);
      }),

    get: (id) => read(() => db.get("exercises", id)),

    save: (exercise) =>
      write(db, ["exercises"], async (tx) => {
        await tx.objectStore("exercises").put(exercise);
      }),

    remove: (id) =>
      write(
        db,
        ["exercises", "exerciseImages", "planItems", "loggedSets"],
        async (tx) => {
          const exercise = await tx.objectStore("exercises").get(id);
          if (!exercise) {
            throw new DataError("not_found", `Übung ${id} nicht gefunden`);
          }
          const inPlans = await tx
            .objectStore("planItems")
            .index("exerciseId")
            .count(id);
          const inHistory = await tx
            .objectStore("loggedSets")
            .index("exerciseId")
            .count(id);

          if (inPlans > 0 || inHistory > 0) {
            await tx
              .objectStore("exercises")
              .put({ ...exercise, archivedAt: new Date().toISOString() });
            return "archived" as const;
          }

          const images = tx.objectStore("exerciseImages");
          for (const imageId of await images
            .index("exerciseId")
            .getAllKeys(id)) {
            await images.delete(imageId);
          }
          await tx.objectStore("exercises").delete(id);
          return "deleted" as const;
        },
      ),

    listImages: (exerciseId) =>
      read(async () => {
        const images = await db.getAllFromIndex(
          "exerciseImages",
          "exerciseId",
          exerciseId,
        );
        return images.sort((a, b) => a.sortOrder - b.sortOrder);
      }),

    saveImage: (image) =>
      write(db, ["exercises", "exerciseImages"], async (tx) => {
        const exists = await tx
          .objectStore("exercises")
          .count(image.exerciseId);
        if (exists === 0) {
          throw new DataError(
            "not_found",
            `Übung ${image.exerciseId} nicht gefunden`,
          );
        }
        await tx.objectStore("exerciseImages").put(image);
      }),

    removeImage: (id) =>
      write(db, ["exerciseImages"], async (tx) => {
        await tx.objectStore("exerciseImages").delete(id);
      }),
  };
}
