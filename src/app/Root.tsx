import { useEffect, useState } from "react";

import { openIndexedDbRepositories } from "../data/indexeddb";
import type { Repositories } from "../data/repositories";
import { App } from "../ui/App";
import { RepositoryProvider } from "../ui/RepositoryContext";
import { texts } from "../ui/texts";

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
    <main className="content">
      <h1>{texts.appName}</h1>
      {state.status === "loading" ? (
        <p role="status">{texts.common.loading}</p>
      ) : (
        <section className="card" role="alert">
          <h2>{texts.storageUnavailable.title}</h2>
          <p>{texts.storageUnavailable.hint}</p>
        </section>
      )}
    </main>
  );
}
