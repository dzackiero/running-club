import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRun, deleteRun, getRun, listRuns } from "./runs";
import { deleteTestUsers, ensureTestUsers } from "../test/users";

const userId = "user_test_1";
const otherUserId = "user_test_other";
const testUserIds = [userId, otherUserId];

describe("runs service", () => {
  beforeAll(async () => {
    await ensureTestUsers(testUserIds);
  });

  afterAll(async () => {
    await deleteTestUsers(testUserIds);
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

  it("stores analysis on getRun and omits streams from listRuns", async () => {
    const created = await createRun(userId, {
      startedAt: "2026-08-03T09:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
      trainingLoad: 70,
      intensity: 80,
      gapPaceSecPerKm: 290,
      hrZoneSeconds: [0, 600, 900],
      hrZoneBpm: [0, 141, 158, 175],
      streams: {
        t: [0, 60],
        pace: [300, 295],
        hr: [140, 150],
      },
      splits: [{ distanceMeters: 1000, durationSeconds: 300, avgHeartRate: 144 }],
      polyline: "_p~iF~ps|U_ulLnnqC",
    });

    const fetched = await getRun(userId, created.id);
    expect(fetched?.trainingLoad).toBe(70);
    expect(fetched?.hrZoneBpm).toEqual([0, 141, 158, 175]);
    expect(fetched?.streams?.t).toEqual([0, 60]);
    expect(fetched?.splits?.[0]?.avgHeartRate).toBe(144);

    const listed = await listRuns(userId, { limit: 50 });
    const row = listed.find((run) => run.id === created.id);
    expect(row?.trainingLoad).toBe(70);
    expect(row?.streams).toBeNull();
  });
});
