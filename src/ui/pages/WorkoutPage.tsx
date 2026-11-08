import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { nextSetNumber, prefillSetValues } from "../../domain";
import type { Exercise, LoggedSet, PlanItem, Workout } from "../../model";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";

interface SessionExercise {
  exercise: Exercise;
  targetSets: number;
  targetReps?: number;
  targetWeightKg?: number;
  targetDurationSec?: number;
  order: number;
}

interface SetFields {
  reps: string;
  weight: string;
  duration: string;
}

function isSetOverrides(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(
      (entry) =>
        typeof entry === "string" &&
        (entry === "" ||
          (Number.isInteger(Number(entry)) && Number(entry) >= 1)),
    )
  );
}

export function WorkoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exercises, plans, workouts } = useRepositories();
  const [workout, setWorkout] = useState<Workout>();
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [historyDefaults, setHistoryDefaults] = useState<
    Record<string, LoggedSet | undefined>
  >({});
  const [sessions, setSessions] = useState<SessionExercise[]>([]);
  const [setOverrides, setSetOverrides] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [addExerciseId, setAddExerciseId] = useState("");
  const [fieldOverrides, setFieldOverrides] = useState<{
    exerciseId: string;
    values: SetFields;
  }>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [savingSet, setSavingSet] = useState(false);

  const refresh = useCallback(async () => {
    await Promise.resolve();
    if (!id) {
      setMessage("Workout-ID fehlt.");
      setLoading(false);
      return;
    }
    try {
      const [detail, allExercises] = await Promise.all([
        workouts.get(id),
        exercises.list({ includeArchived: true }),
      ]);
      if (!detail) {
        setMessage("Das Workout wurde nicht gefunden.");
        return;
      }
      setWorkout(detail.workout);
      const savedOverrides = sessionStorage.getItem(
        `trainingapp.setOverrides.${detail.workout.id}`,
      );
      if (savedOverrides) {
        const parsed: unknown = JSON.parse(savedOverrides);
        if (!isSetOverrides(parsed)) {
          throw new Error("Die gespeicherte Satzanzahl ist ungültig.");
        }
        setSetOverrides(parsed);
      }
      const startedHere =
        sessionStorage.getItem("trainingapp.navigationWorkout") ===
        detail.workout.id;
      if (startedHere) {
        sessionStorage.removeItem("trainingapp.navigationWorkout");
      }
      setNeedsResume(!startedHere && detail.workout.endedAt === undefined);
      setFinished(detail.workout.endedAt !== undefined);
      setSets(detail.sets);
      setAvailable(allExercises);
      const sessionExercises: SessionExercise[] = [];
      if (detail.workout.planId) {
        const plan = await plans.get(detail.workout.planId);
        for (const item of plan?.items ?? []) {
          const exercise = allExercises.find((e) => e.id === item.exerciseId);
          if (exercise)
            sessionExercises.push(toSessionExercise(exercise, item));
        }
      } else {
        const unique = new Map<number, string>();
        for (const set of detail.sets)
          unique.set(set.exerciseOrder, set.exerciseId);
        for (const [order, exerciseId] of [...unique.entries()].sort(
          (a, b) => a[0] - b[0],
        )) {
          const exercise = allExercises.find((e) => e.id === exerciseId);
          if (exercise) {
            sessionExercises.push({
              exercise,
              targetSets: exercise.defaultSets ?? 3,
              order,
            });
          }
        }
      }
      const previousSets = await Promise.all(
        sessionExercises.map(async ({ exercise }) => {
          const history = await workouts.listSetsByExercise(exercise.id);
          return [exercise.id, history.at(-1)] as const;
        }),
      );
      setHistoryDefaults(Object.fromEntries(previousSets));
      setSessions(sessionExercises);
      const firstPending = sessionExercises.findIndex((entry) => {
        const count = detail.sets.filter(
          (set) => set.exerciseId === entry.exercise.id,
        ).length;
        return count < entry.targetSets;
      });
      setCurrent(firstPending === -1 ? 0 : firstPending);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : texts.common.loadFailed,
      );
    } finally {
      setLoading(false);
    }
  }, [exercises, id, plans, workouts]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const active = sessions[current];
  const activeSets = useMemo(
    () =>
      active ? sets.filter((set) => set.exerciseId === active.exercise.id) : [],
    [active, sets],
  );

  const lastSet = [...activeSets].sort((a, b) => b.setNumber - a.setNumber)[0];
  const previousSet = historyDefaults[active?.exercise.id ?? ""];
  const targetSetsValue = active
    ? (setOverrides[active.exercise.id] ?? String(active.targetSets))
    : "";
  const targetSets = Number(targetSetsValue);
  const defaults = active
    ? prefillSetValues(active.exercise, active, {
        ...previousSet,
        ...lastSet,
      })
    : {};
  const fields =
    active && fieldOverrides?.exerciseId === active.exercise.id
      ? fieldOverrides.values
      : {
          reps: defaults.reps?.toString() ?? "",
          weight: defaults.weightKg?.toString() ?? "",
          duration: defaults.durationSec?.toString() ?? "",
        };

  const addFreeExercise = async () => {
    const exercise = available.find((entry) => entry.id === addExerciseId);
    if (!exercise) return;
    if (sessions.some((entry) => entry.exercise.id === exercise.id)) {
      setMessage("Diese Übung ist bereits im Workout.");
      return;
    }
    const next: SessionExercise = {
      exercise,
      targetSets: exercise.defaultSets ?? 3,
      order: sessions.length,
    };
    try {
      const history = await workouts.listSetsByExercise(exercise.id);
      setHistoryDefaults((current) => ({
        ...current,
        [exercise.id]: history.at(-1),
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Frühere Satzwerte konnten nicht geladen werden.",
      );
      return;
    }
    setSessions((items) => [...items, next]);
    setCurrent(sessions.length);
    setAddExerciseId("");
    setMessage("");
  };

  const logSet = async () => {
    if (!workout || !active || savingSet) return;
    const reps = fields.reps.trim() ? Number(fields.reps) : undefined;
    const weightKg = fields.weight.trim() ? Number(fields.weight) : undefined;
    const durationSec = fields.duration.trim()
      ? Number(fields.duration)
      : undefined;
    if (
      reps === undefined &&
      weightKg === undefined &&
      durationSec === undefined
    ) {
      setMessage("Gib mindestens einen Satzwert ein.");
      return;
    }
    if (
      (reps !== undefined && (!Number.isInteger(reps) || reps < 1)) ||
      (weightKg !== undefined &&
        (!Number.isFinite(weightKg) || weightKg < 0)) ||
      (durationSec !== undefined &&
        (!Number.isInteger(durationSec) || durationSec < 1))
    ) {
      setMessage("Bitte prüfe Wiederholungen, Gewicht und Dauer.");
      return;
    }
    setSavingSet(true);
    try {
      const set: LoggedSet = {
        id: crypto.randomUUID(),
        workoutId: workout.id,
        exerciseId: active.exercise.id,
        exerciseNameSnapshot: active.exercise.name,
        exerciseOrder: active.order,
        setNumber: nextSetNumber(sets, active.exercise.id),
        ...(reps !== undefined ? { reps } : {}),
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(durationSec !== undefined ? { durationSec } : {}),
        loggedAt: new Date().toISOString(),
      };
      await workouts.saveSet(set);
      setSets((existing) => [...existing, set]);
      setMessage("Satz gespeichert.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Der Satz konnte nicht gespeichert werden.",
      );
    } finally {
      setSavingSet(false);
    }
  };

  const removeLastSet = async () => {
    const last = [...activeSets].sort((a, b) => b.setNumber - a.setNumber)[0];
    if (!last) return;
    try {
      await workouts.removeSet(last.id);
      setSets((existing) => existing.filter((set) => set.id !== last.id));
      setMessage("Der letzte Satz wurde entfernt.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Der Satz konnte nicht entfernt werden.",
      );
    }
  };

  const finish = async () => {
    if (!workout) return;
    try {
      await workouts.finish(workout.id, new Date().toISOString());
      setFinished(true);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Workout konnte nicht beendet werden.",
      );
    }
  };

  if (loading) return <p role="status">{texts.common.loading}</p>;
  if (finished) {
    return (
      <section className="card">
        <h1>Workout beendet</h1>
        <p>
          {sets.length} {sets.length === 1 ? "Satz" : "Sätze"} gespeichert.
        </p>
        <button className="button" onClick={() => navigate("/verlauf")}>
          Zum Verlauf
        </button>
      </section>
    );
  }
  if (!workout)
    return <p role="alert">{message || "Workout nicht verfügbar."}</p>;
  if (needsResume) {
    return (
      <section className="card recovery">
        <h1>Offenes Workout gefunden</h1>
        <p>
          Deine bereits gespeicherten Sätze sind sicher. Möchtest du fortsetzen
          oder das Workout beenden?
        </p>
        <div className="form-actions">
          <button className="button" onClick={() => setNeedsResume(false)}>
            Workout fortsetzen
          </button>
          <button
            className="button button-secondary"
            onClick={() => void finish()}
          >
            Workout beenden
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <h1>{workout.planNameSnapshot ?? "Freies Workout"}</h1>
      <p>
        Gestartet:{" "}
        {new Date(workout.startedAt).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {!workout.planId && (
        <section className="card">
          <h2>Übung hinzufügen</h2>
          <div className="form-actions">
            <label className="field">
              Übung
              <select
                value={addExerciseId}
                onChange={(event) => setAddExerciseId(event.target.value)}
              >
                <option value="">Auswählen</option>
                {available
                  .filter(
                    (exercise) =>
                      !sessions.some(
                        (entry) => entry.exercise.id === exercise.id,
                      ),
                  )
                  .map((exercise) => (
                    <option value={exercise.id} key={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button"
              onClick={addFreeExercise}
              disabled={!addExerciseId}
            >
              Hinzufügen
            </button>
          </div>
        </section>
      )}
      {!active ? (
        <p>Füge eine Übung hinzu, um loszulegen.</p>
      ) : (
        <section className="card editor" aria-labelledby="active-exercise">
          <p>
            Übung {current + 1} von {sessions.length}
          </p>
          <h2 id="active-exercise">{active.exercise.name}</h2>
          <p>
            {activeSets.length} von {targetSets} Sätzen
          </p>
          <label className="field">
            Sätze für dieses Workout
            <input
              aria-label="Sätze für dieses Workout"
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              value={targetSetsValue}
              onChange={(event) => {
                const next = {
                  ...setOverrides,
                  [active.exercise.id]: event.target.value,
                };
                setSetOverrides(next);
                try {
                  sessionStorage.setItem(
                    `trainingapp.setOverrides.${workout.id}`,
                    JSON.stringify(next),
                  );
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? `Satzanzahl konnte nicht dauerhaft gehalten werden: ${error.message}`
                      : "Satzanzahl konnte nicht dauerhaft gehalten werden.",
                  );
                }
              }}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Wiederholungen
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={fields.reps}
                onChange={(event) =>
                  setFieldOverrides({
                    exerciseId: active.exercise.id,
                    values: { ...fields, reps: event.target.value },
                  })
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
                value={fields.weight}
                onChange={(event) =>
                  setFieldOverrides({
                    exerciseId: active.exercise.id,
                    values: { ...fields, weight: event.target.value },
                  })
                }
              />
            </label>
            <label className="field">
              Dauer (Sekunden)
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={fields.duration}
                onChange={(event) =>
                  setFieldOverrides({
                    exerciseId: active.exercise.id,
                    values: { ...fields, duration: event.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              className="button"
              onClick={() => void logSet()}
              disabled={
                savingSet || !Number.isInteger(targetSets) || targetSets < 1
              }
            >
              {savingSet ? "Wird gespeichert …" : "Satz erledigt"}
            </button>
            <button
              className="button button-secondary"
              onClick={() => void removeLastSet()}
              disabled={activeSets.length === 0}
            >
              Letzten Satz entfernen
            </button>
          </div>
          {sessions.length > 1 && (
            <div className="form-actions">
              <button
                className="button button-secondary"
                onClick={() => setCurrent((index) => Math.max(0, index - 1))}
                disabled={current === 0}
              >
                Vorherige Übung
              </button>
              <button
                className="button button-secondary"
                onClick={() =>
                  setCurrent((index) =>
                    Math.min(sessions.length - 1, index + 1),
                  )
                }
                disabled={current === sessions.length - 1}
              >
                Nächste / überspringen
              </button>
            </div>
          )}
        </section>
      )}
      {message && <p role="status">{message}</p>}
      <div className="form-actions">
        <button
          className="button button-secondary"
          onClick={() => void finish()}
        >
          Workout beenden
        </button>
      </div>
    </>
  );
}

function toSessionExercise(
  exercise: Exercise,
  item: PlanItem,
): SessionExercise {
  return {
    exercise,
    targetSets: item.targetSets,
    ...(item.targetReps !== undefined ? { targetReps: item.targetReps } : {}),
    ...(item.targetWeightKg !== undefined
      ? { targetWeightKg: item.targetWeightKg }
      : {}),
    ...(item.targetDurationSec !== undefined
      ? { targetDurationSec: item.targetDurationSec }
      : {}),
    order: item.position,
  };
}
