import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { areas, openArea } from "./areas";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const backgrounds = {
  light: "rgb(255, 255, 255)",
  dark: "rgb(14, 21, 20)",
} as const;

for (const scheme of ["light", "dark"] as const) {
  test(`Axe findet keine Verstöße gegen WCAG A/AA (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");

    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe(backgrounds[scheme]);

    for (const area of areas) {
      await openArea(page, area);
      await expect(
        page.getByRole("heading", { level: 1, name: area.heading }),
      ).toBeVisible();
      // Erst prüfen, wenn der Inhalt geladen ist.
      await expect(page.getByText("Wird geladen …")).toHaveCount(0);

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();
      expect(results.violations, `${area.label} (${scheme})`).toEqual([]);
    }
  });
}
