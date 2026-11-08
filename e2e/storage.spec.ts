import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { areas, openArea } from "./areas";

const settings = areas[4];

/** Ersetzt die Speicher-API, um beide Antworten des Browsers zu prüfen. */
async function stubStorage(
  page: Page,
  options: { persisted: boolean; grant: boolean },
) {
  await page.addInitScript((opts) => {
    const calls = { persist: 0 };
    Object.defineProperty(window, "__persistCalls", { value: calls });
    Object.defineProperty(navigator.storage, "persisted", {
      configurable: true,
      value: async () => opts.persisted,
    });
    Object.defineProperty(navigator.storage, "persist", {
      configurable: true,
      value: async () => {
        calls.persist += 1;
        return opts.grant;
      },
    });
  }, options);
}

const statusOf = (page: Page) => page.getByTestId("storage-status");

test("fragt beim Start dauerhaften Speicher an und zeigt 'gesichert' (N15)", async ({
  page,
}) => {
  await stubStorage(page, { persisted: false, grant: true });
  await page.goto("/");
  await openArea(page, settings);

  await expect(statusOf(page)).toHaveAttribute("data-status", "granted");
  await expect(statusOf(page)).toContainText("Dauerhaft gesichert");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __persistCalls: { persist: number } })
          .__persistCalls.persist,
    ),
  ).toBeGreaterThan(0);
});

test("fragt nicht erneut an, wenn der Speicher schon dauerhaft ist", async ({
  page,
}) => {
  await stubStorage(page, { persisted: true, grant: false });
  await page.goto("/");
  await openArea(page, settings);

  await expect(statusOf(page)).toHaveAttribute("data-status", "granted");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __persistCalls: { persist: number } })
          .__persistCalls.persist,
    ),
  ).toBe(0);
});

test("zeigt eine Warnung, wenn der Browser den Speicher nicht sichert", async ({
  page,
}) => {
  await stubStorage(page, { persisted: false, grant: false });
  await page.goto("/");
  await openArea(page, settings);

  await expect(statusOf(page)).toHaveAttribute("data-status", "denied");
  await expect(statusOf(page)).toContainText("Nicht dauerhaft gesichert");
});

test("kommt mit dem echten Browser zu einem Ergebnis", async ({ page }) => {
  await page.goto("/");
  await openArea(page, settings);

  await expect(statusOf(page)).not.toHaveAttribute("data-status", "pending");
});
