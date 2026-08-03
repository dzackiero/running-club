import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { run } from "../db/schema";
import { createRun, deleteRun, getRun, listRuns } from "./runs";

const userId = "user_test_1";
const otherUserId = "user_test_other";
const testUserIds = [userId, otherUserId];

describe("runs service", () => {
  afterAll(async () => {
    await db.delete(run).where(inArray(run.userId, testUserIds));
  });

  it("creates a run with required fields and derived pace", async () => {
    const created = await createRun(userId, {
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    expect(created.id).toBeTruthy();
    expect(created.avgPaceSecPerKm).toBe(300);
    expect(created.source).toBe("manual");
  });

  it("lists only the owning user's runs", async () => {
    await createRun(otherUserId, {
      startedAt: "2026-08-03T07:00:00.000Z",
      distanceMeters: 1000,
      durationSeconds: 400,
      activityType: "run",
    });
    const mine = await listRuns(userId, {});
    expect(mine.every((r) => r.userId === userId)).toBe(true);
  });

  it("deletes owned run", async () => {
    const created = await createRun(userId, {
      startedAt: "2026-08-03T08:00:00.000Z",
      distanceMeters: 2000,
      durationSeconds: 700,
      activityType: "treadmill",
    });
    expect(await deleteRun(userId, created.id)).toBe(true);
    expect(await getRun(userId, created.id)).toBeNull();
  });
});
