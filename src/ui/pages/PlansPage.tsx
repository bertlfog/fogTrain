import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  createPlanItem,
  normalizePlanItems,
  validatePlanName,
} from "../../domain";
import type { Exercise, Plan, PlanItem } from "../../model";
import { EmptyState } from "../EmptyState";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";

export function PlansPage() {
  const { plans, exercises } = useRepositories();
  const [list, setList] = useState<Plan[]>([]);
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [editing, setEditing] = useState<Plan | undefined>();
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [savedPlans, savedExercises] = await Promise.all([
        plans.list(),
        exercises.list(),
      ]);
      setList(savedPlans);
      setAvailable(savedExercises);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : texts.common.loadFailed,
      );
    } finally {
      setLoading(false);
    }
  }, [exercises, plans]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const begin = async (plan?: Plan) => {
    setMessage("");
    if (!plan) {
      const now = new Date().toISOString();
      const fresh: Plan = {
        id: crypto.randomUUID(),
        name: "",
        createdAt: now,
        updatedAt: now,
      };
      setEditing(fresh);
      setIsNew(true);
      setName("");
      setItems([]);
      return;
    }
    const detail = await plans.get(plan.id);
    if (!detail) {
      setMessage("Der Plan wurde nicht gefunden.");
      return;
    }
    setEditing(detail.plan);
    setIsNew(false);
    setName(detail.plan.name);
    setItems(detail.items);
  };

  const toggleExercise = (exercise: Exercise, checked: boolean) => {
    if (!editing) return;
    setItems((current) =>
      checked
        ? normalizePlanItems([
            ...current,
            createPlanItem(editing.id, exercise, current.length),
          ])
        : normalizePlanItems(
            current.filter((item) => item.exerciseId !== exercise.id),
          ),
    );
  };

  const updateItem = (
    id: string,
    key: "targetSets" | "targetReps" | "targetWeightKg" | "targetDurationSec",
    raw: string,
  ) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (raw === "" && key !== "targetSets") {
          return { ...item, [key]: undefined };
        }
        return { ...item, [key]: Number(raw) };
      }),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const errors = validatePlanName(name);
    if (errors.length) {
      setMessage(errors.join(" "));
      return;
    }
    if (
      items.some(
        (item) => !Number.isInteger(item.targetSets) || item.targetSets < 1,
      )
    ) {
      setMessage("Jede Übung benötigt mindestens einen Satz.");
      return;
    }
    try {
      await plans.save(
        { ...editing, name: name.trim(), updatedAt: new Date().toISOString() },
        normalizePlanItems(items),
      );
      setEditing(undefined);
      setIsNew(false);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Der Plan konnte nicht gespeichert werden.",
      );
    }
  };

  const remove = async (plan: Plan) => {
    if (!window.confirm(`Plan „${plan.name}“ wirklich löschen?`)) return;
    try {
      const result = await plans.remove(plan.id);
      setMessage(
        result === "archived"
          ? "Der Plan wurde archiviert, weil Workouts darauf verweisen."
          : "Der Plan wurde gelöscht.",
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Löschen fehlgeschlagen.",
      );
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= items.length) return;
    const reordered = [...items];
    const currentItem = reordered[index];
    const destinationItem = reordered[destination];
    if (!currentItem || !destinationItem) return;
    reordered[index] = destinationItem;
    reordered[destination] = currentItem;
    setItems(normalizePlanItems(reordered));
  };

  return (
    <>
      <h1>{texts.plans.title}</h1>
      <button className="button" onClick={() => void begin()}>
        Neuer Plan
      </button>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">{texts.common.loading}</p>
      ) : list.length === 0 ? (
        <EmptyState
          title={texts.plans.emptyTitle}
          hint={texts.plans.emptyHint}
        />
      ) : (
        <ul className="list">
          {list.map((plan) => (
            <li className="record" key={plan.id}>
              <span>{plan.name}</span>
              <button
                className="button button-secondary"
                onClick={() => void begin(plan)}
              >
                Bearbeiten
              </button>
              <button
                className="button button-secondary"
                onClick={() => void remove(plan)}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <section className="card editor" aria-labelledby="plan-editor-title">
          <h2 id="plan-editor-title">
            {isNew ? "Neuer Plan" : "Plan bearbeiten"}
          </h2>
          <form onSubmit={(event) => void submit(event)}>
            <label className="field">
              Planname
              <input
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <fieldset>
              <legend>Übungen auswählen</legend>
              {available.length === 0 ? (
                <p>Lege zuerst Übungen an.</p>
              ) : (
                available.map((exercise) => (
                  <label className="check-row" key={exercise.id}>
                    <input
                      type="checkbox"
                      checked={items.some(
                        (item) => item.exerciseId === exercise.id,
                      )}
                      onChange={(event) =>
                        toggleExercise(exercise, event.target.checked)
                      }
                    />
                    {exercise.name}
                  </label>
                ))
              )}
            </fieldset>
            <h3>Reihenfolge und Soll-Werte</h3>
            <ol className="plan-editor-list">
              {items.map((item, index) => (
                <li className="card plan-item" key={item.id}>
                  <strong>
                    {available.find(
                      (exercise) => exercise.id === item.exerciseId,
                    )?.name ?? "Archivierte Übung"}
                  </strong>
                  <div className="form-grid">
                    <label className="field">
                      Sätze
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.targetSets}
                        onChange={(event) =>
                          updateItem(item.id, "targetSets", event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Wiederholungen
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.targetReps ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, "targetReps", event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Gewicht (kg)
                      <input
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.25"
                        value={item.targetWeightKg ?? ""}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "targetWeightKg",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      Dauer (Sekunden)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.targetDurationSec ?? ""}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "targetDurationSec",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      aria-label="Nach oben"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      aria-label="Nach unten"
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          normalizePlanItems(
                            current.filter((entry) => entry.id !== item.id),
                          ),
                        )
                      }
                    >
                      Entfernen
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <p className="form-actions">
              <button className="button" type="submit">
                Speichern
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setEditing(undefined)}
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
