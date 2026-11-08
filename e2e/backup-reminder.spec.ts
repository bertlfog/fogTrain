import { expect, test } from "@playwright/test";

test("Backup-Hinweis erscheint ab 14 Tagen und verschwindet nach Export", async ({
  page,
}) => {
  const staleDate = new Date(
    Date.now() - 15 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await page.addInitScript((date) => {
    localStorage.setItem("trainingapp.lastExportAt", date);
  }, staleDate);
  await page.goto("/");
  const reminder = page.locator(".export-reminder");
  await expect(reminder).toContainText("älter als 14 Tage");

  await page.getByRole("link", { name: "Einstellungen", exact: true }).tap();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Daten exportieren" }).click();
  await downloadWait;
  await expect(reminder).toHaveCount(0);
});
