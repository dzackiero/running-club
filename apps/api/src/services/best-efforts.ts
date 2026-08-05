import type { InsightsBestEffortDistance, RunStreams } from "@running-club/shared";
import { isRunningActivityType } from "@running-club/shared";

export const BEST_EFFORT_TARGETS = [
  { label: "1k" as const, distanceMeters: 1000 },
  { label: "5k" as const, distanceMeters: 5000 },
  { label: "10k" as const, distanceMeters: 10000 },
  { label: "21k" as const, distanceMeters: 21097 },
  { label: "42k" as const, distanceMeters: 42195 },
];

export type BestEffortRun = {
  id: string;
  startedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  activityType: string;
  streams: RunStreams | null;
};

export function reconstructDistanceMeters(
  t: number[],
  pace: number[],
): number[] {
  const dist = [0];
  for (let i = 1; i < t.length; i++) {
    const dt = t[i]! - t[i - 1]!;
    const paceSecPerKm = pace[i]!;
    if (
      !(dt > 0) ||
      !(paceSecPerKm > 0) ||
      !Number.isFinite(dt) ||
      !Number.isFinite(paceSecPerKm)
    ) {
      dist.push(dist[i - 1]!);
      continue;
    }
    dist.push(dist[i - 1]! + (dt * 1000) / paceSecPerKm);
  }
  return dist;
}

export function bestEffortFromStreams(
  streams: { t: number[]; pace: number[] },
  targetMeters: number,
): number | null {
  const { t, pace } = streams;
  if (t.length < 2 || t.length !== pace.length || targetMeters <= 0) {
    return null;
  }

  const dist = reconstructDistanceMeters(t, pace);
  if (dist[dist.length - 1]! < targetMeters) return null;

  let best: number | null = null;
  let j = 0;
  for (let i = 0; i < dist.length; i++) {
    while (j < dist.length && dist[j]! - dist[i]! < targetMeters) {
      j += 1;
    }
    if (j >= dist.length) break;

    const prior = j === 0 ? dist[i]! : dist[j - 1]!;
    const next = dist[j]!;
    const already = prior - dist[i]!;
    const need = targetMeters - already;
    const span = next - prior;
    const frac = span > 0 ? Math.min(1, Math.max(0, need / span)) : 1;
    const priorTime = j === 0 ? t[i]! : t[j - 1]!;
    const elapsed = priorTime + frac * (t[j]! - priorTime) - t[i]!;
    if (elapsed > 0 && (best == null || elapsed < best)) {
      best = elapsed;
    }
  }

  return best == null ? null : Math.round(best);
}

/** Whole-run elapsed pace applied to the target distance. */
export function wholeRunBestEffort(
  distanceMeters: number,
  durationSeconds: number,
  targetMeters: number,
): number | null {
  if (
    distanceMeters < targetMeters ||
    durationSeconds <= 0 ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationSeconds)
  ) {
    return null;
  }
  return Math.round(durationSeconds * (targetMeters / distanceMeters));
}

function effortForRun(
  run: BestEffortRun,
  targetMeters: number,
): { durationSeconds: number; source: "stream" | "run" } | null {
  const streamTime =
    run.streams != null
      ? bestEffortFromStreams(run.streams, targetMeters)
      : null;
  const runTime = wholeRunBestEffort(
    run.distanceMeters,
    run.durationSeconds,
    targetMeters,
  );

  if (streamTime != null && (runTime == null || streamTime <= runTime)) {
    return { durationSeconds: streamTime, source: "stream" };
  }
  if (runTime != null) {
    return { durationSeconds: runTime, source: "run" };
  }
  return null;
}

export function rankBestEfforts(
  runs: BestEffortRun[],
): InsightsBestEffortDistance[] {
  const eligible = runs.filter((run) => isRunningActivityType(run.activityType));

  const distances: InsightsBestEffortDistance[] = [];
  for (const target of BEST_EFFORT_TARGETS) {
    const efforts = eligible
      .map((run) => {
        const effort = effortForRun(run, target.distanceMeters);
        if (!effort) return null;
        return {
          runId: run.id,
          startedAt: run.startedAt,
          durationSeconds: effort.durationSeconds,
          source: effort.source,
        };
      })
      .filter((row) => row != null)
      .sort((a, b) => {
        if (a.durationSeconds !== b.durationSeconds) {
          return a.durationSeconds - b.durationSeconds;
        }
        if (a.source !== b.source) {
          return a.source === "stream" ? -1 : 1;
        }
        return a.startedAt.localeCompare(b.startedAt);
      })
      .slice(0, 3)
      .map((row, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        ...row,
      }));

    if (efforts.length === 0) continue;
    distances.push({
      label: target.label,
      distanceMeters: target.distanceMeters,
      efforts,
    });
  }

  return distances;
}
