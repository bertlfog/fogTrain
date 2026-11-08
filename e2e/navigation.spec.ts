import { expect, test } from "@playwright/test";

import { areas, navLinkOf, openArea } from "./areas";

test("alle fünf Bereiche sind per Tap erreichbar", async ({ page }) => {
  await page.goto("/");

  for (const area of areas) {
    await openArea(page, area);
    await expect(
      page.getByRole("heading", { level: 1, name: area.heading }),
    ).toBeVisible();
    await expect(navLinkOf(page, area)).toHaveAttribute("aria-current", "page");
    if (area.path !== "/") {
      await expect(page).toHaveURL(new RegExp(`#${area.path}$`));
    }
  }
});

test("alle Bereiche funktionieren offline, auch nach Neuladen eines Links", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();

  for (const area of areas) {
    await openArea(page, area);
    await expect(
      page.getByRole("heading", { level: 1, name: area.heading }),
    ).toBeVisible();
  }

  // Direkter Link auf einen Bereich, kalt aus dem Service-Worker-Cache.
  await page.goto("/#/verlauf");
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Verlauf" }),
  ).toBeVisible();
});

test("unbekannte Adressen führen zur Startseite", async ({ page }) => {
  await page.goto("/#/gibt-es-nicht");
  await expect(
    page.getByRole("heading", { level: 1, name: "TrainingApp" }),
  ).toBeVisible();
  await expect(navLinkOf(page, areas[0])).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Leerzustände zeigen Titel und Hinweistext", async ({ page }) => {
  await page.goto("/");

  for (const area of areas) {
    if (area.emptyTitle === undefined) continue;
    await openArea(page, area);
    const empty = page.getByRole("region", { name: area.emptyTitle });
    await expect(empty).toBeVisible();
    await expect(empty.getByRole("paragraph")).not.toBeEmpty();
  }
});

test("Leerzustand der Startseite führt zu den Übungen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Zu den Übungen" }).tap();
  await expect(
    page.getByRole("heading", { level: 1, name: "Übungen" }),
  ).toBeVisible();
});

test("Tap-Ziele sind mindestens 48 × 48 dp groß (N9)", async ({ page }) => {
  await page.goto("/");

  const targets = [
    ...areas.map((area) => navLinkOf(page, area)),
    page.getByRole("link", { name: "Zu den Übungen" }),
  ];
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box, await target.innerText()).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
});

for (const width of [320, 360]) {
  test(`Navigationslabels passen auf ein ${width} px breites Handy`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/");

    let total = 0;
    for (const area of areas) {
      const link = navLinkOf(page, area);
      const linkBox = await link.boundingBox();
      const labelBox = await link.locator("span").boundingBox();
      expect(linkBox, area.label).not.toBeNull();
      expect(labelBox, area.label).not.toBeNull();

      // Label liegt vollständig im Tap-Ziel, das Tap-Ziel bleibt groß genug.
      expect(labelBox?.x ?? 0).toBeGreaterThanOrEqual(linkBox?.x ?? 0);
      expect((labelBox?.x ?? 0) + (labelBox?.width ?? 0)).toBeLessThanOrEqual(
        (linkBox?.x ?? 0) + (linkBox?.width ?? 0),
      );
      expect(linkBox?.width ?? 0).toBeGreaterThanOrEqual(48);
      total += linkBox?.width ?? 0;
    }
    // Die Leiste füllt die Breite, ohne seitlich überzulaufen.
    expect(total).toBeCloseTo(width, 0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("untere Navigation bleibt am unteren Rand sichtbar", async ({ page }) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  const box = await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .boundingBox();

  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(
    viewport?.height ?? 0,
    0,
  );
});
