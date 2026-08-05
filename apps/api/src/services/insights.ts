import type {
  InsightsBestEfforts,
  InsightsBucket,
  InsightsGrain,
  InsightsOverview,
  OverviewQuery,
  RunStreams,
  SummaryQuery,
  WeekProgress,
  WeeklyGoalRecord,
} from "@running-club/shared";
import { weeklyGoalHasTargets } from "@running-club/shared";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { run } from "../db/schema";
import { avgPaceSecPerKm } from "../lib/pace";
import { getWeekBounds, shiftWeek } from "../lib/period";
import { rankBestEfforts } from "./best-efforts";
import { getCurrentGoal } from "./goals";
import { computeWeeklyStreak } from "./weekly-streak";

export type { WeekProgress, InsightsOverview };

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

type RunRow = {
  startedAt: Date;
  distanceMeters: number;
  durationSeconds: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Auto grain: day if range ≤ this many days. */
const DAY_GRAIN_MAX_DAYS = 14;
/** Auto grain: week if range ≤ this many days, else month. */
const WEEK_GRAIN_MAX_DAYS = 42;

function aggregateRuns(rows: RunRow[]): PeriodTotals {
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
): Promise<RunRow[]> {
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

async function fetchRunStartedAts(userId: string): Promise<Date[]> {
  const rows = await db
    .select({ startedAt: run.startedAt })
    .from(run)
    .where(eq(run.userId, userId));
  return rows.map((row) => row.startedAt);
}

function previousPeriodBounds(from: Date, to: Date): { from: Date; to: Date } {
  const periodMs = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - periodMs);
  return { from: previousFrom, to: previousTo };
}

/** This calendar month so far (UTC), through end of today. */
export function thisMonthBounds(now: Date): { from: Date; to: Date } {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const to = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { from, to };
}

function resolveOverviewRange(
  query: OverviewQuery | undefined,
  now: Date,
): { from: Date; to: Date } {
  if (query?.from && query?.to) {
    return { from: new Date(query.from), to: new Date(query.to) };
  }
  return thisMonthBounds(now);
}

function periodLengthDays(from: Date, to: Date): number {
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / DAY_MS) + 1;
}

