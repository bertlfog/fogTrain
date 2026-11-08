import { describe, expect, it } from "vitest";

import { EXPORT_REMINDER_DAYS, isExportOverdue } from "./exportReminderStatus";

describe("Export-Erinnerung", () => {
  const now = Date.parse("2026-11-08T10:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;

  it("erinnert, wenn noch kein Backup existiert", () => {
    expect(isExportOverdue(null, now)).toBe(true);
  });

  it("erinnert erst, wenn der Export älter als 14 Tage ist", () => {
    expect(
      isExportOverdue(
        new Date(now - EXPORT_REMINDER_DAYS * day).toISOString(),
        now,
      ),
    ).toBe(false);
    expect(isExportOverdue(new Date(now - 15 * day).toISOString(), now)).toBe(
      true,
    );
    expect(isExportOverdue(new Date(now - day).toISOString(), now)).toBe(false);
  });

  it("behandelt ein ungültiges Exportdatum als überfällig", () => {
    expect(isExportOverdue("kein-datum", now)).toBe(true);
  });
});
