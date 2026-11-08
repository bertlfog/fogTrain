import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

/** Zustand der dauerhaften Speicherung (SPEC N15). */
export type StorageStatus = "pending" | "granted" | "denied" | "unsupported";

const StorageStatusContext = createContext<StorageStatus>("pending");

function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.persist === "function" &&
    typeof navigator.storage?.persisted === "function"
  );
}

/**
 * Bittet beim Start der App um dauerhaften Speicher, damit Android die Daten
 * nicht automatisch räumt, und stellt das Ergebnis der Oberfläche bereit.
 */
export function StoragePersistenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState<StorageStatus>(() =>
    isSupported() ? "pending" : "unsupported",
  );

  useEffect(() => {
    if (!isSupported()) return;
    let cancelled = false;

    const request = async (): Promise<boolean> =>
      (await navigator.storage.persisted()) || navigator.storage.persist();

    request().then(
      (granted) => {
        if (!cancelled) setStatus(granted ? "granted" : "denied");
      },
      () => {
        if (!cancelled) setStatus("denied");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StorageStatusContext.Provider value={status}>
      {children}
    </StorageStatusContext.Provider>
  );
}

export function useStorageStatus(): StorageStatus {
  return useContext(StorageStatusContext);
}
