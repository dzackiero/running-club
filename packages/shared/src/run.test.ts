import { describe, expect, it } from "vitest";
import { createRunSchema, listRunsQuerySchema } from "./run";

describe("createRunSchema", () => {
  it("accepts required fields only", () => {
    const parsed = createRunSchema.parse({
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1800,
      activityType: "run",
    });
    expect(parsed.distanceMeters).toBe(5000);
    expect(parsed.avgHeartRate).toBeUndefined();
  });

  it("rejects missing duration", () => {
    expect(() =>
      createRunSchema.parse({
        startedAt: "2026-08-03T06:00:00.000Z",
        distanceMeters: 5000,
        activityType: "run",
      }),
    ).toThrow();
  });

  it("accepts optional smartwatch fields", () => {
    const parsed = createRunSchema.parse({
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 10000,
      durationSeconds: 3600,
      activityType: "trail",
      avgHeartRate: 150,
      maxHeartRate: 175,
      elevationGainMeters: 220,
      calories: 650,
      avgCadence: 172,
      perceivedEffort: 7,
      notes: "hilly",
      source: "manual",
    });
    expect(parsed.avgHeartRate).toBe(150);
    expect(parsed.activityType).toBe("trail");
  });
});

describe("listRunsQuerySchema", () => {
  it("accepts empty filters", () => {
    expect(listRunsQuerySchema.parse({})).toEqual({});
  });

  it("coerces limit from string (REST query params)", () => {
    const parsed = listRunsQuerySchema.parse({ limit: "10" });
    expect(parsed.limit).toBe(10);
  });

  it("rejects invalid activityType", () => {
    expect(() =>
      listRunsQuerySchema.parse({ activityType: "swim" }),
    ).toThrow();
  });

  it("accepts walk activityType", () => {
    const parsed = listRunsQuerySchema.parse({ activityType: "walk" });
    expect(parsed.activityType).toBe("walk");
  });
});
