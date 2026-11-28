import { useRef, useState } from "react";

import { backupFileName, createBackupService } from "../../data/backup";
import type { ImportSummary } from "../../data/backup";
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
  const [backupData, setBackupData] = useState<unknown>();
  const [importSummary, setImportSummary] = useState<ImportSummary>();
  const importInput = useRef<HTMLInputElement>(null);

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

      download();
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

  const validateImport = async (file: File | undefined) => {
    setBackupData(undefined);
    setImportSummary(undefined);
    setMessage("");
    if (!file) return;

    setBusy(true);
    try {
      const raw: unknown = JSON.parse(await file.text());
      const result = createBackupService(repositories).validate(raw);
      setBackupData(raw);
      setImportSummary(result.summary);
      setMessage(
        "Backup ist gültig. Prüfe die Zusammenfassung vor dem Import.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Import nicht möglich: ${error.message}`
          : "Import nicht möglich: Die Datei konnte nicht gelesen werden.",
      );
    } finally {
      setBusy(false);
    }
  };

  const importData = async () => {
    if (backupData === undefined || !importSummary) return;
    setBusy(true);
    setMessage("");
    try {
      await createBackupService(repositories).importReplaceAll(backupData);
      setMessage("Backup wurde importiert. Die App wird aktualisiert.");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Import fehlgeschlagen: ${error.message}`
          : "Import fehlgeschlagen.",
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
        <h3>Backup importieren</h3>
        <p>
          Ein Import ersetzt alle vorhandenen Übungen, Bilder, Pläne und
          Workouts.
        </p>
        <label className="button" htmlFor="backup-import-file">
          JSON-Backup auswählen
        </label>
        <input
          ref={importInput}
          id="backup-import-file"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => {
            void validateImport(event.currentTarget.files?.[0]);
          }}
        />
        {importSummary && (
          <div role="region" aria-label="Backup-Zusammenfassung">
            <p>
              Übungen: {importSummary.exercises}; Pläne: {importSummary.plans};{" "}
              Workouts: {importSummary.workouts}; Bilder:{" "}
              {importSummary.exerciseImages}
            </p>
            <p role="alert">
              Beim Import werden alle aktuell gespeicherten Daten vollständig
              ersetzt.
            </p>
            <button
              className="button"
              onClick={() => void importData()}
              disabled={busy}
            >
              {busy ? "Import wird ausgeführt …" : "Alle Daten ersetzen"}
            </button>
            <button
              className="button"
              onClick={() => {
                setBackupData(undefined);
                setImportSummary(undefined);
                setMessage("Import abgebrochen.");
                if (importInput.current) importInput.current.value = "";
              }}
              disabled={busy}
            >
              Abbrechen
            </button>
          </div>
        )}
        {message && <p role="status">{message}</p>}
      </section>
    </>
  );
}
