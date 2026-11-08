import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import type { Plan, Workout } from "../../model";
import { EmptyState } from "../EmptyState";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";

export function StartPage() {
  const { plans, workouts } = useRepositories();
  const navigate = useNavigate();
  const [list, setList] = useState<Plan[]>([]);
  const [open, setOpen] = useState<Workout>();
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [savedPlans, openWorkout] = await Promise.all([
        plans.list(),
        workouts.getOpen(),
      ]);
      setList(savedPlans);
      setOpen(openWorkout);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : texts.common.loadFailed,
      );
    }
  }, [plans, workouts]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const start = async (plan?: Plan) => {
    try {
      const now = new Date().toISOString();
      const workout: Workout = {
        id: crypto.randomUUID(),
        ...(plan ? { planId: plan.id, planNameSnapshot: plan.name } : {}),
        startedAt: now,
      };
      await workouts.start(workout);
      sessionStorage.setItem("trainingapp.navigationWorkout", workout.id);
      navigate(`/training/${workout.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Workout konnte nicht gestartet werden.",
      );
    }
  };

  const finishOpen = async () => {
    if (!open) return;
    try {
      await workouts.finish(open.id, new Date().toISOString());
      await refresh();
      setMessage("Das offene Workout wurde beendet.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Workout konnte nicht beendet werden.",
      );
    }
  };

  return (
    <>
      <h1>{texts.start.title}</h1>
      {message && <p role="status">{message}</p>}
      {open && (
        <section className="card recovery" aria-labelledby="recovery-title">
          <h2 id="recovery-title">Offenes Workout</h2>
          <p>
            {open.planNameSnapshot ?? "Freies Workout"} · gestartet{" "}
            {new Date(open.startedAt).toLocaleString("de-DE")}
          </p>
          <div className="form-actions">
            <button
              className="button"
              onClick={() => navigate(`/training/${open.id}`)}
            >
              Fortsetzen
            </button>
            <button
              className="button button-secondary"
              onClick={() => void finishOpen()}
            >
              Beenden
            </button>
          </div>
        </section>
      )}
      {list.length === 0 ? (
        <EmptyState
          title={texts.start.emptyTitle}
          hint={texts.start.emptyHint}
          action={{ label: texts.start.emptyAction, to: "/uebungen" }}
        />
      ) : (
        <section aria-labelledby="start-plans">
          <h2 id="start-plans">{texts.start.plansHeading}</h2>
          <ul className="list">
            {list.map((plan) => (
              <li className="record" key={plan.id}>
                <span>{plan.name}</span>
                <button className="button" onClick={() => void start(plan)}>
                  Start
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button
        className="button button-secondary free-start"
        onClick={() => void start()}
      >
        Freies Workout
      </button>
    </>
  );
}
