import { describe, expect, it } from "vitest";
import { downsampleIntervalsStreams } from "./map-streams";

describe("downsampleIntervalsStreams", () => {
  it("builds equal-length pace and hr series and caps length", () => {
    const time = Array.from({ length: 500 }, (_, i) => i);
    const velocity = time.map(() => 3.333);
    const hr = time.map((t) => (t % 10 === 0 ? null : 150));
    const streams = downsampleIntervalsStreams(
      [
        { type: "time", data: time },
        { type: "velocity_smooth", data: velocity },
        { type: "heartrate", data: hr },
      ],
      250,
    );
    expect(streams?.t).toHaveLength(250);
    expect(streams?.pace).toHaveLength(250);
    expect(streams?.hr).toHaveLength(250);
    expect(streams?.pace[0]).toBeCloseTo(300, 0);
    expect(streams?.hr[0]).toBeNull();
  });

  it("returns undefined when time or velocity is missing", () => {
    expect(
      downsampleIntervalsStreams([{ type: "heartrate", data: [140] }]),
    ).toBeUndefined();
  });
});
