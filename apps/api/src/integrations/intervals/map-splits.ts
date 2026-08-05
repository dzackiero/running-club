export type IntervalsStream = { type?: string; data?: Array<number | null> };

export type IntervalsLap = {
  type?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  average_heartrate?: number | null;
};

export type MappedSplit = {
  distanceMeters: number;
  durationSeconds: number;
  avgHeartRate?: number;
};

export function mapIntervalsLapsToSplits(laps: IntervalsLap[]): MappedSplit[] {
  const splits: MappedSplit[] = [];
  for (const lap of laps) {
    const type = (lap.type ?? "").trim().toUpperCase();
    if (type === "WORK" || type === "REST" || type === "RECOVERY") continue;

    const distance = lap.distance;
    const duration = lap.elapsed_time ?? lap.moving_time;
    if (
      typeof distance !== "number" ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      continue;
    }
    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      continue;
    }

    const isLap = type === "LAP";
    const unlabeled = type === "";
    if (!isLap && !(unlabeled && distance > 200)) continue;

    const split: MappedSplit = {
      distanceMeters: distance,
      durationSeconds: Math.round(duration),
    };
    if (
      typeof lap.average_heartrate === "number" &&
      Number.isFinite(lap.average_heartrate) &&
      lap.average_heartrate > 0
    ) {
      split.avgHeartRate = Math.round(lap.average_heartrate);
    }
    splits.push(split);
  }
  return splits;
}

export function splitsFromDistanceStream(
  time: number[],
  distance: number[],
  hr?: Array<number | null>,
): MappedSplit[] {
  const length = Math.min(time.length, distance.length);
  if (length < 2) return [];

  const splits: MappedSplit[] = [];
  let nextKm = 1000;
  let splitStartTime = time[0]!;
  let hrSum = 0;
  let hrCount = 0;

  const addHr = (index: number) => {
    const value = hr?.[index];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      hrSum += value;
      hrCount += 1;
    }
  };

  const emit = (endTime: number, distanceMeters: number) => {
    const durationSeconds = Math.round(endTime - splitStartTime);
    if (durationSeconds <= 0 || distanceMeters <= 0) return;
    const split: MappedSplit = { distanceMeters, durationSeconds };
    if (hrCount > 0) split.avgHeartRate = Math.round(hrSum / hrCount);
    splits.push(split);
    splitStartTime = endTime;
    hrSum = 0;
    hrCount = 0;
  };

  addHr(0);
  for (let i = 1; i < length; i += 1) {
    const prevDist = distance[i - 1]!;
    const currDist = distance[i]!;
    const prevTime = time[i - 1]!;
    const currTime = time[i]!;
    addHr(i);

    while (currDist >= nextKm && currDist > prevDist) {
      const ratio = (nextKm - prevDist) / (currDist - prevDist);
      const splitTime = prevTime + ratio * (currTime - prevTime);
      emit(splitTime, 1000);
      nextKm += 1000;
    }
  }

  const finalDistance = distance[length - 1]! - (nextKm - 1000);
  if (finalDistance >= 200) {
    emit(time[length - 1]!, finalDistance);
  }

  return splits;
}

/** Prefer velocity — Intervals distance can be device-skewed (e.g. Huawei). */
export const KM_SPLIT_ALGO = "km-v2";

export function splitsFromIntervalsStreams(
  streams: IntervalsStream[],
  expectedDistanceMeters?: number,
): MappedSplit[] {
  const timeRaw = streamData(streams, "time");
  if (!timeRaw) return [];

  const distRaw = streamData(streams, "distance");
  const velRaw =
    streamData(streams, "velocity_smooth") ?? streamData(streams, "velocity");
  const hrRaw = streamData(streams, "heartrate");

  const built = velRaw
    ? buildFromVelocity(timeRaw, velRaw, hrRaw)
    : distRaw
      ? buildFromDistance(timeRaw, distRaw, hrRaw)
      : null;
  if (!built || built.time.length < 2) return [];

  return splitsFromDistanceStream(
    built.time,
    scaleDistanceToExpected(built.distance, expectedDistanceMeters),
    built.hr,
  );
}

