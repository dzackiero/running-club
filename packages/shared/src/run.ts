import { z } from "zod";

export const activityTypes = [
  "run",
  "walk",
  "trail",
  "treadmill",
  "race",
] as const;
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

export type CreateRunInput = z.input<typeof createRunSchema>;

export const updateRunSchema = createRunSchema.partial();
export type UpdateRunInput = z.input<typeof updateRunSchema>;

/** Shared list filters for REST query params and MCP list_runs. */
export const listRunsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  activityType: z.enum(activityTypes).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().datetime().optional(),
});

export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

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
