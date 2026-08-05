import { describe, expect, it } from "vitest";
import { gapToPaceSecPerKm, normalizeIntensity } from "./metrics";

describe("normalizeIntensity", () => {
  it("passes through percents and scales 0–1 values", () => {
    expect(normalizeIntensity(78)).toBe(78);
    expect(normalizeIntensity(0.78)).toBe(78);
    expect(normalizeIntensity(0)).toBe(0);
    expect(normalizeIntensity(null)).toBeUndefined();
  });
});

describe("gapToPaceSecPerKm", () => {
  it("converts m/s and keeps sec/km", () => {
    expect(gapToPaceSecPerKm(3.333333)).toBeCloseTo(300, 0);
    expect(gapToPaceSecPerKm(295)).toBe(295);
    expect(gapToPaceSecPerKm(0)).toBeUndefined();
  });
});
