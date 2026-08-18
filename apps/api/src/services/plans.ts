import type {
  CreatePlanTemplateInput,
  PlanDetails,
  PlanOccurrenceRecord,
  PlanTemplateRecord,
  UpdatePlanOccurrenceInput,
} from "@running-club/shared";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { planOccurrence, planTemplate } from "../db/schema";
import { getWeekBounds } from "../lib/period";

type PlanTemplateRow = typeof planTemplate.$inferSelect;
type PlanOccurrenceRow = typeof planOccurrence.$inferSelect;

export type PlanDay = {
  date: string;
  items: PlanOccurrenceRecord[];
};

export type TodayDashboard = {
  date: string;
  items: PlanOccurrenceRecord[];
  week: {
    start: string;
    end: string;
    days: PlanDay[];
    running: {
      distanceMeters: number;
      completedSessions: number;
      plannedSessions: number;
    };
    gym: {
      completedSessions: number;
      plannedSessions: number;
    };
    nutrition: {
      targetDays: number;
      achievedDays: number;
    };
  };
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toPlanTemplateRecord(row: PlanTemplateRow): PlanTemplateRecord {
  return {
    id: row.id,
    userId: row.userId,
    weekday: row.weekday,
    category: row.category as PlanDetails["category"],
    title: row.title,
    details: row.details,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as PlanTemplateRecord;
}

function toPlanOccurrenceRecord(row: PlanOccurrenceRow): PlanOccurrenceRecord {
  return {
    id: row.id,
    userId: row.userId,
    templateId: row.templateId,
    date: row.date,
    category: row.category as PlanDetails["category"],
    title: row.title,
    details: row.details,
    status: row.status as PlanOccurrenceRecord["status"],
    overriddenAt: row.overriddenAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    linkedRunId: row.linkedRunId,
    linkedGymWorkoutId: row.linkedGymWorkoutId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as PlanOccurrenceRecord;
}

export async function listPlanTemplates(
  userId: string,
): Promise<PlanTemplateRecord[]> {
  const rows = await db
    .select()
    .from(planTemplate)
    .where(eq(planTemplate.userId, userId))
    .orderBy(asc(planTemplate.weekday), asc(planTemplate.title));
  return rows.map(toPlanTemplateRecord);
}

export async function createPlanTemplate(
  userId: string,
  input: CreatePlanTemplateInput,
): Promise<PlanTemplateRecord> {
  const [row] = await db
    .insert(planTemplate)
    .values({
      id: crypto.randomUUID(),
      userId,
      weekday: input.weekday,
      category: input.category,
      title: input.title,
      details: input.details,
    })
    .returning();
  return toPlanTemplateRecord(row!);
}

/** Lazily creates immutable occurrence snapshots for active templates in range. */
export async function ensurePlanOccurrences(
  userId: string,
  fromDate: Date,
  toDate: Date,
): Promise<void> {
  const templates = await db
    .select()
    .from(planTemplate)
    .where(and(eq(planTemplate.userId, userId), eq(planTemplate.active, true)));

  const start = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      toDate.getUTCFullYear(),
      toDate.getUTCMonth(),
      toDate.getUTCDate(),
    ),
  );

  if (start > end || templates.length === 0) return;

  const inserts: Array<typeof planOccurrence.$inferInsert> = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor)) {
    const day = cursor.getUTCDay();
    for (const template of templates) {
      if (template.weekday !== day) continue;
      inserts.push({
        id: crypto.randomUUID(),
        userId,
        templateId: template.id,
        date: dateKey(cursor),
        category: template.category,
        title: template.title,
        details: template.details,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (inserts.length === 0) return;
  await db
    .insert(planOccurrence)
    .values(inserts)
    .onConflictDoNothing({
      target: [
        planOccurrence.userId,
        planOccurrence.templateId,
        planOccurrence.date,
      ],
    });
}

export async function updatePlanOccurrence(
  userId: string,
  id: string,
  input: UpdatePlanOccurrenceInput,
): Promise<PlanOccurrenceRecord | null> {
  const now = new Date();
  const changes: Partial<typeof planOccurrence.$inferInsert> = {
    overriddenAt: now,
    updatedAt: now,
  };
  if (input.status !== undefined) {
    changes.status = input.status;
    changes.completedAt = input.status === "done" ? now : null;
  }
  if (input.title !== undefined) changes.title = input.title;
  if (input.category !== undefined) changes.category = input.category;
  if (input.details !== undefined) changes.details = input.details;

  const [row] = await db
    .update(planOccurrence)
    .set(changes)
    .where(and(eq(planOccurrence.id, id), eq(planOccurrence.userId, userId)))
    .returning();
  return row ? toPlanOccurrenceRecord(row) : null;
}

export async function getTodayDashboard(
  userId: string,
  date: Date,
): Promise<TodayDashboard> {
  const { weekStart, weekEnd } = getWeekBounds(date, 1);
  await ensurePlanOccurrences(userId, weekStart, weekEnd);

  const start = dateKey(weekStart);
  const end = dateKey(weekEnd);
  const rows = await db
    .select()
    .from(planOccurrence)
    .where(
      and(
        eq(planOccurrence.userId, userId),
        gte(planOccurrence.date, start),
        lte(planOccurrence.date, end),
      ),
    )
    .orderBy(asc(planOccurrence.date), asc(planOccurrence.createdAt));
  const occurrences = rows.map(toPlanOccurrenceRecord);
  const byDate = new Map<string, PlanOccurrenceRecord[]>();
  for (const occurrence of occurrences) {
    const items = byDate.get(occurrence.date) ?? [];
    items.push(occurrence);
    byDate.set(occurrence.date, items);
  }

  const days: PlanDay[] = [];
  for (let cursor = new Date(weekStart); cursor <= weekEnd; cursor = new Date(cursor)) {
    const key = dateKey(cursor);
    days.push({ date: key, items: byDate.get(key) ?? [] });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const running = occurrences.filter((occurrence) => occurrence.category === "run");
  const gym = occurrences.filter((occurrence) => occurrence.category === "gym");
  const nutrition = occurrences.filter(
    (occurrence) => occurrence.category === "nutrition",
  );

  return {
    date: dateKey(date),
    items: byDate.get(dateKey(date)) ?? [],
    week: {
      start,
      end,
      days,
      running: {
        distanceMeters: running.reduce(
          (total, occurrence) =>
            total +
            (occurrence.category === "run"
              ? (occurrence.details.targetDistanceMeters ?? 0)
              : 0),
          0,
        ),
        completedSessions: running.filter((occurrence) => occurrence.status === "done")
          .length,
        plannedSessions: running.length,
      },
      gym: {
        completedSessions: gym.filter((occurrence) => occurrence.status === "done")
          .length,
        plannedSessions: gym.length,
      },
      nutrition: {
        targetDays: nutrition.length,
        achievedDays: 0,
      },
    },
  };
}
