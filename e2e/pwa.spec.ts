import { expect, test } from "@playwright/test";

test("Service Worker wird aktiv und die App startet offline neu", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "TrainingApp" }),
  ).toBeVisible();

  // Wartet, bis der Service Worker aktiv ist (Precache abgeschlossen).
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state;
  });

  await context.setOffline(true);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "TrainingApp" }),
  ).toBeVisible();
});

test("Manifest ist vollständig und die Icons sind erreichbar", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifestUrl = new URL(href ?? "", page.url()).toString();
  const response = await request.get(manifestUrl);
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as {
    name?: string;
    lang?: string;
    display?: string;
    icons?: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  expect(manifest.name).toBe("TrainingApp");
  expect(manifest.lang).toBe("de");
  expect(manifest.display).toBe("standalone");

  const icons = manifest.icons ?? [];
  expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
  expect(icons.some((i) => i.sizes === "512x512")).toBe(true);
  expect(icons.some((i) => i.purpose === "maskable")).toBe(true);

  for (const icon of icons) {
    const iconResponse = await request.get(
      new URL(icon.src, manifestUrl).toString(),
    );
    expect(iconResponse.ok(), icon.src).toBe(true);
  }
});

test("Chromium findet keine Installierbarkeitsfehler", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);

  const session = await context.newCDPSession(page);
  const { installabilityErrors } = (await session.send(
    "Page.getInstallabilityErrors",
  )) as { installabilityErrors: Array<{ errorId: string }> };

  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
});