export function pickGrain(from: Date, to: Date): InsightsGrain {
  const days = periodLengthDays(from, to);
  if (days <= DAY_GRAIN_MAX_DAYS) return "day";
  if (days <= WEEK_GRAIN_MAX_DAYS) return "week";
  return "month";
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

function progressRatio(
  actual: number,
  target: number | null | undefined,
): number | null {
  if (target == null || target <= 0) return null;
  return actual / target;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function pacePctChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function weekGoalStatus(
  goal: WeeklyGoalRecord | null,
  totals: PeriodTotals,
): "hit" | "missed" | "no_goal" {
  if (!weeklyGoalHasTargets(goal)) return "no_goal";

  const checks: boolean[] = [];
  if (goal!.targetDistanceMeters != null) {
    checks.push(totals.totalDistanceMeters >= goal!.targetDistanceMeters);
  }
  if (goal!.targetDurationSeconds != null) {
    checks.push(totals.totalDurationSeconds >= goal!.targetDurationSeconds);
  }
  if (goal!.targetRunCount != null) {
    checks.push(totals.runCount >= goal!.targetRunCount);
  }

  return checks.every(Boolean) ? "hit" : "missed";
}

/** Longest stretch of calendar days with no run inside [from, to]. */
function longestGapDays(rows: { startedAt: Date }[], from: Date, to: Date): number {
  const runDays = new Set(
    rows.map((r) => r.startedAt.toISOString().slice(0, 10)),
  );
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

  let longest = 0;
  let current = 0;
  for (let t = start; t <= end; t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    if (runDays.has(key)) {
      current = 0;
    } else {
      current += 1;
      if (current > longest) longest = current;
    }
  }
  return longest;
}

function filterRowsInRange(rows: RunRow[], from: Date, to: Date): RunRow[] {
  return rows.filter((r) => r.startedAt >= from && r.startedAt <= to);
}

function buildDayBuckets(
  rows: RunRow[],
  from: Date,
  to: Date,
): InsightsBucket[] {
  const buckets: InsightsBucket[] = [];
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

  for (let t = start; t <= end; t += DAY_MS) {
    const dayStart = new Date(t);
    const dayEnd = new Date(t + DAY_MS - 1);
    const dayRows = filterRowsInRange(rows, dayStart, dayEnd);
    const totals = aggregateRuns(dayRows);
    buckets.push({
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
      distanceMeters: totals.totalDistanceMeters,
      runCount: totals.runCount,
      goalStatus: "no_goal",
    });
  }

  return buckets;
}

function buildWeekBuckets(
  rows: RunRow[],
  from: Date,
  to: Date,
  weekStartsOn: number,
  goal: WeeklyGoalRecord | null,
): InsightsBucket[] {
  const { weekStart: firstWeekStart } = getWeekBounds(from, weekStartsOn);
  const buckets: InsightsBucket[] = [];

  for (let weekStart = firstWeekStart; weekStart <= to; weekStart = shiftWeek(weekStart, 1)) {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const bucketFrom = weekStart < from ? from : weekStart;
    const bucketTo = weekEnd > to ? to : weekEnd;
    if (bucketFrom > bucketTo) continue;

    const weekRows = filterRowsInRange(rows, weekStart, weekEnd);
    const weekTotals = aggregateRuns(weekRows);
    buckets.push({
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      distanceMeters: weekTotals.totalDistanceMeters,
      runCount: weekTotals.runCount,
      goalStatus: weekGoalStatus(goal, weekTotals),
    });
  }

  return buckets;
}

function buildMonthBuckets(rows: RunRow[], from: Date, to: Date): InsightsBucket[] {
  const buckets: InsightsBucket[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));

  while (cursor <= to) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    const monthRows = filterRowsInRange(rows, monthStart, monthEnd);
    const totals = aggregateRuns(monthRows);
    buckets.push({
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
      distanceMeters: totals.totalDistanceMeters,
      runCount: totals.runCount,
      goalStatus: "no_goal",
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  return buckets;
}

function buildBuckets(
  grain: InsightsGrain,
  rows: RunRow[],
  from: Date,
  to: Date,
  weekStartsOn: number,
  goal: WeeklyGoalRecord | null,
): InsightsBucket[] {
  if (grain === "day") return buildDayBuckets(rows, from, to);
  if (grain === "week") {
    return buildWeekBuckets(rows, from, to, weekStartsOn, goal);
  }
  return buildMonthBuckets(rows, from, to);
}

function summarizeGoalsFromWeeks(
  rows: RunRow[],
  from: Date,
  to: Date,
  weekStartsOn: number,
  goal: WeeklyGoalRecord | null,
): InsightsOverview["goals"] {
  const weeks = buildWeekBuckets(rows, from, to, weekStartsOn, goal);
  return {
    hit: weeks.filter((w) => w.goalStatus === "hit").length,
    missed: weeks.filter((w) => w.goalStatus === "missed").length,
    noGoal: weeks.filter((w) => w.goalStatus === "no_goal").length,
  };
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

/** Insights for a date range (default: this calendar month so far) vs equal-length prior. */
export async function getInsightsOverview(
  userId: string,
  options: {
    now?: Date;
    from?: string;
    to?: string;
    grain?: InsightsGrain;
  } = {},
): Promise<InsightsOverview> {
  const now = options.now ?? new Date();
  const { from: currentFrom, to: currentTo } = resolveOverviewRange(
    { from: options.from, to: options.to },
    now,
  );
  const prev = previousPeriodBounds(currentFrom, currentTo);
  const grain = options.grain ?? pickGrain(currentFrom, currentTo);

  const [goal, currentRows, previousRows, allStartedAts] = await Promise.all([
    getCurrentGoal(userId),
    fetchRunsInRange(userId, currentFrom, currentTo),
    fetchRunsInRange(userId, prev.from, prev.to),
    fetchRunStartedAts(userId),
  ]);
  const weekStartsOn = goal?.weekStartsOn ?? 1;

  const streak = computeWeeklyStreak(allStartedAts, weekStartsOn, now);

  const current = aggregateRuns(currentRows);
  const previous = aggregateRuns(previousRows);

  const buckets = buildBuckets(
    grain,
    currentRows,
    currentFrom,
    currentTo,
    weekStartsOn,
    goal,
  );
  const goals = summarizeGoalsFromWeeks(
    currentRows,
    currentFrom,
    currentTo,
    weekStartsOn,
    goal,
  );

  return {
    from: currentFrom.toISOString(),
    to: currentTo.toISOString(),
    previousFrom: prev.from.toISOString(),
    previousTo: prev.to.toISOString(),
    grain,
    totals: {
      distanceMeters: current.totalDistanceMeters,
      durationSeconds: current.totalDurationSeconds,
      runCount: current.runCount,
      avgPaceSecPerKm: current.avgPaceSecPerKm,
      daysWithRun: current.daysWithRun,
    },
    previous: {
      distanceMeters: previous.totalDistanceMeters,
      durationSeconds: previous.totalDurationSeconds,
      runCount: previous.runCount,
      avgPaceSecPerKm: previous.avgPaceSecPerKm,
      daysWithRun: previous.daysWithRun,
    },
    deltas: {
      distancePct: pctChange(
        current.totalDistanceMeters,
        previous.totalDistanceMeters,
      ),
      runCountPct: pctChange(current.runCount, previous.runCount),
      pacePct: pacePctChange(
        current.avgPaceSecPerKm,
        previous.avgPaceSecPerKm,
      ),
    },
    buckets,
    consistency: {
      daysWithRun: current.daysWithRun,
      longestGapDays: longestGapDays(currentRows, currentFrom, currentTo),
    },
    goals,
    sparse: current.runCount + previous.runCount < 2,
    streak: {
      currentWeeks: streak.currentWeeks,
      bestWeeks: streak.bestWeeks,
      weekStartsOn,
    },
  };
}

export async function getBestEfforts(
  userId: string,
): Promise<InsightsBestEfforts> {
  const rows = await db
    .select({
      id: run.id,
      startedAt: run.startedAt,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.durationSeconds,
      activityType: run.activityType,
      streams: run.streams,
    })
    .from(run)
    .where(eq(run.userId, userId))
    .orderBy(desc(run.startedAt));

  return {
    distances: rankBestEfforts(
      rows.map((row) => ({
        id: row.id,
        startedAt: row.startedAt.toISOString(),
        distanceMeters: row.distanceMeters,
        durationSeconds: row.durationSeconds,
        activityType: row.activityType,
        streams: (row.streams as RunStreams | null) ?? null,
      })),
    ),
  };
}
