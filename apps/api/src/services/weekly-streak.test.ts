import { describe, expect, it } from "vitest";
import { computeWeeklyStreak } from "./weekly-streak";

describe("computeWeeklyStreak", () => {
  const monday = 1;
  const now = new Date("2026-08-05T12:00:00.000Z"); // Wed, week Mon Aug 3–Sun Aug 9

  it("returns zeros when there are no runs", () => {
    expect(computeWeeklyStreak([], monday, now)).toEqual({
      currentWeeks: 0,
      bestWeeks: 0,
    });
  });

  it("counts consecutive weeks ending this week as the current streak", () => {
    const startedAts = [
      new Date("2026-08-04T06:00:00.000Z"),
      new Date("2026-07-28T06:00:00.000Z"),
      new Date("2026-07-21T06:00:00.000Z"),
    ];

    expect(computeWeeklyStreak(startedAts, monday, now)).toEqual({
      currentWeeks: 3,
      bestWeeks: 3,
    });
  });

  it("keeps the current streak alive when this week has no run yet", () => {
    const startedAts = [
      new Date("2026-07-28T06:00:00.000Z"),
      new Date("2026-07-22T06:00:00.000Z"),
    ];

    expect(computeWeeklyStreak(startedAts, monday, now)).toEqual({
      currentWeeks: 2,
      bestWeeks: 2,
    });
  });

  it("breaks the current streak when last week was missed", () => {
    const startedAts = [
      new Date("2026-08-04T06:00:00.000Z"),
      new Date("2026-07-21T06:00:00.000Z"),
    ];

    expect(computeWeeklyStreak(startedAts, monday, now)).toEqual({
      currentWeeks: 1,
      bestWeeks: 1,
    });
  });

  it("tracks a historical best streak longer than the current one", () => {
    const startedAts = [
      new Date("2026-08-04T06:00:00.000Z"),
      new Date("2026-06-02T06:00:00.000Z"),
      new Date("2026-06-09T06:00:00.000Z"),
      new Date("2026-06-16T06:00:00.000Z"),
      new Date("2026-06-23T06:00:00.000Z"),
    ];

    expect(computeWeeklyStreak(startedAts, monday, now)).toEqual({
      currentWeeks: 1,
      bestWeeks: 4,
    });
  });

  it("respects a Sunday week start", () => {
    const sunday = 0;
    const startedAts = [
      new Date("2026-08-02T06:00:00.000Z"), // Sun — current week Aug 2–8
      new Date("2026-07-26T06:00:00.000Z"), // previous Sunday week
    ];

    expect(
      computeWeeklyStreak(startedAts, sunday, new Date("2026-08-05T12:00:00.000Z")),
    ).toEqual({
      currentWeeks: 2,
      bestWeeks: 2,
    });
  });

  it("counts multiple runs in the same week once", () => {
    const startedAts = [
      new Date("2026-08-03T06:00:00.000Z"),
      new Date("2026-08-05T06:00:00.000Z"),
      new Date("2026-08-06T06:00:00.000Z"),
    ];

    expect(computeWeeklyStreak(startedAts, monday, now)).toEqual({
      currentWeeks: 1,
      bestWeeks: 1,
    });
  });
});
