import type {
  ConfirmMealDraftInput,
  CreateMealDraftInput,
  MealItem,
  MealRecord,
  NutritionProgress,
} from "@running-club/shared";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/client";
import { meal, nutritionDay } from "../db/schema";

export class NutritionError extends Error {}

type MealRow = typeof meal.$inferSelect;

function totalsFromItems(items: MealItem[]) {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbsGrams: totals.carbsGrams + item.carbsGrams,
      fatGrams: totals.fatGrams + item.fatGrams,
    }),
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 },
  );
}

function toMealRecord(row: MealRow): MealRecord {
  return {
    id: row.id,
    userId: row.userId,
    occurredAt: row.occurredAt.toISOString(),
    status: row.status as MealRecord["status"],
    items: row.items,
    totalCalories: row.totalCalories,
    totalProteinGrams: row.totalProteinGrams,
    totalCarbsGrams: row.totalCarbsGrams,
    totalFatGrams: row.totalFatGrams,
    imageReference: row.imageReference,
    source: row.source as MealRecord["source"],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dayBounds(date: string) {
  const startsAt = new Date(`${date}T00:00:00.000Z`);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  return { startsAt, endsAt };
}

export async function createMealDraft(
  userId: string,
  input: CreateMealDraftInput,
): Promise<MealRecord> {
  const totals = totalsFromItems(input.items);
  const [row] = await db
    .insert(meal)
    .values({
      id: crypto.randomUUID(),
      userId,
      occurredAt: new Date(input.occurredAt),
      status: "draft",
      items: input.items,
      totalCalories: totals.calories,
      totalProteinGrams: totals.proteinGrams,
      totalCarbsGrams: totals.carbsGrams,
      totalFatGrams: totals.fatGrams,
      imageReference: input.imageReference,
      source: input.source ?? "mcp",
      notes: input.notes,
    })
    .returning();

  return toMealRecord(row!);
}

export async function getMealDraft(
  userId: string,
  mealId: string,
): Promise<MealRecord> {
  const [row] = await db
    .select()
    .from(meal)
    .where(
      and(
        eq(meal.id, mealId),
        eq(meal.userId, userId),
        eq(meal.status, "draft"),
      ),
    )
    .limit(1);

  if (!row) throw new NutritionError("Meal draft was not found");
  return toMealRecord(row);
}

export async function confirmMealDraft(
  userId: string,
  mealId: string,
  input: ConfirmMealDraftInput,
): Promise<MealRecord> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(meal)
      .where(and(eq(meal.id, mealId), eq(meal.userId, userId)))
      .limit(1);

    if (!current) throw new NutritionError("Meal draft was not found");
    if (current.status === "confirmed") return toMealRecord(current);
    if (current.status !== "draft") throw new NutritionError("Meal draft was not found");

    const items = input.items ?? current.items;
    const totals = totalsFromItems(items);
    const [confirmed] = await tx
      .update(meal)
      .set({
        status: "confirmed",
        items,
        totalCalories: totals.calories,
        totalProteinGrams: totals.proteinGrams,
        totalCarbsGrams: totals.carbsGrams,
        totalFatGrams: totals.fatGrams,
        notes: input.notes ?? current.notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(meal.id, mealId),
          eq(meal.userId, userId),
          eq(meal.status, "draft"),
        ),
      )
      .returning();

    if (confirmed) return toMealRecord(confirmed);

    const [raced] = await tx
      .select()
      .from(meal)
      .where(and(eq(meal.id, mealId), eq(meal.userId, userId)))
      .limit(1);
    if (raced?.status === "confirmed") return toMealRecord(raced);
    throw new NutritionError("Meal draft was not found");
  });
}

export async function discardMealDraft(
  userId: string,
  mealId: string,
): Promise<MealRecord> {
  const [discarded] = await db
    .update(meal)
    .set({ status: "discarded", updatedAt: new Date() })
    .where(
      and(
        eq(meal.id, mealId),
        eq(meal.userId, userId),
        eq(meal.status, "draft"),
      ),
    )
    .returning();
  if (!discarded) throw new NutritionError("Meal draft was not found");
  return toMealRecord(discarded);
}

export async function getNutritionProgress(
  userId: string,
  date: string,
): Promise<NutritionProgress> {
  const { startsAt, endsAt } = dayBounds(date);
  const [day] = await db
    .select()
    .from(nutritionDay)
    .where(and(eq(nutritionDay.userId, userId), eq(nutritionDay.date, date)))
    .limit(1);
  const confirmedMeals = await db
    .select()
    .from(meal)
    .where(
      and(
        eq(meal.userId, userId),
        eq(meal.status, "confirmed"),
        gte(meal.occurredAt, startsAt),
        lt(meal.occurredAt, endsAt),
      ),
    );
  const totals = confirmedMeals.reduce(
    (current, row) => ({
      calories: current.calories + row.totalCalories,
      proteinGrams: current.proteinGrams + row.totalProteinGrams,
      carbsGrams: current.carbsGrams + row.totalCarbsGrams,
      fatGrams: current.fatGrams + row.totalFatGrams,
    }),
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 },
  );
  const targets = {
    calories: day?.targetCalories ?? null,
    proteinGrams: day?.targetProteinGrams ?? null,
    carbsGrams: day?.targetCarbsGrams ?? null,
    fatGrams: day?.targetFatGrams ?? null,
  };

  return {
    date,
    totals,
    targets,
    targetStatus: {
      calories: targets.calories == null ? null : totals.calories >= targets.calories,
      proteinGrams:
        targets.proteinGrams == null
          ? null
          : totals.proteinGrams >= targets.proteinGrams,
      carbsGrams:
        targets.carbsGrams == null ? null : totals.carbsGrams >= targets.carbsGrams,
      fatGrams: targets.fatGrams == null ? null : totals.fatGrams >= targets.fatGrams,
    },
  };
}
