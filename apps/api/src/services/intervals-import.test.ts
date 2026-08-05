import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importFromIntervals } from "./intervals-import";
import { listRuns } from "./runs";
import { deleteTestUsers, ensureTestUsers } from "../test/users";

const userId = "user_intervals_import";

describe("importFromIntervals", () => {
  beforeAll(async () => {
    await ensureTestUsers([userId]);
  });

  afterAll(async () => {
    await deleteTestUsers([userId]);
  });

  it("imports run-like activities and updates on reimport", async () => {
    const activities = [
      {
        id: "i-import-1",
        type: "Run",
        name: "First import",
        start_date: "2026-07-01T00:00:00Z",
        distance: 4000,
        moving_time: 1200,
      },
      {
        id: "i-skip-workout",
        type: "Workout",
        name: "Strength",
        start_date: "2026-07-02T00:00:00Z",
        distance: 0,
        moving_time: 1800,
      },
    ];

    const first = await importFromIntervals(userId, {
      listActivities: async () => activities,
    });

    expect(first).toEqual({ imported: 1, updated: 0, skipped: 1 });

    const second = await importFromIntervals(userId, {
      listActivities: async () => [
        {
          ...activities[0],
          distance: 4200,
          moving_time: 1260,
          name: "First import updated",
        },
      ],
    });

    expect(second).toEqual({ imported: 0, updated: 1, skipped: 0 });

    const runs = await listRuns(userId, {});
    const imported = runs.find((run) => run.externalId === "i-import-1");
    expect(imported?.source).toBe("intervals");
    expect(imported?.distanceMeters).toBe(4200);
    expect(imported?.durationSeconds).toBe(1260);
  });
});
