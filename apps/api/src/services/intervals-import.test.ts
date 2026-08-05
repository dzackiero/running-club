import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IntervalsHttpError } from "../integrations/intervals/errors";
import { importFromIntervals } from "./intervals-import";
import { getRun, listRuns } from "./runs";
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

  it("enriches new runs with detail and streams", async () => {
    const result = await importFromIntervals(userId, {
      listActivities: async () => [
        {
          id: "i-enrich-1",
          type: "Run",
          name: "Tracked",
          start_date: "2026-07-03T00:00:00Z",
          distance: 5000,
          moving_time: 1500,
          average_heartrate: 150,
        },
      ],
      getActivity: async () => ({
        id: "i-enrich-1",
        type: "Run",
        name: "Tracked",
        start_date: "2026-07-03T00:00:00Z",
        distance: 5000,
        moving_time: 1500,
        average_heartrate: 150,
        icu_training_load: 65,
        icu_intensity: 75,
        gap: 3.2,
        icu_hr_zone_times: [100, 800, 600],
        map: { summary_polyline: "abc" },
        icu_intervals: [
          {
            type: "LAP",
            distance: 1000,
            moving_time: 300,
            average_heartrate: 148,
          },
        ],
      }),
      getStreams: async () => [
        { type: "time", data: [0, 60, 120] },
        { type: "velocity_smooth", data: [3.3, 3.3, 3.3] },
        { type: "heartrate", data: [140, 145, 150] },
      ],
    });
    expect(result).toEqual({ imported: 1, updated: 0, skipped: 0 });
    const run = (await listRuns(userId, {})).find(
      (row) => row.externalId === "i-enrich-1",
    );
    expect(run?.trainingLoad).toBe(65);
    expect(run?.polyline).toBe("abc");
    const full = await getRun(userId, run!.id);
    expect(full?.streams?.t.length).toBeGreaterThan(0);
  });

  it("skips stream refetch when summary is unchanged", async () => {
    let streamCalls = 0;
    const listItem = {
      id: "i-enrich-2",
      type: "Run",
      name: "Stable",
      start_date: "2026-07-04T00:00:00Z",
      distance: 4000,
      moving_time: 1200,
      average_heartrate: 140,
    };
    const client = {
      listActivities: async () => [listItem],
      getActivity: async () => ({
        ...listItem,
        icu_training_load: 40,
        icu_intervals: [
          {
            type: "LAP",
            distance: 1000,
            moving_time: 300,
            average_heartrate: 140,
          },
        ],
      }),
      getStreams: async () => {
        streamCalls += 1;
        return [
          { type: "time", data: [0, 30] },
          { type: "velocity_smooth", data: [3.3, 3.3] },
          { type: "heartrate", data: [140, 141] },
        ];
      },
    };
    await importFromIntervals(userId, client);
    await importFromIntervals(userId, client);
    expect(streamCalls).toBe(1);
  });

  it("rethrows 429 so sync is not marked complete", async () => {
    await expect(
      importFromIntervals(userId, {
        listActivities: async () => [
          {
            id: "i-429",
            type: "Run",
            name: "Limited",
            start_date: "2026-07-05T00:00:00Z",
            distance: 3000,
            moving_time: 900,
          },
        ],
        getActivity: async () => {
          throw new IntervalsHttpError(429, "rate limited");
        },
      }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
