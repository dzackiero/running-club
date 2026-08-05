import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import { upsertCurrentGoal } from "./goals";
import { createRun } from "./runs";
import { getSummary, getWeekProgress, getInsightsOverview } from "./insights";

const summaryUserId = "user_test_insights_summary";
const weekUserId = "user_test_insights_week";
const noGoalUserId = "user_test_insights_no_goal";
const overviewUserId = "user_test_insights_overview";
const overviewMonthUserId = "user_test_insights_overview_month";
const testUserIds = [
  summaryUserId,
  weekUserId,
  noGoalUserId,
  overviewUserId,
  overviewMonthUserId,
];

describe("insights service", () => {
  beforeAll(async () => {
    await ensureTestUsers(testUserIds);
  });

  afterAll(async () => {
    await deleteTestUsers(testUserIds);
  });

  it("getSummary aggregates current period and compares to previous period", async () => {
    const from = "2026-08-01T00:00:00.000Z";
    const to = "2026-08-07T23:59:59.999Z";

    await createRun(summaryUserId, {
      startedAt: "2026-08-02T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    await createRun(summaryUserId, {
      startedAt: "2026-08-02T18:00:00.000Z",
      distanceMeters: 3000,
      durationSeconds: 900,
      activityType: "run",
    });
    await createRun(summaryUserId, {
      startedAt: "2026-08-05T07:00:00.000Z",
      distanceMeters: 10000,
      durationSeconds: 3000,
      activityType: "run",
    });
    await createRun(summaryUserId, {
      startedAt: "2026-07-26T06:00:00.000Z",
      distanceMeters: 4000,
      durationSeconds: 1200,
      activityType: "run",
    });
    await createRun(summaryUserId, {
      startedAt: "2026-07-28T06:00:00.000Z",
      distanceMeters: 6000,
      durationSeconds: 1800,
      activityType: "run",
    });

    const summary = await getSummary(summaryUserId, { from, to });

    expect(summary.from).toBe(from);
    expect(summary.to).toBe(to);
    expect(summary.totalDistanceMeters).toBe(18000);
    expect(summary.totalDurationSeconds).toBe(5400);
    expect(summary.runCount).toBe(3);
    expect(summary.avgPaceSecPerKm).toBe(300);
    expect(summary.daysWithRun).toBe(2);

    expect(summary.previousPeriod.totalDistanceMeters).toBe(10000);
    expect(summary.previousPeriod.totalDurationSeconds).toBe(3000);
    expect(summary.previousPeriod.runCount).toBe(2);
    expect(summary.previousPeriod.avgPaceSecPerKm).toBe(300);
  });

  it("getWeekProgress returns totals and goal ratios for the current UTC week", async () => {
    await upsertCurrentGoal(weekUserId, {
      weekStartsOn: 1,
      targetDistanceMeters: 20000,
      targetDurationSeconds: 6000,
      targetRunCount: 5,
    });

    await createRun(weekUserId, {
      startedAt: "2026-08-04T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    await createRun(weekUserId, {
      startedAt: "2026-08-05T07:00:00.000Z",
      distanceMeters: 3000,
      durationSeconds: 900,
      activityType: "run",
    });
    await createRun(weekUserId, {
      startedAt: "2026-08-06T08:00:00.000Z",
      distanceMeters: 2000,
      durationSeconds: 600,
      activityType: "run",
    });
    await createRun(weekUserId, {
      startedAt: "2026-07-28T06:00:00.000Z",
      distanceMeters: 9999,
      durationSeconds: 9999,
      activityType: "run",
    });

    const progress = await getWeekProgress(
      weekUserId,
      new Date("2026-08-06T12:00:00.000Z"),
    );

    expect(progress.weekStart).toBe("2026-08-03T00:00:00.000Z");
    expect(progress.weekEnd).toBe("2026-08-09T23:59:59.999Z");
    expect(progress.totals.distanceMeters).toBe(10000);
    expect(progress.totals.durationSeconds).toBe(3000);
    expect(progress.totals.runCount).toBe(3);
    expect(progress.goal?.targetDistanceMeters).toBe(20000);
    expect(progress.progress.distanceRatio).toBe(0.5);
    expect(progress.progress.durationRatio).toBe(0.5);
    expect(progress.progress.runCountRatio).toBe(0.6);
  });

  it("getWeekProgress returns null ratios when no goal is set", async () => {
    const progress = await getWeekProgress(
      noGoalUserId,
      new Date("2026-08-06T12:00:00.000Z"),
    );

    expect(progress.goal).toBeNull();
    expect(progress.progress.distanceRatio).toBeNull();
    expect(progress.progress.durationRatio).toBeNull();
    expect(progress.progress.runCountRatio).toBeNull();
  });

  it("getWeekProgress can target a past week via now", async () => {
    await upsertCurrentGoal(weekUserId, {
      weekStartsOn: 1,
      targetDistanceMeters: 20000,
    });

    const progress = await getWeekProgress(
      weekUserId,
      new Date("2026-07-30T12:00:00.000Z"),
    );

    expect(progress.weekStart).toBe("2026-07-27T00:00:00.000Z");
    expect(progress.weekEnd).toBe("2026-08-02T23:59:59.999Z");
    expect(progress.totals.distanceMeters).toBe(9999);
    expect(progress.totals.runCount).toBe(1);
  });

  it("getInsightsOverview defaults to this calendar month with day grain when short", async () => {
    await upsertCurrentGoal(overviewUserId, {
      weekStartsOn: 1,
      targetDistanceMeters: 8000,
    });

    await createRun(overviewUserId, {
      startedAt: "2026-08-04T06:00:00.000Z",
      distanceMeters: 10000,
      durationSeconds: 3000,
      activityType: "run",
    });
    await createRun(overviewUserId, {
      startedAt: "2026-08-02T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    // Prior equal-length window ≈ July 26–31 for Aug 1–6
    await createRun(overviewUserId, {
      startedAt: "2026-07-28T06:00:00.000Z",
      distanceMeters: 4000,
      durationSeconds: 1200,
      activityType: "run",
    });

    const overview = await getInsightsOverview(overviewUserId, {
      now: new Date("2026-08-06T12:00:00.000Z"),
    });

    expect(overview.from).toBe("2026-08-01T00:00:00.000Z");
    expect(overview.to).toBe("2026-08-06T23:59:59.999Z");
    expect(overview.grain).toBe("day");
    expect(overview.buckets).toHaveLength(6);
    expect(overview.totals.distanceMeters).toBe(15000);
    expect(overview.totals.runCount).toBe(2);
    expect(overview.previous.runCount).toBe(1);
    expect(overview.sparse).toBe(false);
    expect(overview.consistency.daysWithRun).toBe(2);
  });

  it("getInsightsOverview respects explicit week grain", async () => {
    const overview = await getInsightsOverview(overviewUserId, {
      now: new Date("2026-08-06T12:00:00.000Z"),
      grain: "week",
    });
    expect(overview.grain).toBe("week");
    expect(overview.buckets.length).toBeGreaterThanOrEqual(1);
  });

  it("getInsightsOverview uses month grain for longer ranges", async () => {
    await createRun(overviewMonthUserId, {
      startedAt: "2026-06-15T06:00:00.000Z",
      distanceMeters: 6000,
      durationSeconds: 1800,
      activityType: "run",
    });
    await createRun(overviewMonthUserId, {
      startedAt: "2026-08-02T06:00:00.000Z",
      distanceMeters: 7000,
      durationSeconds: 2100,
      activityType: "run",
    });

    const overview = await getInsightsOverview(overviewMonthUserId, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-08-06T23:59:59.999Z",
      grain: "month",
    });

    expect(overview.grain).toBe("month");
    expect(overview.buckets).toHaveLength(3);
    expect(overview.totals.distanceMeters).toBe(13000);
  });
});
