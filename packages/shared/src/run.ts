import { z } from "zod";

export const activityTypes = [
  "run",
  "walk",
  "trail",
  "treadmill",
  "race",
] as const;
export type ActivityType = (typeof activityTypes)[number];

export const runStreamsSchema = z
  .object({
    t: z.array(z.number()).max(250),
    pace: z.array(z.number()).max(250),
    hr: z.array(z.number().nullable()).max(250),
  })
  .refine(
    (value) =>
      value.t.length === value.pace.length &&
      value.t.length === value.hr.length,
    { message: "stream arrays must be the same length" },
  );

export type RunStreams = z.infer<typeof runStreamsSchema>;

export const runSplitSchema = z.object({
  distanceMeters: z.number().positive(),
  durationSeconds: z.number().int().positive(),
  avgHeartRate: z.number().int().positive().optional(),
});

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
  splits: z.array(runSplitSchema).optional(),
  polyline: z.string().optional(),
  trainingLoad: z.number().nonnegative().optional(),
  intensity: z.number().nonnegative().optional(),
  gapPaceSecPerKm: z.number().positive().optional(),
  hrZoneSeconds: z.array(z.number().nonnegative()).max(12).optional(),
  streams: runStreamsSchema.optional(),
  source: z
    .enum(["manual", "strava", "import", "intervals"])
    .optional()
    .default("manual"),
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
  splits: z.infer<typeof runSplitSchema>[] | null;
  polyline: string | null;
  trainingLoad: number | null;
  intensity: number | null;
  gapPaceSecPerKm: number | null;
  hrZoneSeconds: number[] | null;
  streams: RunStreams | null;
  source: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  avgPaceSecPerKm: number | null;
};
