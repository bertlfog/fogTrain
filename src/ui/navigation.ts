import { texts } from "./texts";

/** Die fünf Hauptbereiche der App in der Reihenfolge der unteren Navigation. */
export type NavId = "start" | "exercises" | "plans" | "history" | "settings";

export interface NavItem {
  id: NavId;
  path: string;
  label: string;
}

export const navItems: readonly NavItem[] = [
  { id: "start", path: "/", label: texts.nav.start },
  { id: "exercises", path: "/uebungen", label: texts.nav.exercises },
  { id: "plans", path: "/plaene", label: texts.nav.plans },
  { id: "history", path: "/verlauf", label: texts.nav.history },
  { id: "settings", path: "/einstellungen", label: texts.nav.settings },
];

export const paths = {
  start: "/",
  exercises: "/uebungen",
  plans: "/plaene",
  history: "/verlauf",
  settings: "/einstellungen",
} as const satisfies Record<NavId, string>;
