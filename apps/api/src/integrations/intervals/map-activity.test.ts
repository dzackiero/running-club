import { describe, expect, it } from "vitest";
import { mapIntervalsActivityToRun } from "./map-activity";

const baseRun = {
  id: "i100",
  type: "Run",
  name: "Easy 5k",
  description: "keep it chill",
  start_date: "2026-08-04T03:02:15Z",
  distance: 5000,
  moving_time: 1500,
  elapsed_time: 1520,
  average_heartrate: 148,
  max_heartrate: 167,
  total_elevation_gain: 42,
  calories: 320,
  average_cadence: 172,
  perceived_exertion: 5,
  race: false,
  trainer: false,
};

describe("mapIntervalsActivityToRun", () => {
  it("maps a run into Cup Run fields", () => {
    expect(mapIntervalsActivityToRun(baseRun)).toEqual({
      startedAt: "2026-08-04T03:02:15.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
      avgHeartRate: 148,
      maxHeartRate: 167,
      elevationGainMeters: 42,
      calories: 320,
      avgCadence: 172,
      perceivedEffort: 5,
      notes: "Easy 5k\n\nkeep it chill",
      source: "intervals",
      externalId: "i100",
    });
  });

  it("maps walk, virtual run, and race", () => {
    expect(mapIntervalsActivityToRun({ ...baseRun, type: "Walk" })?.activityType).toBe(
      "walk",
    );
    expect(
      mapIntervalsActivityToRun({ ...baseRun, type: "VirtualRun" })?.activityType,
    ).toBe("treadmill");
    expect(
      mapIntervalsActivityToRun({ ...baseRun, type: "Run", race: true })
        ?.activityType,
    ).toBe("race");
    expect(
      mapIntervalsActivityToRun({ ...baseRun, type: "Walk", trainer: true })
        ?.activityType,
    ).toBe("walk");
  });

  it("skips non-running workouts and incomplete activities", () => {
    expect(mapIntervalsActivityToRun({ ...baseRun, type: "Workout" })).toBeNull();
    expect(mapIntervalsActivityToRun({ ...baseRun, distance: 0 })).toBeNull();
    expect(mapIntervalsActivityToRun({ ...baseRun, moving_time: 0, elapsed_time: 0 })).toBeNull();
  });
});
