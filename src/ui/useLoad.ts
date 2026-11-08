import { useEffect, useState } from "react";

export type LoadState<T> =
  { status: "loading" } | { status: "ready"; data: T } | { status: "error" };

/**
 * Lädt Daten einmal beim Einblenden einer Seite. `load` muss stabil sein
 * (z. B. per `useCallback`), sonst wird bei jedem Rendern neu geladen.
 */
export function useLoad<T>(load: () => Promise<T>): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  return state;
}
