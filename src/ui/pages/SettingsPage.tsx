import { useState } from "react";

import { backupFileName, createBackupService } from "../../data/backup";
import { useRepositories } from "../RepositoryContext";
import { useStorageStatus } from "../StoragePersistence";
import { texts } from "../texts";
import { LAST_EXPORT_KEY } from "../exportReminderStatus";

export function SettingsPage() {
  const storage = useStorageStatus();
  const repositories = useRepositories();
  const [lastExport, setLastExport] = useState<string | undefined>(
    () => localStorage.getItem(LAST_EXPORT_KEY) ?? undefined,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    setMessage("");
    try {
      const file = await createBackupService(repositories).exportAll();
      const now = new Date();
      const filename = backupFileName(now);
      const json = JSON.stringify(file, null, 2);
      const download = () => {
        const url = URL.createObjectURL(
          new Blob([json], { type: "application/json" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      };

      const backup = new File([json], filename, { type: "application/json" });
      if (navigator.canShare?.({ files: [backup] }) && navigator.share) {
        await navigator.share({ files: [backup], title: "TrainingApp-Backup" });
      } else {
        download();
      }
      const exportedAt = now.toISOString();
      localStorage.setItem(LAST_EXPORT_KEY, exportedAt);
      setLastExport(exportedAt);
      window.dispatchEvent(new Event("trainingapp-exported"));
      setMessage(`Backup ${filename} wurde erstellt.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Export fehlgeschlagen: ${error.message}`
          : "Export fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>{texts.settings.title}</h1>
      <section className="card" aria-labelledby="settings-storage">
        <h2 id="settings-storage">{texts.settings.storageHeading}</h2>
        <p data-testid="storage-status" data-status={storage}>
          {texts.settings.storage[storage]}
        </p>
      </section>
      <section
        className="card settings-section"
        aria-labelledby="settings-backup"
      >
        <h2 id="settings-backup">Datensicherung</h2>
        <p>
          {lastExport
            ? `Zuletzt exportiert: ${new Date(lastExport).toLocaleString("de-DE")}`
            : "Es wurde noch kein Backup exportiert."}
        </p>
        <p>
          Der Export enthält alle Übungen, Bilder, Pläne und Workouts als JSON.
        </p>
        <button
          className="button"
          onClick={() => void exportData()}
          disabled={busy}
        >
          {busy ? "Export wird erstellt …" : "Daten exportieren"}
        </button>
        {message && <p role="status">{message}</p>}
      </section>
    </>
  );
}
