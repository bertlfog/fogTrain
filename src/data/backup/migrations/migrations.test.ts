import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../../../model";
import { DataError } from "../../errors";
import { migrateToLatest, migrateToVersion } from "./index";
import type { MigrationRegistry } from "./index";

const fixture = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      new URL("../fixtures/export-v1.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;

function codeOf(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error instanceof DataError ? error.code : error;
  }
  return undefined;
}

describe("Migrationsrahmen", () => {
  it("lässt die eingefrorene Version-1-Fixture unverändert", () => {
    const input = fixture();
    expect(migrateToLatest(input)).toEqual(fixture());
    expect(input).toEqual(fixture());
  });

  it("kennt die Fixture-Version als aktuelle Version", () => {
    expect(fixture()["schemaVersion"]).toBe(SCHEMA_VERSION);
  });

  it("lehnt neuere Versionen als bekannt ab (DataError 'version')", () => {
    const newer = { ...fixture(), schemaVersion: SCHEMA_VERSION + 1 };
    expect(codeOf(() => migrateToLatest(newer))).toBe("version");
  });

  it.each([
    ["kein Objekt", "text"],
    ["null", null],
    ["Array", []],
    ["ohne Version", { app: "TrainingApp" }],
    ["Version 0", { schemaVersion: 0 }],
    ["Version nicht ganzzahlig", { schemaVersion: 1.5 }],
    ["Version als Text", { schemaVersion: "1" }],
  ])("lehnt ungültige Dokumente ab (%s)", (_label, raw) => {
    expect(codeOf(() => migrateToLatest(raw))).toBe("invalid");
  });

  describe("mit künstlicher Registry", () => {
    const registry: MigrationRegistry = {
      1: (file) => ({ ...file, addedInV2: true }),
      2: (file) => ({ ...file, addedInV3: file["addedInV2"] ? "ja" : "nein" }),
    };

    it("wendet die Schritte der Reihe nach an und setzt die Version", () => {
      const input = { schemaVersion: 1, data: {} };
      const result = migrateToVersion(input, 3, registry);

      expect(result).toEqual({
        schemaVersion: 3,
        data: {},
        addedInV2: true,
        addedInV3: "ja",
      });
      expect(input).toEqual({ schemaVersion: 1, data: {} });
    });

    it("startet bei einer mittleren Version nur mit den fehlenden Schritten", () => {
      const result = migrateToVersion({ schemaVersion: 2 }, 3, registry);
      expect(result).toEqual({ schemaVersion: 3, addedInV3: "nein" });
    });

    it("gibt ein Dokument in Zielversion unverändert zurück", () => {
      const input = { schemaVersion: 3, x: 1 };
      expect(migrateToVersion(input, 3, registry)).toEqual(input);
    });

    it("meldet eine fehlende Zwischenmigration als 'version'", () => {
      expect(
        codeOf(() =>
          migrateToVersion({ schemaVersion: 1 }, 3, { 1: (f) => f }),
        ),
      ).toBe("version");
    });
  });
});
