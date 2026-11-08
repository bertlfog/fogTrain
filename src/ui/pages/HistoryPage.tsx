import { useCallback, useEffect, useMemo, useState } from "react";

import { exerciseProgress, workoutVolume } from "../../domain";
import type { Exercise, LoggedSet, Workout } from "../../model";
import { EmptyState } from "../EmptyState";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function HistoryPage() {
  const { exercises, workouts } = useRepositories();
  const [list, setList] = useState<Workout[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<string>();
  const [detail, setDetail] = useState<{
    workout: Workout;
    sets: LoggedSet[];
  }>();
  const [selectedExercise, setSelectedExercise] = useState("");
  const [progressData, setProgressData] = useState<{
    exerciseId: string;
    sets: LoggedSet[];
  }>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [savedWorkouts, savedExercises] = await Promise.all([
        workouts.list({ limit: 50 }),
        exercises.list({ includeArchived: true }),
      ]);
      setList(savedWorkouts.filter((workout) => workout.endedAt));
      setHasMore(savedWorkouts.length === 50);
      setExerciseList(savedExercises);
      setLoading(false);
      const values = await Promise.all(
        savedWorkouts.map(
          async (workout) =>
            [
              workout.id,
              (await workouts.get(workout.id))?.sets.length ?? 0,
            ] as const,
        ),
      );
      setCounts(Object.fromEntries(values));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : texts.common.loadFailed,
      );
      setLoading(false);
    }
  }, [exercises, workouts]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const openWorkout = async (id: string) => {
    setSelectedWorkout(id);
    setMessage("");
    try {
      const found = await workouts.get(id);
      if (!found) {
        setMessage("Das Workout wurde nicht gefunden.");
        return;
      }
      setDetail(found);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Der Verlauf konnte nicht geladen werden.",
      );
    }
  };

  const loadOlder = async () => {
    const before = list.at(-1)?.startedAt;
    if (!before || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await workouts.list({ limit: 50, before });
      setList((current) => [
        ...current,
        ...older.filter(
          (workout) =>
            workout.endedAt &&
            !current.some((existing) => existing.id === workout.id),
        ),
      ]);
      setHasMore(older.length === 50);
      const values = await Promise.all(
        older.map(
          async (workout) =>
            [
              workout.id,
              (await workouts.get(workout.id))?.sets.length ?? 0,
            ] as const,
        ),
      );
      setCounts((current) => ({ ...current, ...Object.fromEntries(values) }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ältere Workouts konnten nicht geladen werden.",
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const updateSet = (
    id: string,
    key: "reps" | "weightKg" | "durationSec",
    raw: string,
  ) => {
    if (!detail) return;
    setDetail({
      ...detail,
      sets: detail.sets.map((set) => {
        if (set.id !== id) return set;
        if (raw === "") {
          return { ...set, [key]: undefined };
        }
        return { ...set, [key]: Number(raw) };
      }),
    });
  };

  const saveSet = async (set: LoggedSet) => {
    if (
      [set.reps, set.weightKg, set.durationSec].every(
        (value) => value === undefined,
      ) ||
      (set.reps !== undefined &&
        (!Number.isInteger(set.reps) || set.reps < 1)) ||
      (set.weightKg !== undefined &&
        (!Number.isFinite(set.weightKg) || set.weightKg < 0)) ||
      (set.durationSec !== undefined &&
        (!Number.isInteger(set.durationSec) || set.durationSec < 1))
    ) {
      setMessage("Bitte gib mindestens einen gültigen Satzwert ein.");
      return;
    }
    try {
      await workouts.saveSet(set);
      setMessage("Satzänderung gespeichert.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Änderung fehlgeschlagen.",
      );
    }
  };

  const deleteSet = async (set: LoggedSet) => {
    if (!detail) return;
    try {
      await workouts.removeSet(set.id);
      setDetail({
        ...detail,
        sets: detail.sets.filter((entry) => entry.id !== set.id),
      });
      setCounts((current) => ({
        ...current,
        [detail.workout.id]: Math.max(0, (current[detail.workout.id] ?? 1) - 1),
      }));
      setMessage("Satz gelöscht.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Der Satz konnte nicht gelöscht werden.",
      );
    }
  };

  const deleteWorkout = async () => {
    if (
      !detail ||
      !window.confirm("Workout und alle zugehörigen Sätze löschen?")
    )
      return;
    try {
      await workouts.remove(detail.workout.id);
      setDetail(undefined);
      setSelectedWorkout(undefined);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Workout konnte nicht gelöscht werden.",
      );
    }
  };

  useEffect(() => {
    if (!selectedExercise) return;
    let active = true;
    workouts.listSetsByExercise(selectedExercise).then(
      (values) => {
        if (active)
          setProgressData({ exerciseId: selectedExercise, sets: values });
      },
      (error: unknown) => {
        if (active)
          setMessage(
            error instanceof Error ? error.message : texts.common.loadFailed,
          );
      },
    );
    return () => {
      active = false;
    };
  }, [selectedExercise, workouts]);

  const progressSets = useMemo(
    () =>
      progressData?.exerciseId === selectedExercise ? progressData.sets : [],
    [progressData, selectedExercise],
  );
  const progress = useMemo(() => {
    const records = exerciseProgress(progressSets);
    const workoutDates = new Map(
      list.map((workout) => [workout.id, workout.startedAt.slice(0, 10)]),
    );
    const grouped = new Map<string, LoggedSet[]>();
    for (const set of progressSets) {
      const values = grouped.get(set.workoutId) ?? [];
      values.push(set);
      grouped.set(set.workoutId, values);
    }
    const dateByOrder = [...grouped.entries()]
      .map(([id, sets]) => ({
        date: workoutDates.get(id) ?? sets[0]?.loggedAt.slice(0, 10) ?? "",
        sets,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return records.map((record, index) => ({
      ...record,
      date: dateByOrder[index]?.date ?? record.date,
    }));
  }, [list, progressSets]);

  const chartPoints = progress.filter(
    (record) => record.bestWeightKg !== undefined,
  );
  const chartWidth = Math.max(320, chartPoints.length * 56);
  const weights = chartPoints.map((record) => record.bestWeightKg ?? 0);
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 1;
  const points = chartPoints
    .map((record, index) => {
      const weight = record.bestWeightKg ?? 0;
      const y =
        150 - ((weight - minWeight) / (maxWeight - minWeight || 1)) * 120;
      return `${30 + index * 56},${y}`;
    })
    .join(" ");

  return (
    <>
      <h1>{texts.history.title}</h1>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">{texts.common.loading}</p>
      ) : list.length === 0 ? (
        <EmptyState
          title={texts.history.emptyTitle}
          hint={texts.history.emptyHint}
        />
      ) : (
        <>
          <p>{texts.history.count(list.length)} · neueste zuerst</p>
          <ul className="list">
            {list.map((workout) => (
              <li className="record" key={workout.id}>
                <button
                  className="text-button"
                  onClick={() => void openWorkout(workout.id)}
                >
                  <strong>
                    {workout.planNameSnapshot ?? "Freies Workout"}
                  </strong>
                  <span>{formatDate(workout.startedAt)}</span>
                  <span>{counts[workout.id] ?? "…"} Sätze</span>
                </button>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              className="button button-secondary"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
            >
              {loadingOlder ? "Wird geladen …" : "Ältere Workouts laden"}
            </button>
          )}
        </>
      )}
      {detail && selectedWorkout === detail.workout.id && (
        <section className="card editor" aria-labelledby="workout-detail-title">
          <h2 id="workout-detail-title">
            {detail.workout.planNameSnapshot ?? "Freies Workout"}
          </h2>
          <p>
            {formatDate(detail.workout.startedAt)} · {detail.sets.length} Sätze
            · Volumen {workoutVolume(detail.sets).toLocaleString("de-DE")}{" "}
            kg·Wdh.
          </p>
          <ul className="list">
            {detail.sets.map((set) => (
              <li className="set-row" key={set.id}>
                <strong>
                  {set.exerciseNameSnapshot} · Satz {set.setNumber}
                </strong>
                <div className="form-grid">
                  <label className="field">
                    Wiederholungen
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={set.reps ?? ""}
                      onChange={(event) =>
                        updateSet(set.id, "reps", event.target.value)
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
                      value={set.weightKg ?? ""}
                      onChange={(event) =>
                        updateSet(set.id, "weightKg", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    Dauer (s)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={set.durationSec ?? ""}
                      onChange={(event) =>
                        updateSet(set.id, "durationSec", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => void saveSet(set)}
                  >
                    Änderung speichern
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => void deleteSet(set)}
                  >
                    Satz löschen
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            className="button button-secondary"
            onClick={() => void deleteWorkout()}
          >
            Workout löschen
          </button>
        </section>
      )}
      <section
        className="card progress-section"
        aria-labelledby="progress-title"
      >
        <h2 id="progress-title">Fortschritt</h2>
        <label className="field">
          Übung auswählen
          <select
            value={selectedExercise}
            onChange={(event) => setSelectedExercise(event.target.value)}
          >
            <option value="">Übung auswählen</option>
            {exerciseList.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
                {exercise.archivedAt ? " (archiviert)" : ""}
              </option>
            ))}
          </select>
        </label>
        {selectedExercise &&
          (progress.length === 0 ? (
            <p>Noch keine Satzdaten für diese Übung.</p>
          ) : (
            <>
              <div className="chart-scroll">
                <svg
                  className="progress-chart"
                  role="img"
                  aria-label="Liniendiagramm des besten Gewichts pro Workout"
                  viewBox={`0 0 ${chartWidth} 180`}
                >
                  <line
                    x1="20"
                    y1="150"
                    x2={chartWidth - 10}
                    y2="150"
                    stroke="currentColor"
                  />
                  {chartPoints.length > 1 && (
                    <polyline
                      points={points}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="3"
                    />
                  )}
                  {chartPoints.map((record, index) => {
                    const weight = record.bestWeightKg ?? 0;
                    const y =
                      150 -
                      ((weight - minWeight) / (maxWeight - minWeight || 1)) *
                        120;
                    return (
                      <circle
                        key={`${record.date}-${index}`}
                        cx={30 + index * 56}
                        cy={y}
                        r="5"
                        fill="var(--primary)"
                      />
                    );
                  })}
                </svg>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Bester Satz (kg × Wdh.)</th>
                    <th>Volumen (kg·Wdh.)</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((record, index) => {
                    return (
                      <tr key={`${record.date}-${index}`}>
                        <td>{record.date}</td>
                        <td>
                          {record.bestWeightKg ?? "–"} ×{" "}
                          {record.bestReps ?? "–"}
                        </td>
                        <td>{record.volume.toLocaleString("de-DE")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ))}
      </section>
    </>
  );
}
