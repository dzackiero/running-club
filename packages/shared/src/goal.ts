import { z } from "zod";

/** Base object schema (for MCP `inputSchema` / `.shape`). */
export const upsertWeeklyGoalObjectSchema = z.object({
  weekStartsOn: z.number().int().min(0).max(6).default(1),
  targetDistanceMeters: z.number().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  targetRunCount: z.number().int().positive().optional(),
});

/** Targets are optional — empty upsert clears targets (keeps weekStartsOn). */
export const upsertWeeklyGoalSchema = upsertWeeklyGoalObjectSchema;

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

export function weeklyGoalHasTargets(
  goal: Pick<
    WeeklyGoalRecord,
    "targetDistanceMeters" | "targetDurationSeconds" | "targetRunCount"
  > | null,
): boolean {
  if (!goal) return false;
  return (
    goal.targetDistanceMeters != null ||
    goal.targetDurationSeconds != null ||
    goal.targetRunCount != null
  );
}
