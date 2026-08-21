import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { meal, nutritionDay } from "../db/schema";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import {
  confirmMealDraft,
  createMealDraft,
  discardMealDraft,
  getMealDraft,
  getNutritionProgress,
} from "./nutrition";

const userId = "user_test_nutrition";
const otherUserId = "user_test_nutrition_other";
const date = "2026-08-18";

const draftInput = {
  occurredAt: "2026-08-18T12:30:00.000Z",
  imageReference: "opaque-mcp-image-reference",
  items: [
    {
      name: "Chicken rice",
      grams: 320,
      calories: 540,
      proteinGrams: 35,
      carbsGrams: 68,
      fatGrams: 14,
    },
  ],
};

describe("nutrition service", () => {
  beforeAll(async () => {
    await ensureTestUsers([userId, otherUserId]);
  });

  beforeEach(async () => {
    await db.delete(meal).where(eq(meal.userId, userId));
    await db.delete(nutritionDay).where(eq(nutritionDay.userId, userId));
    await db.insert(nutritionDay).values({
      id: crypto.randomUUID(),
      userId,
      date,
      targetCalories: 500,
      targetProteinGrams: 30,
    });
  });

  afterAll(async () => {
    await deleteTestUsers([userId, otherUserId]);
  });

  it("excludes a draft from the day's totals", async () => {
    const draft = await createMealDraft(userId, draftInput);
    const progress = await getNutritionProgress(userId, date);

    expect(draft.status).toBe("draft");
    expect(draft.imageReference).toBe("opaque-mcp-image-reference");
    expect(progress.totals).toEqual({
      calories: 0,
      proteinGrams: 0,
      carbsGrams: 0,
      fatGrams: 0,
    });
    expect(progress.targetStatus).toEqual({
      calories: false,
      proteinGrams: false,
      carbsGrams: null,
      fatGrams: null,
    });
  });

  it("includes a confirmed draft in totals and target status", async () => {
    const draft = await createMealDraft(userId, draftInput);
    const confirmed = await confirmMealDraft(userId, draft.id, {
      items: [
        {
          ...draftInput.items[0],
          grams: 300,
          calories: 500,
          proteinGrams: 30,
        },
      ],
    });
    const progress = await getNutritionProgress(userId, date);

    expect(confirmed).toMatchObject({
      status: "confirmed",
      totalCalories: 500,
      totalProteinGrams: 30,
    });
    expect(progress.totals).toEqual({
      calories: 500,
      proteinGrams: 30,
      carbsGrams: 68,
      fatGrams: 14,
    });
    expect(progress.targetStatus).toEqual({
      calories: true,
      proteinGrams: true,
      carbsGrams: null,
      fatGrams: null,
    });
  });

  it("returns the existing confirmed meal when confirmed twice", async () => {
    const draft = await createMealDraft(userId, draftInput);
    const firstConfirmation = await confirmMealDraft(userId, draft.id, {});
    const secondConfirmation = await confirmMealDraft(userId, draft.id, {});

    expect(secondConfirmation).toEqual(firstConfirmation);

    const confirmedRows = await db
      .select()
      .from(meal)
      .where(
        and(
          eq(meal.userId, userId),
          eq(meal.id, draft.id),
          eq(meal.status, "confirmed"),
        ),
      );
    expect(confirmedRows).toHaveLength(1);
  });

  it("does not expose a draft to another user", async () => {
    const draft = await createMealDraft(userId, draftInput);

    await expect(getMealDraft(otherUserId, draft.id)).rejects.toThrow(
      "Meal draft was not found",
    );
  });

  it("does not confirm a discarded draft", async () => {
    const draft = await createMealDraft(userId, draftInput);

    const discarded = await discardMealDraft(userId, draft.id);

    expect(discarded.status).toBe("discarded");
    await expect(confirmMealDraft(userId, draft.id, {})).rejects.toThrow(
      "Meal draft was not found",
    );
  });
});
