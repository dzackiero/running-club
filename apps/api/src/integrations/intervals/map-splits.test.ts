import { describe, expect, it } from "vitest";
import {
  mapIntervalsLapsToSplits,
  splitsFromDistanceStream,
  splitsFromIntervalsStreams,
} from "./map-splits";

describe("mapIntervalsLapsToSplits", () => {
  it("keeps LAP rows and skips WORK/REST", () => {
    expect(
      mapIntervalsLapsToSplits([
        {
          type: "LAP",
          distance: 1000,
          moving_time: 300,
          elapsed_time: 312,
          average_heartrate: 148,
        },
        { type: "WORK", distance: 400, moving_time: 90 },
        { type: "REST", distance: 50, moving_time: 60 },
      ]),
    ).toEqual([
      { distanceMeters: 1000, durationSeconds: 312, avgHeartRate: 148 },
    ]);
  });

  it("falls back to moving time when elapsed is missing", () => {
    expect(
      mapIntervalsLapsToSplits([
        { type: "LAP", distance: 1000, moving_time: 300 },
      ]),
    ).toEqual([{ distanceMeters: 1000, durationSeconds: 300 }]);
  });

  it("treats unlabeled ~1km rows as laps", () => {
    expect(
      mapIntervalsLapsToSplits([
        { type: null, distance: 1002, elapsed_time: 310, average_heartrate: 150 },
      ]),
    ).toEqual([
      { distanceMeters: 1002, durationSeconds: 310, avgHeartRate: 150 },
    ]);
  });
});

describe("splitsFromDistanceStream", () => {
  it("cuts a split each kilometer", () => {
    const time = [0, 150, 300, 450];
    const distance = [0, 500, 1000, 1500];
    const hr = [140, 142, 145, 148];
    const splits = splitsFromDistanceStream(time, distance, hr);
    expect(splits[0]?.distanceMeters).toBeCloseTo(1000, 0);
    expect(splits[0]?.durationSeconds).toBe(300);
  });
});

describe("splitsFromIntervalsStreams", () => {
  it("builds even km splits from velocity when distance is missing", () => {
    const time = Array.from({ length: 501 }, (_, i) => i);
    const velocity = time.map(() => 2);
    const splits = splitsFromIntervalsStreams(
      [
        { type: "time", data: time },
        { type: "velocity_smooth", data: velocity },
      ],
      1000,
    );
    expect(splits).toHaveLength(1);
    expect(splits[0]?.durationSeconds).toBe(500);
  });

  it("keeps pause time inside the kilometer where you stopped", () => {
    const time: number[] = [];
    const velocity: number[] = [];
    for (let t = 0; t <= 250; t += 1) {
      time.push(t);
      velocity.push(2);
    }
    for (let t = 251; t <= 450; t += 1) {
      time.push(t);
      velocity.push(0);
    }
    for (let t = 451; t <= 700; t += 1) {
      time.push(t);
      velocity.push(2);
    }

    const splits = splitsFromIntervalsStreams(
      [
        { type: "time", data: time },
        { type: "velocity_smooth", data: velocity },
      ],
      1000,
    );
    expect(splits).toHaveLength(1);
    expect(splits[0]?.durationSeconds).toBe(700);
  });

  it("scales kilometer-unit distance streams to meters", () => {
    const splits = splitsFromIntervalsStreams(
      [
        { type: "time", data: [0, 500, 1000, 1500, 2000, 2500] },
        { type: "distance", data: [0, 1, 2, 3, 4, 5] },
      ],
      5000,
    );
    expect(splits.map((split) => split.durationSeconds)).toEqual([
      500, 500, 500, 500, 500,
    ]);
  });

  it("prefers velocity over a skewed Intervals distance stream", () => {
    const time = Array.from({ length: 1001 }, (_, i) => i);
    // Broken device distance: first km takes almost the whole run
    const distance = time.map((t) => (t < 700 ? t * (1000 / 700) : 1000 + (t - 700)));
    const velocity = time.map(() => 2); // 2 m/s → 1 km in 500s
    const splits = splitsFromIntervalsStreams(
      [
        { type: "time", data: time },
        { type: "distance", data: distance },
        { type: "velocity_smooth", data: velocity },
      ],
      2000,
    );
    expect(splits[0]?.durationSeconds).toBe(500);
    expect(splits[1]?.durationSeconds).toBe(500);
  });
});
