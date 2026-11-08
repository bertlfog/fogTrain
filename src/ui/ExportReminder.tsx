import { useEffect, useState } from "react";

import {
  EXPORT_REMINDER_DAYS,
  isExportOverdue,
  LAST_EXPORT_KEY,
} from "./exportReminderStatus";

export function ExportReminder() {
  const [overdue, setOverdue] = useState(() =>
    isExportOverdue(localStorage.getItem(LAST_EXPORT_KEY)),
  );

  useEffect(() => {
    const update = () =>
      setOverdue(isExportOverdue(localStorage.getItem(LAST_EXPORT_KEY)));
    window.addEventListener("trainingapp-exported", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("trainingapp-exported", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!overdue) return null;
  return (
    <aside className="export-reminder" role="status">
      Dein letztes Backup ist älter als {EXPORT_REMINDER_DAYS} Tage. Exportiere
      deine Daten regelmäßig in den Einstellungen.
    </aside>
  );
}
