import { describe, expect, it } from "vitest";

import { navItems, paths } from "./navigation";
import { texts } from "./texts";

describe("Navigation", () => {
  it("hat die fünf Bereiche aus der SPEC in dieser Reihenfolge", () => {
    expect(navItems.map((item) => item.label)).toEqual([
      "Start",
      "Übungen",
      "Pläne",
      "Verlauf",
      "Einstellungen",
    ]);
  });

  it("verwendet eindeutige Pfade, die mit / beginnen", () => {
    const all = navItems.map((item) => item.path);
    expect(new Set(all).size).toBe(all.length);
    expect(all.every((path) => path.startsWith("/"))).toBe(true);
  });

  it("hält Pfadtabelle und Navigation konsistent", () => {
    for (const item of navItems) {
      expect(paths[item.id]).toBe(item.path);
    }
  });
});

describe("Texte", () => {
  it("benennt Workouts im Singular und Plural", () => {
    expect(texts.history.count(1)).toBe("1 Workout");
    expect(texts.history.count(0)).toBe("0 Workouts");
    expect(texts.history.count(12)).toBe("12 Workouts");
  });
});
