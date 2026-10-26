import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "./index";

describe("Modell", () => {
  it("startet mit Schema-Version 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
