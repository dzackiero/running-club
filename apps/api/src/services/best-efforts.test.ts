import { describe, expect, it } from "vitest";
import {
  bestEffortFromStreams,
  rankBestEfforts,
  wholeRunBestEffort,
} from "./best-efforts";

function constantPaceStreams(opts: {
  distanceMeters: number;
  paceSecPerKm: number;
  stepSeconds?: number;
}): { t: number[]; pace: number[] } {
  const stepSeconds = opts.stepSeconds ?? 20;
  const totalSeconds = (opts.distanceMeters / 1000) * opts.paceSecPerKm;
  const t: number[] = [];
  const pace: number[] = [];
  for (let elapsed = 0; elapsed <= totalSeconds + 0.001; elapsed += stepSeconds) {
    t.push(elapsed);
    pace.push(opts.paceSecPerKm);
  }
  if (t[t.length - 1] !== totalSeconds) {
    t.push(totalSeconds);
    pace.push(opts.paceSecPerKm);
  }
  return { t, pace };
}

describe("bestEffortFromStreams", () => {
  it("returns null when reconstructed distance is short of the target", () => {
    const streams = constantPaceStreams({
      distanceMeters: 400,
      paceSecPerKm: 300,
    });
    expect(bestEffortFromStreams(streams, 1000)).toBeNull();
  });

  it("returns elapsed time for a steady 1k", () => {
    const streams = constantPaceStreams({
      distanceMeters: 1000,
      paceSecPerKm: 300,
      stepSeconds: 10,
    });
    expect(bestEffortFromStreams(streams, 1000)).toBe(300);
  });

  it("finds the fastest rolling 1k inside a longer run", () => {
    const t: number[] = [];
    const pace: number[] = [];
    let elapsed = 0;
    const pushSegment = (meters: number, paceSecPerKm: number) => {
      const seconds = (meters / 1000) * paceSecPerKm;
      const end = elapsed + seconds;
      for (let cursor = elapsed; cursor < end; cursor += 10) {
        t.push(cursor);
        pace.push(paceSecPerKm);
      }
      elapsed = end;
      t.push(elapsed);
      pace.push(paceSecPerKm);
    };

    pushSegment(1000, 360);
    pushSegment(1000, 240);
    pushSegment(1000, 360);

    expect(bestEffortFromStreams({ t, pace }, 1000)).toBe(240);
  });
});

describe("wholeRunBestEffort", () => {
  it("uses elapsed pace scaled to the target when the run covers it", () => {
    expect(wholeRunBestEffort(5000, 1500, 5000)).toBe(1500);
    expect(wholeRunBestEffort(10000, 3000, 5000)).toBe(1500);
  });

  it("returns null when the run is shorter than the target", () => {
    expect(wholeRunBestEffort(4000, 1200, 5000)).toBeNull();
  });
});

describe("rankBestEfforts", () => {
  it("prefers a faster stream window over the whole-run fallback", () => {
    const ranked = rankBestEfforts([
      {
        id: "long-with-fast-km",
        startedAt: "2026-08-01T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1800,
        activityType: "run",
        streams: (() => {
          const t: number[] = [];
          const pace: number[] = [];
          let elapsed = 0;
          const push = (meters: number, paceSecPerKm: number) => {
            const seconds = (meters / 1000) * paceSecPerKm;
            const end = elapsed + seconds;
            for (let cursor = elapsed; cursor < end; cursor += 10) {
              t.push(cursor);
              pace.push(paceSecPerKm);
            }
            elapsed = end;
            t.push(elapsed);
            pace.push(paceSecPerKm);
          };
          push(1000, 240);
          push(4000, 390);
          return { t, pace, hr: t.map(() => null) };
        })(),
      },
    ]);

    const oneK = ranked.find((row) => row.label === "1k");
    expect(oneK?.efforts[0]?.durationSeconds).toBe(240);
    expect(oneK?.efforts[0]?.source).toBe("stream");
    expect(oneK?.efforts[0]?.runId).toBe("long-with-fast-km");
  });

  it("returns top 3 times per distance and omits empty distances", () => {
    const ranked = rankBestEfforts([
      {
        id: "a",
        startedAt: "2026-07-01T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1600,
        activityType: "run",
        streams: null,
      },
      {
        id: "b",
        startedAt: "2026-07-08T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1500,
        activityType: "run",
        streams: null,
      },
      {
        id: "c",
        startedAt: "2026-07-15T06:00:00.000Z",
        distanceMeters: 5200,
        durationSeconds: 1560,
        activityType: "run",
        streams: null,
      },
      {
        id: "d",
        startedAt: "2026-07-22T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1700,
        activityType: "run",
        streams: null,
      },
    ]);

    expect(ranked.map((row) => row.label)).toEqual(["1k", "5k"]);
    const fiveK = ranked.find((row) => row.label === "5k");
    expect(fiveK?.efforts.map((effort) => effort.runId)).toEqual(["b", "c", "a"]);
    expect(fiveK?.efforts.map((effort) => effort.rank)).toEqual([1, 2, 3]);
    expect(fiveK?.efforts[1]?.durationSeconds).toBe(1500);
  });

  it("prefers a stream effort when whole-run pace matches the same time", () => {
    const ranked = rankBestEfforts([
      {
        id: "exact-5k",
        startedAt: "2026-07-01T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1500,
        activityType: "run",
        streams: null,
      },
      {
        id: "stream-5k",
        startedAt: "2026-07-08T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1500,
        activityType: "run",
        streams: {
          t: [0, 300, 600, 900, 1200, 1500],
          pace: [300, 300, 300, 300, 300, 300],
          hr: [null, null, null, null, null, null],
        },
      },
    ]);

    const fiveK = ranked.find((row) => row.label === "5k");
    expect(fiveK?.efforts[0]).toMatchObject({
      runId: "stream-5k",
      source: "stream",
      durationSeconds: 1500,
    });
  });

  it("ignores walks for best performances", () => {
    const ranked = rankBestEfforts([
      {
        id: "walk",
        startedAt: "2026-07-01T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 2400,
        activityType: "walk",
        streams: null,
      },
    ]);
    expect(ranked).toEqual([]);
  });
});
