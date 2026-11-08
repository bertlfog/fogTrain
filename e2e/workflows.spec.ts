import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __tapCount: number;
    __tapTrackingInstalled?: boolean;
  }
}

async function resetTapCount(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__tapCount = 0;
    if (!window.__tapTrackingInstalled) {
      document.addEventListener("click", () => window.__tapCount++);
      window.__tapTrackingInstalled = true;
    }
  });
}

const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZ0AAAAASUVORK5CYII=",
  "base64",
);

test("Übungen, Plan, Workout, Verlauf und Backup funktionieren offline", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const origin = new URL(page.url()).origin;
  await context.setOffline(true);

  await page.evaluate(() => {
    window.location.hash = "/uebungen";
  });
  await expect(
    page.getByRole("heading", { name: "Übungen", exact: true }),
  ).toBeVisible();
  for (const [index, name] of ["Kniebeuge", "Liegestütz", "Plank"].entries()) {
    await page.getByRole("button", { name: "Neue Übung" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    if (index === 0) {
      await page.getByLabel("Standard-Sätze").fill("4");
    }
    await page.getByLabel("Standard-Wiederholungen").fill("10");
    await page.getByLabel("Standard-Gewicht (kg)").fill("20");
    if (index === 0) {
      await page.getByLabel("Bilder hinzufügen").setInputFiles({
        name: "uebung.png",
        mimeType: "image/png",
        buffer: imageBytes,
      });
    }
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  const squatRow = page.getByRole("listitem").filter({ hasText: "Kniebeuge" });
  await squatRow.getByRole("button", { name: "Bearbeiten" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Kniebeuge vorne");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(
    page.getByText("Kniebeuge vorne", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".exercise-thumb")).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Kniebeuge vorne", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".exercise-thumb")).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "/plaene";
  });
  await expect(
    page.getByRole("heading", { name: "Pläne", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Neuer Plan" }).click();
  await page.getByLabel("Planname").fill("Ganzkörper");
  for (const name of ["Kniebeuge vorne", "Liegestütz", "Plank"]) {
    await page.getByRole("checkbox", { name }).check();
  }
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Kniebeuge vorne" })
      .getByLabel("Sätze"),
  ).toHaveValue("4");
  await page.getByRole("button", { name: "Nach unten" }).first().click();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Ganzkörper", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ganzkörper", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Start", exact: true }).tap();
  await resetTapCount(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  expect(
    await page.evaluate(() => window.__tapCount),
    "Workout-Start-Taps",
  ).toBeLessThanOrEqual(2);
  await expect(page.getByRole("heading", { name: "Ganzkörper" })).toBeVisible();
  await expect(page.getByLabel("Sätze für dieses Workout")).toHaveValue("4");
  await page.getByLabel("Sätze für dieses Workout").fill("2");
  await expect(page.getByText("0 von 2 Sätzen")).toBeVisible();
  await resetTapCount(page);
  await page.getByRole("button", { name: "Satz erledigt" }).click();
  expect(await page.evaluate(() => window.__tapCount), "Satz-Taps").toBe(1);
  await expect(page.getByText("Satz gespeichert.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Offenes Workout gefunden" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Workout fortsetzen" }).click();
  await expect(page.getByText("1 von 2 Sätzen")).toBeVisible();
  await expect(page.getByLabel("Sätze für dieses Workout")).toHaveValue("2");
  await page.getByRole("button", { name: "Workout beenden" }).click();
  await expect(page.getByText("1 Satz gespeichert.")).toBeVisible();
  await page.getByRole("button", { name: "Zum Verlauf" }).click();

  await expect(page.getByText("Ganzkörper", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Ganzkörper/ }).click();
  await expect(page.getByText(/Volumen 200 kg·Wdh\./)).toBeVisible();
  await page
    .getByLabel("Übung auswählen")
    .selectOption({ label: "Kniebeuge vorne" });
  await expect(page.getByRole("cell", { name: "200" })).toBeVisible();

  await page.getByRole("link", { name: "Übungen", exact: true }).tap();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: "Kniebeuge vorne" })
    .getByRole("button", { name: "Löschen" })
    .click();
  await expect(page.getByText("Kniebeuge vorne", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText(/wird wegen vorhandener Pläne oder Workouts archiviert/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Pläne", exact: true }).tap();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Ganzkörper" })
    .getByRole("button", { name: "Bearbeiten" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Kniebeuge vorne" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Abbrechen" }).click();

  await page.evaluate(() => {
    window.location.hash = "/verlauf";
  });
  await expect(
    page.getByRole("heading", { name: "Verlauf", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Übung auswählen")
    .selectOption({ label: "Kniebeuge vorne (archiviert)" });

  await page.evaluate(() => {
    window.location.hash = "/einstellungen";
  });
  await expect(
    page.getByRole("heading", { name: "Einstellungen", exact: true }),
  ).toBeVisible();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Daten exportieren" }).click();
  const download = await downloadWait;
  expect(download.suggestedFilename()).toMatch(
    /^trainingapp-backup-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const backupPath = await download.path();
  if (!backupPath)
    throw new Error("Die Backup-Datei wurde nicht heruntergeladen.");
  const backup = JSON.parse(await readFile(backupPath, "utf8")) as {
    app: string;
    data: {
      exercises: unknown[];
      exerciseImages: unknown[];
      plans: unknown[];
      workouts: unknown[];
      loggedSets: unknown[];
    };
  };
  expect(backup.app).toBe("TrainingApp");
  expect(backup.data.exercises).toHaveLength(3);
  expect(backup.data.exerciseImages).toHaveLength(1);
  expect(backup.data.plans).toHaveLength(1);
  expect(backup.data.workouts).toHaveLength(1);
  expect(backup.data.loggedSets).toHaveLength(1);
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
});
