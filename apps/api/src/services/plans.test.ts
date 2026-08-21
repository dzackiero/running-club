import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { planOccurrence, planTemplate, run } from "../db/schema";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import {
  ensurePlanOccurrences,
  getTodayDashboard,
  updatePlanOccurrence,
} from "./plans";

const recurrenceUserId = "user_test_plans_recurrence";
const otherUserId = "user_test_plans_other";
const dashboardUserId = "user_test_plans_dashboard";
const testUserIds = [recurrenceUserId, otherUserId, dashboardUserId];

describe("plans service", () => {
  beforeAll(async () => {
    await ensureTestUsers(testUserIds);
  });

  afterAll(async () => {
    await deleteTestUsers(testUserIds);
  });

  it("materializes a Tuesday template once and keeps its original snapshot after template edits", async () => {
    const templateId = crypto.randomUUID();
    await db.insert(planTemplate).values({
      id: templateId,
      userId: recurrenceUserId,
      weekday: 2,
      category: "run",
      title: "Easy 6 km",
      details: { targetDistanceMeters: 6000 },
    });

    await ensurePlanOccurrences(
      recurrenceUserId,
      new Date("2026-08-04T12:00:00.000Z"),
      new Date("2026-08-04T12:00:00.000Z"),
    );
    await ensurePlanOccurrences(
      recurrenceUserId,
      new Date("2026-08-04T12:00:00.000Z"),
      new Date("2026-08-04T12:00:00.000Z"),
    );

    const occurrences = await db
      .select()
      .from(planOccurrence)
      .where(
        and(
          eq(planOccurrence.userId, recurrenceUserId),
          eq(planOccurrence.templateId, templateId),
          eq(planOccurrence.date, "2026-08-04"),
        ),
      );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.title).toBe("Easy 6 km");

    await db
      .update(planTemplate)
      .set({ title: "Hard 8 km" })
      .where(eq(planTemplate.id, templateId));
    await ensurePlanOccurrences(
      recurrenceUserId,
      new Date("2026-08-04T12:00:00.000Z"),
      new Date("2026-08-04T12:00:00.000Z"),
    );

    const [occurrence] = await db
      .select()
      .from(planOccurrence)
      .where(eq(planOccurrence.id, occurrences[0]!.id));
    expect(occurrence?.title).toBe("Easy 6 km");
  });

  it("does not update an occurrence owned by another user", async () => {
    const occurrenceId = crypto.randomUUID();
    await db.insert(planOccurrence).values({
      id: occurrenceId,
      userId: recurrenceUserId,
      date: "2026-08-04",
      category: "gym",
      title: "Upper body",
      details: { focus: "upper" },
    });

    const updated = await updatePlanOccurrence(otherUserId, occurrenceId, {
      status: "done",
    });

    expect(updated).toBeNull();
    const [stored] = await db
      .select()
      .from(planOccurrence)
      .where(eq(planOccurrence.id, occurrenceId));
    expect(stored?.status).toBe("planned");
  });

  it("attaches a same-day run and completes the planned run occurrence", async () => {
    const occurrenceId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    await db.insert(planOccurrence).values({
      id: occurrenceId,
      userId: recurrenceUserId,
      date: "2026-08-04",
      category: "run",
      title: "Easy run",
      details: { targetDistanceMeters: 5000 },
    });
    await db.insert(run).values({
      id: runId,
      userId: recurrenceUserId,
      startedAt: new Date("2026-08-04T07:00:00.000Z"),
      distanceMeters: 5000,
      durationSeconds: 1800,
      activityType: "run",
      source: "manual",
    });

    await expect(
      updatePlanOccurrence(recurrenceUserId, occurrenceId, { linkedRunId: runId }),
    ).resolves.toMatchObject({
      id: occurrenceId,
      status: "done",
      linkedRunId: runId,
    });
  });

  it("returns a seven-day dashboard with category progress counts", async () => {
    const templateRows = [
      {
        id: crypto.randomUUID(),
        userId: dashboardUserId,
        weekday: 1,
        category: "run" as const,
        title: "Monday run",
        details: { targetDistanceMeters: 5000 },
      },
      {
        id: crypto.randomUUID(),
        userId: dashboardUserId,
        weekday: 2,
        category: "gym" as const,
        title: "Tuesday gym",
        details: { focus: "legs" },
      },
      {
        id: crypto.randomUUID(),
        userId: dashboardUserId,
        weekday: 3,
        category: "nutrition" as const,
        title: "Wednesday protein",
        details: { targetProteinGrams: 150 },
      },
    ];
    await db.insert(planTemplate).values(templateRows);

    const dashboard = await getTodayDashboard(
      dashboardUserId,
      new Date("2026-08-04T12:00:00.000Z"),
    );

    expect(dashboard.date).toBe("2026-08-04");
    expect(dashboard.items.map((item) => item.title)).toEqual(["Tuesday gym"]);
    expect(dashboard.week.start).toBe("2026-08-03");
    expect(dashboard.week.end).toBe("2026-08-09");
    expect(dashboard.week.days).toHaveLength(7);
    expect(dashboard.week.days.map((day) => day.date)).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
    expect(dashboard.week.running).toEqual({
      distanceMeters: 5000,
      completedSessions: 0,
      plannedSessions: 1,
    });
    expect(dashboard.week.gym).toEqual({
      completedSessions: 0,
      plannedSessions: 1,
    });
    expect(dashboard.week.nutrition).toEqual({
      targetDays: 1,
      achievedDays: 0,
      today: {
        calories: 0,
        proteinGrams: 0,
        targetCalories: null,
        targetProteinGrams: null,
      },
    });
  });
});
