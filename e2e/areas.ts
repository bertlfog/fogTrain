import type { Page } from "@playwright/test";

/** Die fünf Hauptbereiche (SPEC T5) mit Überschrift und Leerzustand. */
export const areas = [
  {
    label: "Start",
    path: "/",
    heading: "TrainingApp",
    emptyTitle: "Noch kein Trainingsplan",
  },
  {
    label: "Übungen",
    path: "/uebungen",
    heading: "Übungen",
    emptyTitle: "Noch keine Übungen",
  },
  {
    label: "Pläne",
    path: "/plaene",
    heading: "Pläne",
    emptyTitle: "Noch keine Pläne",
  },
  {
    label: "Verlauf",
    path: "/verlauf",
    heading: "Verlauf",
    emptyTitle: "Noch keine Workouts",
  },
  {
    label: "Einstellungen",
    path: "/einstellungen",
    heading: "Einstellungen",
    emptyTitle: undefined,
  },
] as const;

export type Area = (typeof areas)[number];

export const navigationOf = (page: Page) =>
  page.getByRole("navigation", { name: "Hauptnavigation" });

export const navLinkOf = (page: Page, area: Area) =>
  navigationOf(page).getByRole("link", { name: area.label, exact: true });

/** Tippt in der unteren Navigation auf den Bereich. */
export async function openArea(page: Page, area: Area): Promise<void> {
  await navLinkOf(page, area).tap();
}
