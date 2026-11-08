import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __historyOpenStart?: number;
  }
}

test("offline cold start bleibt mit 4× CPU-Drosselung unter 2 Sekunden (N3)", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await context.setOffline(true);
  const started = Date.now();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "TrainingApp" }),
  ).toBeVisible();
  const elapsed = Date.now() - started;
  await cdp.detach();
  expect(elapsed, `Offline-Kaltstart dauerte ${elapsed} ms`).toBeLessThan(2000);
});

test("Verlauf zeigt 500 Workouts und 10 000 Sätze innerhalb 500 ms (N6)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const request = indexedDB.open("trainingapp", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB ist blockiert."));
    });
    const transaction = db.transaction(["workouts", "loggedSets"], "readwrite");
    const workouts = transaction.objectStore("workouts");
    const sets = transaction.objectStore("loggedSets");
    for (let workoutIndex = 0; workoutIndex < 500; workoutIndex++) {
      const startedAt = new Date(
        Date.UTC(2024, 0, 1) + workoutIndex * 86_400_000,
      ).toISOString();
      const workoutId = `perf-workout-${workoutIndex}`;
      workouts.put({
        id: workoutId,
        planNameSnapshot: "Performance",
        startedAt,
        endedAt: startedAt,
      });
      for (let setIndex = 0; setIndex < 20; setIndex++) {
        sets.put({
          id: `perf-set-${workoutIndex}-${setIndex}`,
          workoutId,
          exerciseId: "perf-exercise",
          exerciseNameSnapshot: "Performanceübung",
          exerciseOrder: 0,
          setNumber: setIndex + 1,
          reps: 10,
          weightKg: 20,
          loggedAt: startedAt,
        });
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  });

  await page.evaluate(() => {
    window.__historyOpenStart = performance.now();
  });
  await page.getByRole("link", { name: "Verlauf", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: /Performance/ }).first(),
  ).toBeVisible();
  const elapsed = await page.evaluate(
    () => performance.now() - (window.__historyOpenStart ?? performance.now()),
  );
  expect(elapsed, `Verlauf brauchte ${elapsed.toFixed(1)} ms`).toBeLessThan(
    500,
  );
});
