import { z } from "zod";

export const mealItemSchema = z.object({
  name: z.string().min(1).max(200),
  grams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  proteinGrams: z.number().nonnegative(),
  carbsGrams: z.number().nonnegative(),
  fatGrams: z.number().nonnegative(),
});
export type MealItem = z.infer<typeof mealItemSchema>;

export const createMealDraftSchema = z.object({
  occurredAt: z.string().datetime(),
  items: z.array(mealItemSchema).min(1),
  imageReference: z.string().min(1).max(2000).optional(),
  source: z.enum(["mcp", "manual"]).default("mcp"),
  notes: z.string().max(2000).optional(),
});
export type CreateMealDraftInput = z.input<typeof createMealDraftSchema>;

export const confirmMealDraftSchema = z.object({
  items: z.array(mealItemSchema).min(1).optional(),
  notes: z.string().max(2000).optional(),
});
export type ConfirmMealDraftInput = z.infer<typeof confirmMealDraftSchema>;

export const updateNutritionDaySchema = z.object({
  targetCalories: z.number().nonnegative().optional(),
  targetProteinGrams: z.number().nonnegative().optional(),
  targetCarbsGrams: z.number().nonnegative().optional(),
  targetFatGrams: z.number().nonnegative().optional(),
});
export type UpdateNutritionDayInput = z.infer<typeof updateNutritionDaySchema>;

export type MealRecord = {
  id: string;
  userId: string;
  occurredAt: string;
  status: "draft" | "confirmed" | "discarded";
  items: MealItem[];
  totalCalories: number;
  totalProteinGrams: number;
  totalCarbsGrams: number;
  totalFatGrams: number;
  imageReference: string | null;
  source: "mcp" | "manual";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NutritionDayRecord = {
  id: string;
  userId: string;
  date: string;
  targetCalories: number | null;
  targetProteinGrams: number | null;
  targetCarbsGrams: number | null;
  targetFatGrams: number | null;
  createdAt: string;
  updatedAt: string;
};

export type NutritionProgress = {
  date: string;
  totals: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  targets: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
  };
  targetStatus: {
    calories: boolean | null;
    proteinGrams: boolean | null;
    carbsGrams: boolean | null;
    fatGrams: boolean | null;
  };
};
