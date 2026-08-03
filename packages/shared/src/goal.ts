import { z } from "zod";

/** Base object schema (for MCP `inputSchema` / `.shape`). Full refine is on `upsertWeeklyGoalSchema`. */
export const upsertWeeklyGoalObjectSchema = z.object({
  weekStartsOn: z.number().int().min(0).max(6).default(1),
  targetDistanceMeters: z.number().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  targetRunCount: z.number().int().positive().optional(),
});

export const upsertWeeklyGoalSchema = upsertWeeklyGoalObjectSchema.refine(
  (v) =>
    v.targetDistanceMeters != null ||
    v.targetDurationSeconds != null ||
    v.targetRunCount != null,
  {
    message:
      "At least one of targetDistanceMeters, targetDurationSeconds, targetRunCount is required",
  },
);

export type UpsertWeeklyGoalInput = z.infer<typeof upsertWeeklyGoalSchema>;

export type WeeklyGoalRecord = {
  id: string;
  userId: string;
  weekStartsOn: number;
  targetDistanceMeters: number | null;
  targetDurationSeconds: number | null;
  targetRunCount: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
