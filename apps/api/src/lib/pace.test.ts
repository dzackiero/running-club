import { describe, expect, it } from "vitest";
import { avgPaceSecPerKm } from "./pace";

describe("avgPaceSecPerKm", () => {
  it("computes pace for 5k in 25:00", () => {
    expect(avgPaceSecPerKm(5000, 1500)).toBe(300);
  });

  it("returns null for zero distance", () => {
    expect(avgPaceSecPerKm(0, 1500)).toBeNull();
  });
});
