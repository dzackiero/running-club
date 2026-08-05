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
