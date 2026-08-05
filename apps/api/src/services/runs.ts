import {
  createRunSchema,
  type ListRunsQuery,
  type RunRecord,
  type UpdateRunInput,
} from "@running-club/shared";
import type { z } from "zod";
import { and, desc, eq, getTableColumns, gte, lt, lte } from "drizzle-orm";
import { db } from "../db/client";
import { run } from "../db/schema";
import { avgPaceSecPerKm } from "../lib/pace";

export type { RunRecord };

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
    trainingLoad: row.trainingLoad,
    intensity: row.intensity,
    gapPaceSecPerKm: row.gapPaceSecPerKm,
    hrZoneSeconds: (row.hrZoneSeconds as RunRecord["hrZoneSeconds"]) ?? null,
    hrZoneBpm: (row.hrZoneBpm as RunRecord["hrZoneBpm"]) ?? null,
    streams: (row.streams as RunRecord["streams"]) ?? null,
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
      trainingLoad: input.trainingLoad,
      intensity: input.intensity,
      gapPaceSecPerKm: input.gapPaceSecPerKm,
      hrZoneSeconds: input.hrZoneSeconds,
      hrZoneBpm: input.hrZoneBpm,
      streams: input.streams,
      source: input.source ?? "manual",
      externalId: input.externalId,
    })
    .returning();

  return toRunRecord(row);
}

export async function listRuns(
  userId: string,
  options: ListRunsQuery = {},
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
  const { streams: _streams, ...listColumns } = getTableColumns(run);

  const rows = await db
    .select(listColumns)
    .from(run)
    .where(and(...conditions))
    .orderBy(desc(run.startedAt))
    .limit(limit);

  return rows.map((row) => toRunRecord({ ...row, streams: null }));
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
  if (input.trainingLoad !== undefined) {
    updates.trainingLoad = input.trainingLoad;
  }
  if (input.intensity !== undefined) {
    updates.intensity = input.intensity;
  }
  if (input.gapPaceSecPerKm !== undefined) {
    updates.gapPaceSecPerKm = input.gapPaceSecPerKm;
  }
  if (input.hrZoneSeconds !== undefined) {
    updates.hrZoneSeconds = input.hrZoneSeconds;
  }
  if (input.hrZoneBpm !== undefined) {
    updates.hrZoneBpm = input.hrZoneBpm;
  }
  if (input.streams !== undefined) {
    updates.streams = input.streams;
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

export async function findRunByExternalId(
  userId: string,
  externalId: string,
): Promise<Pick<
  RunRecord,
  | "id"
  | "distanceMeters"
  | "durationSeconds"
  | "avgHeartRate"
  | "streams"
  | "hrZoneBpm"
> | null> {
  const [row] = await db
    .select({
      id: run.id,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.durationSeconds,
      avgHeartRate: run.avgHeartRate,
      streams: run.streams,
      hrZoneBpm: run.hrZoneBpm,
    })
    .from(run)
    .where(and(eq(run.userId, userId), eq(run.externalId, externalId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    distanceMeters: row.distanceMeters,
    durationSeconds: row.durationSeconds,
    avgHeartRate: row.avgHeartRate,
    streams: (row.streams as RunRecord["streams"]) ?? null,
    hrZoneBpm: (row.hrZoneBpm as RunRecord["hrZoneBpm"]) ?? null,
  };
}

export async function upsertImportedRun(
  userId: string,
  input: CreateRunServiceInput & { source: string; externalId: string },
): Promise<{ run: RunRecord; created: boolean }> {
  const [existing] = await db
    .select()
    .from(run)
    .where(and(eq(run.userId, userId), eq(run.externalId, input.externalId)))
    .limit(1);

  if (existing) {
    const updated = await updateRun(userId, existing.id, input);
    return { run: updated!, created: false };
  }

  return { run: await createRun(userId, input), created: true };
}

export async function deleteRun(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(run)
    .where(and(eq(run.id, id), eq(run.userId, userId)))
    .returning({ id: run.id });

  return deleted.length > 0;
}