export function splitsFromStoredPaceStreams(
  streams: { t: number[]; pace: number[]; hr?: Array<number | null> },
  expectedDistanceMeters?: number,
): MappedSplit[] {
  const { t, pace } = streams;
  if (t.length < 2 || t.length !== pace.length) return [];

  const distance: number[] = [0];
  for (let i = 1; i < t.length; i += 1) {
    const dt = t[i]! - t[i - 1]!;
    const paceSecPerKm = pace[i]!;
    if (
      !(dt > 0) ||
      !(paceSecPerKm > 0) ||
      !Number.isFinite(dt) ||
      !Number.isFinite(paceSecPerKm)
    ) {
      distance.push(distance[i - 1]!);
      continue;
    }
    distance.push(distance[i - 1]! + (dt * 1000) / paceSecPerKm);
  }

  return splitsFromDistanceStream(
    t,
    scaleDistanceToExpected(distance, expectedDistanceMeters),
    streams.hr,
  );
}

function buildFromVelocity(
  timeRaw: Array<number | null>,
  velRaw: Array<number | null>,
  hrRaw: Array<number | null> | undefined,
): { time: number[]; distance: number[]; hr: Array<number | null> } | null {
  const length = Math.min(timeRaw.length, velRaw.length);
  const time: number[] = [];
  const distance: number[] = [];
  const hr: Array<number | null> = [];
  let acc = 0;
  let prevTime: number | null = null;
  for (let i = 0; i < length; i += 1) {
    const t = timeRaw[i];
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    const mps = finiteOrZero(velRaw[i]);
    if (prevTime != null) acc += Math.max(0, t - prevTime) * mps;
    time.push(t);
    distance.push(acc);
    hr.push(finiteOrNull(hrRaw?.[i]));
    prevTime = t;
  }
  return time.length >= 2 ? { time, distance, hr } : null;
}

function buildFromDistance(
  timeRaw: Array<number | null>,
  distRaw: Array<number | null>,
  hrRaw: Array<number | null> | undefined,
): { time: number[]; distance: number[]; hr: Array<number | null> } | null {
  const length = Math.min(timeRaw.length, distRaw.length);
  const time: number[] = [];
  const distance: number[] = [];
  const hr: Array<number | null> = [];
  for (let i = 0; i < length; i += 1) {
    const t = timeRaw[i];
    const d = distRaw[i];
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    if (typeof d !== "number" || !Number.isFinite(d) || d < 0) continue;
    time.push(t);
    distance.push(d);
    hr.push(finiteOrNull(hrRaw?.[i]));
  }
  if (time.length < 2) return null;
  return {
    time,
    distance: normalizeDistanceUnits(distance),
    hr,
  };
}

function streamData(
  streams: IntervalsStream[],
  type: string,
): Array<number | null> | undefined {
  return streams.find((stream) => (stream.type ?? "").toLowerCase() === type)
    ?.data;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function normalizeDistanceUnits(distance: number[]): number[] {
  const maxD = distance[distance.length - 1] ?? 0;
  if (maxD > 0 && maxD < 100) return distance.map((value) => value * 1000);
  return distance;
}

function scaleDistanceToExpected(
  distance: number[],
  expectedDistanceMeters?: number,
): number[] {
  const maxD = distance[distance.length - 1] ?? 0;
  if (
    !(maxD > 0) ||
    expectedDistanceMeters == null ||
    !(expectedDistanceMeters > 0)
  ) {
    return distance;
  }
  const ratio = expectedDistanceMeters / maxD;
  if (ratio < 0.5 || ratio > 1.5) return distance;
  return distance.map((value) => value * ratio);
}
