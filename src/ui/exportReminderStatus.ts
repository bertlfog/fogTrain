export const LAST_EXPORT_KEY = "trainingapp.lastExportAt";
export const EXPORT_REMINDER_DAYS = 14;

export function isExportOverdue(
  lastExport: string | null,
  now = Date.now(),
): boolean {
  if (!lastExport) return true;
  const timestamp = Date.parse(lastExport);
  return (
    !Number.isFinite(timestamp) ||
    now - timestamp > EXPORT_REMINDER_DAYS * 24 * 60 * 60 * 1000
  );
}
