import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

test("validiert ein Backup und ersetzt den lokalen Datenbestand nach Bestätigung", async ({
  page,
  context,
}) => {
  const backup = readFileSync(
    new URL("../src/data/backup/fixtures/export-v1.json", import.meta.url),
  );
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("link", { name: "Einstellungen", exact: true }).tap();
  await page.locator("#backup-import-file").setInputFiles({
    name: "trainingapp-backup.json",
    mimeType: "application/json",
    buffer: backup,
  });

  const summary = page.getByRole("region", {
    name: "Backup-Zusammenfassung",
  });
  await expect(summary).toContainText("Übungen: 3");
  await expect(summary).toContainText("Pläne: 1");
  await expect(summary).toContainText("Workouts: 2");

  await page.getByRole("button", { name: "Alle Daten ersetzen" }).tap();
  await expect(
    page.getByRole("heading", { name: "Einstellungen", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Übungen", exact: true }).tap();
  await expect(
    page.getByRole("heading", { name: "Übungen", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Kniebeuge", { exact: true })).toBeVisible();
});
