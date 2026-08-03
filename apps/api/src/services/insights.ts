import type { SummaryQuery, WeekProgress } from "@running-club/shared";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { run } from "../db/schema";
import { avgPaceSecPerKm } from "../lib/pace";
import { getCurrentGoal } from "./goals";

export type { WeekProgress };

export type Summary = {
  from: string;
  to: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  runCount: number;
  avgPaceSecPerKm: number | null;
  daysWithRun: number;
  previousPeriod: {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    runCount: number;
    avgPaceSecPerKm: number | null;
  };
};

type PeriodTotals = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  runCount: number;
  avgPaceSecPerKm: number | null;
  daysWithRun: number;
};

function aggregateRuns(
  rows: { startedAt: Date; distanceMeters: number; durationSeconds: number }[],
): PeriodTotals {
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  const days = new Set<string>();

  for (const row of rows) {
    totalDistanceMeters += row.distanceMeters;
    totalDurationSeconds += row.durationSeconds;
    days.add(row.startedAt.toISOString().slice(0, 10));
  }

  return {
    totalDistanceMeters,
    totalDurationSeconds,
    runCount: rows.length,
    avgPaceSecPerKm: avgPaceSecPerKm(
      totalDistanceMeters,
      totalDurationSeconds,
    ),
    daysWithRun: days.size,
  };
}

async function fetchRunsInRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<{ startedAt: Date; distanceMeters: number; durationSeconds: number }[]> {
  return db
    .select({
      startedAt: run.startedAt,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.durationSeconds,
    })
    .from(run)
    .where(
      and(
        eq(run.userId, userId),
        gte(run.startedAt, from),
        lte(run.startedAt, to),
      ),
    );
}

function previousPeriodBounds(from: Date, to: Date): { from: Date; to: Date } {
  const periodMs = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - periodMs);
  return { from: previousFrom, to: previousTo };
}

export async function getSummary(
  userId: string,
  query: SummaryQuery,
): Promise<Summary> {
  const fromDate = new Date(query.from);
  const toDate = new Date(query.to);

  const currentRows = await fetchRunsInRange(userId, fromDate, toDate);
  const current = aggregateRuns(currentRows);

  const prevBounds = previousPeriodBounds(fromDate, toDate);
  const previousRows = await fetchRunsInRange(
    userId,
    prevBounds.from,
    prevBounds.to,
  );
  const previous = aggregateRuns(previousRows);

  return {
    from: query.from,
    to: query.to,
    totalDistanceMeters: current.totalDistanceMeters,
    totalDurationSeconds: current.totalDurationSeconds,
    runCount: current.runCount,
    avgPaceSecPerKm: current.avgPaceSecPerKm,
    daysWithRun: current.daysWithRun,
    previousPeriod: {
      totalDistanceMeters: previous.totalDistanceMeters,
      totalDurationSeconds: previous.totalDurationSeconds,
      runCount: previous.runCount,
      avgPaceSecPerKm: previous.avgPaceSecPerKm,
    },
  };
}

function getWeekBounds(
  now: Date,
  weekStartsOn: number,
): { weekStart: Date; weekEnd: Date } {
  const day = now.getUTCDay();
  const daysSinceStart = (day - weekStartsOn + 7) % 7;

  const weekStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceStart,
    ),
  );

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

function progressRatio(
  actual: number,
  target: number | null | undefined,
): number | null {
  if (target == null || target <= 0) return null;
  return actual / target;
}

export async function getWeekProgress(
  userId: string,
  now: Date = new Date(),
): Promise<WeekProgress> {
  const goal = await getCurrentGoal(userId);
  const weekStartsOn = goal?.weekStartsOn ?? 1;
  const { weekStart, weekEnd } = getWeekBounds(now, weekStartsOn);

  const rows = await fetchRunsInRange(userId, weekStart, weekEnd);
  const totals = aggregateRuns(rows);

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totals: {
      distanceMeters: totals.totalDistanceMeters,
      durationSeconds: totals.totalDurationSeconds,
      runCount: totals.runCount,
    },
    goal,
    progress: {
      distanceRatio: progressRatio(
        totals.totalDistanceMeters,
        goal?.targetDistanceMeters,
      ),
      durationRatio: progressRatio(
        totals.totalDurationSeconds,
        goal?.targetDurationSeconds,
      ),
      runCountRatio: progressRatio(totals.runCount, goal?.targetRunCount),
    },
  };
}
