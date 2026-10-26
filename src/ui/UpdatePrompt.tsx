import { useRegisterSW } from "virtual:pwa-register/react";

/** Hinweis, wenn eine neue App-Version bereitsteht (Service-Worker-Update). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div role="status">
      <span>Neue Version verfügbar.</span>{" "}
      <button
        type="button"
        style={{ minHeight: 48, minWidth: 48 }}
        onClick={() => void updateServiceWorker(true)}
      >
        Aktualisieren
      </button>
    </div>
  );
}
