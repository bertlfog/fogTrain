import type { ReactNode } from "react";

import type { LoadState } from "./useLoad";
import { texts } from "./texts";

/** Zeigt je nach Ladezustand Hinweis, Fehler oder den Inhalt. */
export function Loaded<T>({
  state,
  children,
}: {
  state: LoadState<T>;
  children: (data: T) => ReactNode;
}) {
  switch (state.status) {
    case "loading":
      return <p role="status">{texts.common.loading}</p>;
    case "error":
      return <p role="alert">{texts.common.loadFailed}</p>;
    case "ready":
      return <>{children(state.data)}</>;
  }
}
