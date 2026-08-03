import { createRunSchema, type UpdateRunInput } from "@running-club/shared";
import type { z } from "zod";
import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { db } from "../db/client";
import { run } from "../db/schema";
import { avgPaceSecPerKm } from "../lib/pace";

export type RunRecord = {
  id: string;
  userId: string;
  startedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  activityType: string;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainMeters: number | null;
  calories: number | null;
  avgCadence: number | null;
  perceivedEffort: number | null;
  notes: string | null;
  splits: { distanceMeters: number; durationSeconds: number }[] | null;
  polyline: string | null;
  source: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  avgPaceSecPerKm: number | null;
};

export type ListRunsOptions = {
  from?: string;
  to?: string;
  activityType?: string;
  limit?: number;
  cursor?: string;
};

type RunRow = typeof run.$inferSelect;

function toRunRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    userId: row.userId,
    startedAt: row.startedAt.toISOString(),
    distanceMeters: row.distanceMeters,
    durationSeconds: row.durationSeconds,
    activityType: row.activityType,
    avgHeartRate: row.avgHeartRate,
    maxHeartRate: row.maxHeartRate,
    elevationGainMeters: row.elevationGainMeters,
    calories: row.calories,
    avgCadence: row.avgCadence,
    perceivedEffort: row.perceivedEffort,
    notes: row.notes,
    splits: row.splits as RunRecord["splits"],
    polyline: row.polyline,
    source: row.source,
    externalId: row.externalId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    avgPaceSecPerKm: avgPaceSecPerKm(row.distanceMeters, row.durationSeconds),
  };
}

type CreateRunServiceInput = z.input<typeof createRunSchema>;

export async function createRun(
  userId: string,
  input: CreateRunServiceInput,
): Promise<RunRecord> {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(run)
    .values({
      id,
      userId,
      startedAt: new Date(input.startedAt),
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      activityType: input.activityType,
      avgHeartRate: input.avgHeartRate,
      maxHeartRate: input.maxHeartRate,
      elevationGainMeters: input.elevationGainMeters,
      calories: input.calories,
      avgCadence: input.avgCadence,
      perceivedEffort: input.perceivedEffort,
      notes: input.notes,
      splits: input.splits,
      polyline: input.polyline,
      source: input.source ?? "manual",
      externalId: input.externalId,
    })
    .returning();

  return toRunRecord(row);
}

export async function listRuns(
  userId: string,
  options: ListRunsOptions = {},
): Promise<RunRecord[]> {
  const conditions = [eq(run.userId, userId)];

  if (options.from) {
    conditions.push(gte(run.startedAt, new Date(options.from)));
  }
  if (options.to) {
    conditions.push(lte(run.startedAt, new Date(options.to)));
  }
  if (options.activityType) {
    conditions.push(eq(run.activityType, options.activityType));
  }
  if (options.cursor) {
    conditions.push(lt(run.startedAt, new Date(options.cursor)));
  }

  const limit = options.limit ?? 50;

  const rows = await db
    .select()
    .from(run)
    .where(and(...conditions))
    .orderBy(desc(run.startedAt))
    .limit(limit);

  return rows.map(toRunRecord);
}

export async function getRun(
  userId: string,
  id: string,
): Promise<RunRecord | null> {
  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, id), eq(run.userId, userId)));

  return row ? toRunRecord(row) : null;
}

export async function updateRun(
  userId: string,
  id: string,
  input: UpdateRunInput,
): Promise<RunRecord | null> {
  const existing = await getRun(userId, id);
  if (!existing) return null;

  const updates: Partial<typeof run.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.startedAt !== undefined) {
    updates.startedAt = new Date(input.startedAt);
  }
  if (input.distanceMeters !== undefined) {
    updates.distanceMeters = input.distanceMeters;
  }
  if (input.durationSeconds !== undefined) {
    updates.durationSeconds = input.durationSeconds;
  }
  if (input.activityType !== undefined) {
    updates.activityType = input.activityType;
  }
  if (input.avgHeartRate !== undefined) {
    updates.avgHeartRate = input.avgHeartRate;
  }
  if (input.maxHeartRate !== undefined) {
    updates.maxHeartRate = input.maxHeartRate;
  }
  if (input.elevationGainMeters !== undefined) {
    updates.elevationGainMeters = input.elevationGainMeters;
  }
  if (input.calories !== undefined) {
    updates.calories = input.calories;
  }
  if (input.avgCadence !== undefined) {
    updates.avgCadence = input.avgCadence;
  }
  if (input.perceivedEffort !== undefined) {
    updates.perceivedEffort = input.perceivedEffort;
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }
  if (input.splits !== undefined) {
    updates.splits = input.splits;
  }
  if (input.polyline !== undefined) {
    updates.polyline = input.polyline;
  }
  if (input.source !== undefined) {
    updates.source = input.source;
  }
  if (input.externalId !== undefined) {
    updates.externalId = input.externalId;
  }

  const [row] = await db
    .update(run)
    .set(updates)
    .where(and(eq(run.id, id), eq(run.userId, userId)))
    .returning();

  return row ? toRunRecord(row) : null;
}

export async function deleteRun(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(run)
    .where(and(eq(run.id, id), eq(run.userId, userId)))
    .returning({ id: run.id });

  return deleted.length > 0;
}
