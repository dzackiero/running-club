import type {
  UpsertWeeklyGoalInput,
  WeeklyGoalRecord,
} from "@running-club/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { weeklyGoal } from "../db/schema";

export type { WeeklyGoalRecord };

type WeeklyGoalRow = typeof weeklyGoal.$inferSelect;

function toWeeklyGoalRecord(row: WeeklyGoalRow): WeeklyGoalRecord {
  return {
    id: row.id,
    userId: row.userId,
    weekStartsOn: row.weekStartsOn,
    targetDistanceMeters: row.targetDistanceMeters,
    targetDurationSeconds: row.targetDurationSeconds,
    targetRunCount: row.targetRunCount,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCurrentGoal(
  userId: string,
): Promise<WeeklyGoalRecord | null> {
  const [row] = await db
    .select()
    .from(weeklyGoal)
    .where(and(eq(weeklyGoal.userId, userId), eq(weeklyGoal.active, true)))
    .limit(1);

  return row ? toWeeklyGoalRecord(row) : null;
}

export async function upsertCurrentGoal(
  userId: string,
  input: UpsertWeeklyGoalInput,
): Promise<WeeklyGoalRecord> {
  return db.transaction(async (tx) => {
    await tx
      .update(weeklyGoal)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(weeklyGoal.userId, userId), eq(weeklyGoal.active, true)));

    const id = crypto.randomUUID();
    const [row] = await tx
      .insert(weeklyGoal)
      .values({
        id,
        userId,
        weekStartsOn: input.weekStartsOn,
        targetDistanceMeters: input.targetDistanceMeters,
        targetDurationSeconds: input.targetDurationSeconds,
        targetRunCount: input.targetRunCount,
        active: true,
      })
      .returning();

    return toWeeklyGoalRecord(row);
  });
}
