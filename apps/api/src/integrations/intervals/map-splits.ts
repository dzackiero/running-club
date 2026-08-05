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
    const duration = lap.moving_time ?? lap.elapsed_time;
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
