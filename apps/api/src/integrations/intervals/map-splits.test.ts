import { describe, expect, it } from "vitest";
import { mapIntervalsLapsToSplits, splitsFromDistanceStream } from "./map-splits";

describe("mapIntervalsLapsToSplits", () => {
  it("keeps LAP rows and skips WORK/REST", () => {
    expect(
      mapIntervalsLapsToSplits([
        {
          type: "LAP",
          distance: 1000,
          moving_time: 300,
          average_heartrate: 148,
        },
        { type: "WORK", distance: 400, moving_time: 90 },
        { type: "REST", distance: 50, moving_time: 60 },
      ]),
    ).toEqual([
      { distanceMeters: 1000, durationSeconds: 300, avgHeartRate: 148 },
    ]);
  });

  it("treats unlabeled ~1km rows as laps", () => {
    expect(
      mapIntervalsLapsToSplits([
        { type: null, distance: 1002, moving_time: 310, average_heartrate: 150 },
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
