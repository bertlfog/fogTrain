import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { exerciseProgress, workoutVolume } from "../../domain";
import type { Exercise, LoggedSet, Workout } from "../../model";
import { EmptyState } from "../EmptyState";
import { NumberField } from "../NumberInput";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatSetPerformance = (set: LoggedSet) => {
  const strength = [
    set.weightKg !== undefined
      ? `${set.weightKg.toLocaleString("de-DE")} kg`
      : undefined,
    set.reps !== undefined ? `${set.reps} Wdh.` : undefined,
  ]
    .filter((value) => value !== undefined)
    .join(" × ");
  const duration =
    set.durationSec !== undefined ? `${set.durationSec} s` : undefined;
  return (
    [strength || undefined, duration]
      .filter((value) => value !== undefined)
      .join(" · ") || "–"
  );
};

const groupSetsByExercise = (sets: LoggedSet[]) => {
  const groups = new Map<
    string,
    { id: string; name: string; order: number; sets: LoggedSet[] }
  >();
  for (const set of sets) {
    const group = groups.get(set.exerciseId);
    if (group) {
      group.sets.push(set);
    } else {
      groups.set(set.exerciseId, {
        id: set.exerciseId,
        name: set.exerciseNameSnapshot,
        order: set.exerciseOrder,
        sets: [set],
      });
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      sets: group.sets.sort((a, b) => a.setNumber - b.setNumber),
    }))
    .sort((a, b) => a.order - b.order);
};

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
  const [editingSet, setEditingSet] = useState<LoggedSet>();
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
    setEditingSet(undefined);
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

  const updateEditingSet = (
    id: string,
    key: "reps" | "weightKg" | "durationSec",
    raw: string,
  ) => {
    setEditingSet((current) => {
      if (!current || current.id !== id) return current;
      if (raw === "") {
        return { ...current, [key]: undefined };
      }
      return { ...current, [key]: Number(raw) };
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
      setDetail((current) =>
        current
          ? {
              ...current,
              sets: current.sets.map((entry) =>
                entry.id === set.id ? set : entry,
              ),
            }
          : current,
      );
      setEditingSet(undefined);
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
      if (editingSet?.id === set.id) setEditingSet(undefined);
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
      setEditingSet(undefined);
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
          <div className="workout-set-groups">
            {groupSetsByExercise(detail.sets).map((group) => (
              <section className="workout-set-group" key={group.id}>
                <h3>{group.name}</h3>
                <table
                  className="workout-set-table"
                  aria-label={`Sätze für ${group.name}`}
                >
                  <thead>
                    <tr>
                      <th scope="col">Satz</th>
                      <th scope="col">Leistung</th>
                      <th scope="col">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sets.map((set) => (
                      <Fragment key={set.id}>
                        <tr>
                          <th scope="row">Satz {set.setNumber}</th>
                          <td>{formatSetPerformance(set)}</td>
                          <td>
                            <div className="workout-set-actions">
                              <button
                                className="button button-secondary"
                                onClick={() => setEditingSet({ ...set })}
                                disabled={editingSet !== undefined}
                                aria-label={`Satz ${set.setNumber} bearbeiten`}
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M4 20l4.5-1L19 8.5a2.1 2.1 0 0 0-3-3L5.5 16z" />
                                </svg>
                              </button>
                              <button
                                className="button button-secondary"
                                onClick={() => void deleteSet(set)}
                                aria-label={`Satz ${set.setNumber} löschen`}
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingSet?.id === set.id && (
                          <tr>
                            <td colSpan={3}>
                              <div className="workout-set-edit">
                                <div className="form-grid">
                                  <NumberField
                                    label="Wiederholungen"
                                    min="1"
                                    step="1"
                                    value={editingSet.reps ?? ""}
                                    onValueChange={(value) =>
                                      updateEditingSet(set.id, "reps", value)
                                    }
                                  />
                                  <NumberField
                                    label="Gewicht (kg)"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.25"
                                    value={editingSet.weightKg ?? ""}
                                    onValueChange={(value) =>
                                      updateEditingSet(
                                        set.id,
                                        "weightKg",
                                        value,
                                      )
                                    }
                                  />
                                  <NumberField
                                    label="Dauer (s)"
                                    min="1"
                                    step="1"
                                    value={editingSet.durationSec ?? ""}
                                    onValueChange={(value) =>
                                      updateEditingSet(
                                        set.id,
                                        "durationSec",
                                        value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="form-actions">
                                  <button
                                    className="button"
                                    onClick={() => void saveSet(editingSet)}
                                  >
                                    Änderung speichern
                                  </button>
                                  <button
                                    className="button button-secondary"
                                    onClick={() => setEditingSet(undefined)}
                                  >
                                    Abbrechen
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
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
