import { z } from "zod";

export const planCategorySchema = z.enum(["run", "gym", "nutrition"]);
export type PlanCategory = z.infer<typeof planCategorySchema>;

export const planStatusSchema = z.enum(["planned", "done", "skipped"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const runPlanDetailsSchema = z
  .object({
    targetDistanceMeters: z.number().positive().optional(),
    targetDurationSeconds: z.number().int().positive().optional(),
    targetPaceSecPerKm: z.number().positive().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const gymPlanDetailsSchema = z
  .object({
    templateName: z.string().min(1).max(200).optional(),
    focus: z.string().min(1).max(200).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const nutritionPlanDetailsSchema = z
  .object({
    targetCalories: z.number().positive().optional(),
    targetProteinGrams: z.number().positive().optional(),
    targetCarbsGrams: z.number().positive().optional(),
    targetFatGrams: z.number().positive().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

/**
 * Category-specific metadata is deliberately represented as a discriminated
 * union so an occurrence can safely retain its materialized category/details.
 */
export const planDetailsSchema = z.discriminatedUnion("category", [
  z.object({ category: z.literal("run"), details: runPlanDetailsSchema }),
  z.object({ category: z.literal("gym"), details: gymPlanDetailsSchema }),
  z.object({
    category: z.literal("nutrition"),
    details: nutritionPlanDetailsSchema,
  }),
]);
export type PlanDetails = z.infer<typeof planDetailsSchema>;

export const createPlanTemplateSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    title: z.string().min(1).max(200),
  })
  .and(planDetailsSchema);
export type CreatePlanTemplateInput = z.infer<typeof createPlanTemplateSchema>;

const occurrenceUpdateDetailsSchema = z.union([
  runPlanDetailsSchema,
  gymPlanDetailsSchema,
  nutritionPlanDetailsSchema,
]);

export const updatePlanOccurrenceSchema = z
  .object({
    status: planStatusSchema.optional(),
    title: z.string().min(1).max(200).optional(),
    category: planCategorySchema.optional(),
    details: occurrenceUpdateDetailsSchema.optional(),
    linkedRunId: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Update required" });
    }

    const hasCategory = value.category !== undefined;
    const hasDetails = value.details !== undefined;
    if (hasCategory !== hasDetails) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "category and details must be updated together",
      });
      return;
    }

    if (hasCategory && hasDetails) {
      const result = planDetailsSchema.safeParse({
        category: value.category,
        details: value.details,
      });
      if (!result.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "details do not match category",
          path: ["details"],
        });
      }
    }

    if (value.linkedRunId !== undefined && value.status !== undefined && value.status !== "done") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a linked run must complete the occurrence",
        path: ["status"],
      });
    }
  });
export type UpdatePlanOccurrenceInput = z.infer<
  typeof updatePlanOccurrenceSchema
>;

export const planTemplateRecordSchema = planDetailsSchema.and(
  z.object({
    id: z.string(),
    userId: z.string(),
    weekday: z.number().int().min(0).max(6),
    title: z.string().min(1).max(200),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);
export type PlanTemplateRecord = z.infer<typeof planTemplateRecordSchema>;

export const planOccurrenceRecordSchema = planDetailsSchema.and(
  z.object({
    id: z.string(),
    userId: z.string(),
    templateId: z.string().nullable(),
    date: z.string(),
    title: z.string().min(1).max(200),
    status: planStatusSchema,
    overriddenAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    linkedRunId: z.string().nullable(),
    linkedGymWorkoutId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);
export type PlanOccurrenceRecord = z.infer<typeof planOccurrenceRecordSchema>;

export const planDaySchema = z.object({
  date: z.string(),
  items: z.array(planOccurrenceRecordSchema),
});
export type PlanDay = z.infer<typeof planDaySchema>;

export const todayDashboardSchema = z.object({
  date: z.string(),
  items: z.array(planOccurrenceRecordSchema),
  week: z.object({
    start: z.string(),
    end: z.string(),
    days: z.array(planDaySchema),
    running: z.object({
      distanceMeters: z.number().nonnegative(),
      completedSessions: z.number().int().nonnegative(),
      plannedSessions: z.number().int().nonnegative(),
    }),
    gym: z.object({
      completedSessions: z.number().int().nonnegative(),
      plannedSessions: z.number().int().nonnegative(),
    }),
    nutrition: z.object({
      targetDays: z.number().int().nonnegative(),
      achievedDays: z.number().int().nonnegative(),
      today: z.object({ calories: z.number().nonnegative(), proteinGrams: z.number().nonnegative(), targetCalories: z.number().nullable(), targetProteinGrams: z.number().nullable() }),
    }),
  }),
});
export type TodayDashboard = z.infer<typeof todayDashboardSchema>;
