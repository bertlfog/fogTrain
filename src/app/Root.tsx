import { useEffect, useState } from "react";

import { openIndexedDbRepositories } from "../data/indexeddb";
import type { Repositories } from "../data/repositories";
import { App } from "../ui/App";
import { RepositoryProvider } from "../ui/RepositoryContext";

type State =
  | { status: "loading" }
  | { status: "ready"; repositories: Repositories }
  | { status: "failed" };

/**
 * Composition Root: öffnet die Datenbank und verdrahtet die Repositories mit
 * der UI. Einzige Stelle, die UI und IndexedDB zusammenbringt.
 */
export function Root() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | undefined;

    openIndexedDbRepositories().then(
      (handle) => {
        close = handle.close;
        if (cancelled) {
          handle.close();
          return;
        }
        setState({ status: "ready", repositories: handle.repositories });
      },
      () => {
        if (!cancelled) setState({ status: "failed" });
      },
    );

    return () => {
      cancelled = true;
      close?.();
    };
  }, []);

  if (state.status === "ready") {
    return (
      <RepositoryProvider repositories={state.repositories}>
        <App />
      </RepositoryProvider>
    );
  }

  return (
    <main>
      <h1>TrainingApp</h1>
      {state.status === "loading" ? (
        <p role="status">Daten werden geladen …</p>
      ) : (
        <p role="alert">
          Der lokale Speicher ist nicht verfügbar. Bitte die Seite neu laden
          oder den Browser-Speicher freigeben.
        </p>
      )}
    </main>
  );
}
