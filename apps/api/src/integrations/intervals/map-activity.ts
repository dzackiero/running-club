import type { CreateRunInput } from "@running-club/shared";

export type IntervalsActivity = {
  id: string;
  type?: string | null;
  name?: string | null;
  description?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  total_elevation_gain?: number | null;
  calories?: number | null;
  average_cadence?: number | null;
  perceived_exertion?: number | null;
  race?: boolean | null;
  trainer?: boolean | null;
};

export function mapIntervalsActivityToRun(
  activity: IntervalsActivity,
): CreateRunInput | null {
  const activityType = mapActivityType(activity);
  if (!activityType) return null;

  const startedAt = toIsoDatetime(activity.start_date ?? activity.start_date_local);
  const distanceMeters = positiveNumber(activity.distance);
  const durationSeconds = Math.round(
    positiveNumber(activity.moving_time) ??
      positiveNumber(activity.elapsed_time) ??
      0,
  );

  if (!startedAt || !distanceMeters || durationSeconds <= 0) return null;

  const perceivedEffort = mapPerceivedEffort(activity.perceived_exertion);
  const notes = [activity.name?.trim(), activity.description?.trim()]
    .filter(Boolean)
    .join("\n\n");

  return {
    startedAt,
    distanceMeters,
    durationSeconds,
    activityType,
    ...(positiveInt(activity.average_heartrate)
      ? { avgHeartRate: positiveInt(activity.average_heartrate) }
      : {}),
    ...(positiveInt(activity.max_heartrate)
      ? { maxHeartRate: positiveInt(activity.max_heartrate) }
      : {}),
    ...(nonNegativeNumber(activity.total_elevation_gain) != null
      ? { elevationGainMeters: nonNegativeNumber(activity.total_elevation_gain) }
      : {}),
    ...(nonNegativeNumber(activity.calories) != null
      ? { calories: nonNegativeNumber(activity.calories) }
      : {}),
    ...(positiveNumber(activity.average_cadence)
      ? { avgCadence: positiveNumber(activity.average_cadence) }
      : {}),
    ...(perceivedEffort != null ? { perceivedEffort } : {}),
    ...(notes ? { notes } : {}),
    source: "intervals",
    externalId: activity.id,
  };
}

function mapActivityType(
  activity: IntervalsActivity,
): CreateRunInput["activityType"] | null {
  const type = (activity.type ?? "").toLowerCase();
  if (!type || type === "workout" || type === "ride" || type === "virtualride") {
    return null;
  }
  if (type === "walk" || type === "hike") return "walk";
  if (type === "trailrun" || type === "trail") return "trail";
  if (activity.race || type === "race") return "race";
  if (type === "virtualrun" || (type === "run" && activity.trainer)) {
    return "treadmill";
  }
  if (type === "run") return "run";
  return null;
}

function toIsoDatetime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function positiveNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function nonNegativeNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function positiveInt(value: number | null | undefined): number | undefined {
  const n = positiveNumber(value);
  return n == null ? undefined : Math.round(n);
}

function mapPerceivedEffort(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 10) return undefined;
  return rounded;
}
