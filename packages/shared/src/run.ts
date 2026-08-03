import { z } from "zod";

export const activityTypes = ["run", "trail", "treadmill", "race"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const createRunSchema = z.object({
  startedAt: z.string().datetime(),
  distanceMeters: z.number().positive(),
  durationSeconds: z.number().int().positive(),
  activityType: z.enum(activityTypes),
  avgHeartRate: z.number().int().positive().optional(),
  maxHeartRate: z.number().int().positive().optional(),
  elevationGainMeters: z.number().nonnegative().optional(),
  calories: z.number().nonnegative().optional(),
  avgCadence: z.number().positive().optional(),
  perceivedEffort: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
  splits: z
    .array(
      z.object({
        distanceMeters: z.number().positive(),
        durationSeconds: z.number().int().positive(),
      }),
    )
    .optional(),
  polyline: z.string().optional(),
  source: z.enum(["manual", "strava", "import"]).optional().default("manual"),
  externalId: z.string().optional(),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;

export const updateRunSchema = createRunSchema.partial();
export type UpdateRunInput = z.infer<typeof updateRunSchema>;
