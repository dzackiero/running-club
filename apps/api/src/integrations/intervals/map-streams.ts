export type IntervalsStream = { type?: string; data?: Array<number | null> };

export type DownsampledStreams = {
  t: number[];
  pace: number[];
  hr: (number | null)[];
};

export function downsampleIntervalsStreams(
  streams: IntervalsStream[],
  maxPoints = 250,
): DownsampledStreams | undefined {
  const time = streamData(streams, "time");
  const velocity =
    streamData(streams, "velocity_smooth") ?? streamData(streams, "velocity");
  if (!time || !velocity || time.length === 0 || velocity.length === 0) {
    return undefined;
  }

  const hr = streamData(streams, "heartrate");
  const length = Math.min(time.length, velocity.length, hr?.length ?? time.length);
  const samples: Array<{ t: number; pace: number; hr: number | null }> = [];

  for (let i = 0; i < length; i += 1) {
    const t = time[i];
    const mps = velocity[i];
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    if (typeof mps !== "number" || !Number.isFinite(mps) || mps <= 0) continue;
    const hrValue = hr?.[i];
    samples.push({
      t,
      pace: 1000 / mps,
      hr:
        typeof hrValue === "number" && Number.isFinite(hrValue) ? hrValue : null,
    });
  }

  if (samples.length === 0) return undefined;

  const count = Math.min(maxPoints, samples.length);
  if (count === samples.length) {
    return {
      t: samples.map((s) => s.t),
      pace: samples.map((s) => s.pace),
      hr: samples.map((s) => s.hr),
    };
  }

  const t: number[] = [];
  const pace: number[] = [];
  const outHr: Array<number | null> = [];
  for (let i = 0; i < count; i += 1) {
    const index =
      count === 1
        ? 0
        : Math.round((i * (samples.length - 1)) / (count - 1));
    const sample = samples[index]!;
    t.push(sample.t);
    pace.push(sample.pace);
    outHr.push(sample.hr);
  }

  return { t, pace, hr: outHr };
}

function streamData(
  streams: IntervalsStream[],
  type: string,
): Array<number | null> | undefined {
  const match = streams.find(
    (stream) => (stream.type ?? "").toLowerCase() === type,
  );
  return match?.data;
}
