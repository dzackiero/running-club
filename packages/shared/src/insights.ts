import { z } from "zod";
import type { WeeklyGoalRecord } from "./goal";

export const summaryQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

/** Optional instant used to select which week to report (defaults to now). */
export const weekQuerySchema = z.object({
  at: z.string().datetime().optional(),
});

export type WeekQuery = z.infer<typeof weekQuerySchema>;

export const insightsGrainSchema = z.enum(["day", "week", "month"]);
export type InsightsGrain = z.infer<typeof insightsGrainSchema>;

/** Optional range for insights overview (defaults to this calendar month so far). */
export const overviewQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    grain: insightsGrainSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.from == null) !== (val.to == null)) {
      ctx.addIssue({
        code: "custom",
        message: "from and to must both be provided",
      });
    }
    if (
      val.from &&
      val.to &&
      new Date(val.from).getTime() > new Date(val.to).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "from must be on or before to",
      });
    }
  });

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export type WeekProgress = {
  weekStart: string;
  weekEnd: string;
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    runCount: number;
  };
  goal: WeeklyGoalRecord | null;
  progress: {
    distanceRatio: number | null;
    durationRatio: number | null;
    runCountRatio: number | null;
  };
};

export type InsightsBucket = {
  start: string;
  end: string;
  distanceMeters: number;
  runCount: number;
  /** Only meaningful when grain is week; day/month are always no_goal. */
  goalStatus: "hit" | "missed" | "no_goal";
};

export type InsightsOverview = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  grain: InsightsGrain;
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    runCount: number;
    avgPaceSecPerKm: number | null;
    daysWithRun: number;
  };
  previous: {
    distanceMeters: number;
    durationSeconds: number;
    runCount: number;
    avgPaceSecPerKm: number | null;
    daysWithRun: number;
  };
  deltas: {
    distancePct: number | null;
    runCountPct: number | null;
    /** Negative = faster than previous period. */
    pacePct: number | null;
  };
  buckets: InsightsBucket[];
  consistency: {
    daysWithRun: number;
    longestGapDays: number;
  };
  goals: {
    hit: number;
    missed: number;
    noGoal: number;
  };
  /** True when fewer than 2 runs across current + previous periods. */
  sparse: boolean;
};
