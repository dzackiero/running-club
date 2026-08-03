import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Better Auth user/session/account tables are added in Task 3 via auth migrate / drizzle adapter.

export const run = pgTable(
  "run",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    distanceMeters: real("distance_meters").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    activityType: text("activity_type").notNull(),
    avgHeartRate: integer("avg_heart_rate"),
    maxHeartRate: integer("max_heart_rate"),
    elevationGainMeters: real("elevation_gain_meters"),
    calories: real("calories"),
    avgCadence: real("avg_cadence"),
    perceivedEffort: integer("perceived_effort"),
    notes: text("notes"),
    splits: jsonb("splits"),
    polyline: text("polyline"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Non-unique: a user may log multiple runs with the same startedAt
    userStartedIdx: index("run_user_started_idx").on(t.userId, t.startedAt),
    // Dedup for Strava later — enforce non-null externalId in service or use partial unique SQL
    userExternalUid: uniqueIndex("run_user_external_uid").on(
      t.userId,
      t.externalId,
    ),
  }),
);

export const weeklyGoal = pgTable("weekly_goal", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  targetDistanceMeters: real("target_distance_meters"),
  targetDurationSeconds: integer("target_duration_seconds"),
  targetRunCount: integer("target_run_count"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
