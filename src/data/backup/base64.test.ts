import { describe, expect, it } from "vitest";

import { base64ToBytes, bytesToBase64 } from "./base64";

describe("Base64", () => {
  it("kodiert bekannte Werte wie der Standard", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
    expect(bytesToBase64(new Uint8Array([72, 105]))).toBe("SGk=");
    expect(bytesToBase64(new Uint8Array([0, 255, 128]))).toBe("AP+A");
  });

  it("rekonstruiert alle 256 Byte-Werte unverändert", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });

  it("verarbeitet große Bilder ohne Stapelüberlauf (3 MB)", () => {
    const bytes = new Uint8Array(3 * 1024 * 1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff;

    const restored = base64ToBytes(bytesToBase64(bytes));
    expect(restored.length).toBe(bytes.length);
    expect(restored.every((value, i) => value === bytes[i])).toBe(true);
  });
});
