import { describe, expect, it } from "vitest";
import { upsertWeeklyGoalSchema } from "./goal";

describe("upsertWeeklyGoalSchema", () => {
  it("requires at least one target metric", () => {
    expect(() =>
      upsertWeeklyGoalSchema.parse({
        weekStartsOn: 1,
      }),
    ).toThrow();
  });

  it("accepts distance-only weekly goal", () => {
    const parsed = upsertWeeklyGoalSchema.parse({
      weekStartsOn: 1,
      targetDistanceMeters: 40000,
    });
    expect(parsed.targetDistanceMeters).toBe(40000);
  });
});
