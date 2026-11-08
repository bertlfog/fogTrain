import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { validateExercise } from "../../domain";
import type { Exercise } from "../../model";
import { EmptyState } from "../EmptyState";
import { useRepositories } from "../RepositoryContext";
import { resizeImage } from "../imageProcessing";
import { texts } from "../texts";

interface Fields {
  name: string;
  description: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
}

const blank: Fields = {
  name: "",
  description: "",
  sets: "",
  reps: "",
  weight: "",
  duration: "",
};

const numberOrUndefined = (value: string): number | undefined =>
  value.trim() === "" ? undefined : Number(value);

export function ExercisesPage() {
  const { exercises } = useRepositories();
  const [list, setList] = useState<Exercise[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Exercise | "new" | undefined>();
  const [fields, setFields] = useState<Fields>(blank);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [currentImages, setCurrentImages] = useState<
    Array<{ id: string; url: string }>
  >([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const current = await exercises.list();
      const imageResults = await Promise.all(
        current.map(async (exercise) => {
          const [image] = await exercises.listImages(exercise.id);
          return image ? [exercise.id, URL.createObjectURL(image.data)] : null;
        }),
      );
      setList(current);
      setImages(
        Object.fromEntries(
          imageResults.filter(
            (entry): entry is [string, string] => entry !== null,
          ),
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : texts.common.loadFailed,
      );
    } finally {
      setLoading(false);
    }
  }, [exercises]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(
    () => () => {
      Object.values(images).forEach(URL.revokeObjectURL);
    },
    [images],
  );

  const openEditor = async (exercise?: Exercise) => {
    currentImages.forEach((image) => URL.revokeObjectURL(image.url));
    setEditing(exercise ?? "new");
    setFields(
      exercise
        ? {
            name: exercise.name,
            description: exercise.description,
            sets: exercise.defaultSets?.toString() ?? "",
            reps: exercise.defaultReps?.toString() ?? "",
            weight: exercise.defaultWeightKg?.toString() ?? "",
            duration: exercise.defaultDurationSec?.toString() ?? "",
          }
        : blank,
    );
    setSelectedImages([]);
    setMessage("");
    if (exercise) {
      try {
        const existing = await exercises.listImages(exercise.id);
        setCurrentImages(
          existing.map((image) => ({
            id: image.id,
            url: URL.createObjectURL(image.data),
          })),
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Übungsbilder konnten nicht geladen werden.",
        );
      }
    } else {
      setCurrentImages([]);
    }
  };

  const closeEditor = () => {
    currentImages.forEach((image) => URL.revokeObjectURL(image.url));
    setCurrentImages([]);
    setEditing(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      name: fields.name.trim(),
      description: fields.description,
      defaultSets: numberOrUndefined(fields.sets),
      defaultReps: numberOrUndefined(fields.reps),
      defaultWeightKg: numberOrUndefined(fields.weight),
      defaultDurationSec: numberOrUndefined(fields.duration),
    };
    const errors = validateExercise(input);
    if (errors.length) {
      setMessage(errors.join(" "));
      return;
    }
    try {
      const resizedImages = await Promise.all(selectedImages.map(resizeImage));
      const now = new Date().toISOString();
      const exercise: Exercise =
        editing && editing !== "new"
          ? {
              ...editing,
              ...input,
              updatedAt: now,
            }
          : {
              id: crypto.randomUUID(),
              ...input,
              createdAt: now,
              updatedAt: now,
            };
      await exercises.save(exercise);
      const existing = await exercises.listImages(exercise.id);
      for (const [index, data] of resizedImages.entries()) {
        await exercises.saveImage({
          id: crypto.randomUUID(),
          exerciseId: exercise.id,
          mimeType: data.type,
          data,
          sortOrder: existing.length + index,
          createdAt: new Date().toISOString(),
        });
      }
      closeEditor();
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Die Übung konnte nicht gespeichert werden.",
      );
    }
  };

  const remove = async (exercise: Exercise) => {
    if (!window.confirm(`„${exercise.name}“ wirklich löschen?`)) return;
    try {
      const result = await exercises.remove(exercise.id);
      setMessage(
        result === "archived"
          ? "Die Übung wird wegen vorhandener Pläne oder Workouts archiviert."
          : "Die Übung wurde gelöscht.",
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Löschen fehlgeschlagen.",
      );
    }
  };

  const visible = list.filter((exercise) =>
    exercise.name
      .toLocaleLowerCase("de")
      .includes(query.toLocaleLowerCase("de")),
  );

  return (
    <>
      <h1>{texts.exercises.title}</h1>
      <button className="button" onClick={() => void openEditor()}>
        Neue Übung
      </button>
      <label className="field">
        Suche nach Name
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">{texts.common.loading}</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={texts.exercises.emptyTitle}
          hint={texts.exercises.emptyHint}
        />
      ) : (
        <ul className="list">
          {visible.map((exercise) => (
            <li className="record" key={exercise.id}>
              {images[exercise.id] && (
                <img
                  className="exercise-thumb"
                  src={images[exercise.id]}
                  alt=""
                />
              )}
              <span>{exercise.name}</span>
              <button
                className="button button-secondary"
                onClick={() => void openEditor(exercise)}
              >
                Bearbeiten
              </button>
              <button
                className="button button-secondary"
                onClick={() => void remove(exercise)}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <section
          className="card editor"
          aria-labelledby="exercise-editor-title"
        >
          <h2 id="exercise-editor-title">
            {editing === "new" ? "Neue Übung" : "Übung bearbeiten"}
          </h2>
          <form onSubmit={(event) => void submit(event)}>
            <label className="field">
              Name
              <input
                required
                maxLength={100}
                value={fields.name}
                onChange={(event) =>
                  setFields({ ...fields, name: event.target.value })
                }
              />
            </label>
            <label className="field">
              Kurzbeschreibung
              <textarea
                maxLength={2000}
                value={fields.description}
                onChange={(event) =>
                  setFields({ ...fields, description: event.target.value })
                }
              />
            </label>
            <label className="field">
              Standard-Sätze
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={fields.sets}
                onChange={(event) =>
                  setFields({ ...fields, sets: event.target.value })
                }
              />
            </label>
            <label className="field">
              Standard-Wiederholungen
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={fields.reps}
                onChange={(event) =>
                  setFields({ ...fields, reps: event.target.value })
                }
              />
            </label>
            <label className="field">
              Standard-Gewicht (kg)
              <input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.25"
                value={fields.weight}
                onChange={(event) =>
                  setFields({ ...fields, weight: event.target.value })
                }
              />
            </label>
            <label className="field">
              Standard-Dauer (Sekunden)
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={fields.duration}
                onChange={(event) =>
                  setFields({ ...fields, duration: event.target.value })
                }
              />
            </label>
            <label className="field">
              Bilder hinzufügen
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setSelectedImages(Array.from(event.target.files ?? []))
                }
              />
            </label>
            <div className="image-list">
              {currentImages.map((image) => (
                <figure key={image.id}>
                  <img src={image.url} alt="Übungsbild" />
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await exercises.removeImage(image.id);
                        URL.revokeObjectURL(image.url);
                        setCurrentImages((items) =>
                          items.filter((item) => item.id !== image.id),
                        );
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Das Bild konnte nicht entfernt werden.",
                        );
                      }
                    }}
                  >
                    Bild entfernen
                  </button>
                </figure>
              ))}
            </div>
            <p className="form-actions">
              <button className="button" type="submit">
                Speichern
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={closeEditor}
              >
                Abbrechen
              </button>
            </p>
          </form>
        </section>
      )}
    </>
  );
}
