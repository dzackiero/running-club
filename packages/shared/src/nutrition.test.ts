import { describe, expect, it } from "vitest";
import {
  confirmMealDraftSchema,
  createMealDraftSchema,
  updateNutritionDaySchema,
} from "./nutrition";

const chickenRice = {
  occurredAt: "2026-08-18T12:30:00.000Z",
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

describe("createMealDraftSchema", () => {
  it("accepts structured client macro estimates and an opaque image reference", () => {
    const parsed = createMealDraftSchema.parse({
      ...chickenRice,
      imageReference: "mcp-image-ref-123",
    });

    expect(parsed.items[0]).toEqual(chickenRice.items[0]);
    expect(parsed.imageReference).toBe("mcp-image-ref-123");
  });

  it("rejects negative estimated macros", () => {
    expect(() =>
      createMealDraftSchema.parse({
        ...chickenRice,
        items: [{ ...chickenRice.items[0], proteinGrams: -1 }],
      }),
    ).toThrow();
  });

  it("rejects infinite item quantities and macros", () => {
    for (const field of [
      "grams",
      "calories",
      "proteinGrams",
      "carbsGrams",
      "fatGrams",
    ] as const) {
      expect(() =>
        createMealDraftSchema.parse({
          ...chickenRice,
          items: [{ ...chickenRice.items[0], [field]: Infinity }],
        }),
      ).toThrow();
    }
  });
});

describe("meal confirmation and nutrition-day inputs", () => {
  it("allows confirmation corrections without a replacement estimate", () => {
    expect(confirmMealDraftSchema.parse({ notes: "Use the smaller portion" })).toEqual({
      notes: "Use the smaller portion",
    });
  });

  it("accepts optional macro targets for a day", () => {
    expect(
      updateNutritionDaySchema.parse({
        targetCalories: 2200,
        targetProteinGrams: 150,
      }),
    ).toEqual({ targetCalories: 2200, targetProteinGrams: 150 });
  });

  it("rejects infinite nutrition targets", () => {
    for (const field of [
      "targetCalories",
      "targetProteinGrams",
      "targetCarbsGrams",
      "targetFatGrams",
    ] as const) {
      expect(() => updateNutritionDaySchema.parse({ [field]: Infinity })).toThrow();
    }
  });
});
