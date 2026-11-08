import { useRegisterSW } from "virtual:pwa-register/react";

import { texts } from "./texts";

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
    <div className="update-banner" role="status">
      <span>{texts.update.available}</span>
      <button
        type="button"
        className="button"
        onClick={() => void updateServiceWorker(true)}
      >
        {texts.update.action}
      </button>
    </div>
  );
}
