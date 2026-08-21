import { relations, sql } from "drizzle-orm";
import type { MealItem, PlanDetails } from "@running-club/shared";
import {
  boolean,
  type AnyPgColumn,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
});

export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    public: boolean("public"),
    type: text("type"),
    requirePKCE: boolean("require_pkce"),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("oauthClient_userId_idx").on(table.userId)],
);

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    revoked: timestamp("revoked"),
    authTime: timestamp("auth_time"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauthRefreshToken_clientId_idx").on(table.clientId),
    index("oauthRefreshToken_sessionId_idx").on(table.sessionId),
    index("oauthRefreshToken_userId_idx").on(table.userId),
  ],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauthAccessToken_clientId_idx").on(table.clientId),
    index("oauthAccessToken_sessionId_idx").on(table.sessionId),
    index("oauthAccessToken_userId_idx").on(table.userId),
    index("oauthAccessToken_refreshId_idx").on(table.refreshId),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("oauthConsent_clientId_idx").on(table.clientId),
    index("oauthConsent_userId_idx").on(table.userId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  oauthClients: many(oauthClient),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
  integrations: many(userIntegration),
  planTemplates: many(planTemplate),
  planOccurrences: many(planOccurrence),
  gymWorkouts: many(gymWorkout),
  nutritionDays: many(nutritionDay),
  meals: many(meal),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
  user: one(user, {
    fields: [oauthClient.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}));

export const oauthRefreshTokenRelations = relations(
  oauthRefreshToken,
  ({ one, many }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthRefreshToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthRefreshToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthRefreshToken.userId],
      references: [user.id],
    }),
    oauthAccessTokens: many(oauthAccessToken),
  }),
);

export const oauthAccessTokenRelations = relations(
  oauthAccessToken,
  ({ one }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthAccessToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthAccessToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthAccessToken.userId],
      references: [user.id],
    }),
    oauthRefreshToken: one(oauthRefreshToken, {
      fields: [oauthAccessToken.refreshId],
      references: [oauthRefreshToken.id],
    }),
  }),
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthConsent.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}));

export const run = pgTable(
  "run",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    trainingLoad: real("training_load"),
    intensity: real("intensity"),
    gapPaceSecPerKm: real("gap_pace_sec_per_km"),
    hrZoneSeconds: jsonb("hr_zone_seconds"),
    hrZoneBpm: jsonb("hr_zone_bpm"),
    streams: jsonb("streams"),
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
    userStartedIdx: index("run_user_started_idx").on(t.userId, t.startedAt),
    userExternalUid: uniqueIndex("run_user_external_uid").on(
      t.userId,
      t.externalId,
    ),
  }),
);

export const userIntegration = pgTable(
  "user_integration",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    hint: text("hint"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userProviderUid: uniqueIndex("user_integration_user_provider_uid").on(
      t.userId,
      t.provider,
    ),
  }),
);

export const userIntegrationRelations = relations(userIntegration, ({ one }) => ({
  user: one(user, {
    fields: [userIntegration.userId],
    references: [user.id],
  }),
}));

export const weeklyGoal = pgTable(
  "weekly_goal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
  },
  (t) => ({
    oneActivePerUser: uniqueIndex("weekly_goal_one_active_per_user")
      .on(t.userId)
      .where(sql`${t.active} = true`),
  }),
);

// Explicit return types keep the mutually linked table declarations acyclic to
// TypeScript while allowing Drizzle to emit both foreign keys after creation.
const getPlanOccurrenceId = (): AnyPgColumn => planOccurrence.id;
const getGymWorkoutId = (): AnyPgColumn => gymWorkout.id;

export const planTemplate = pgTable(
  "plan_template",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    details: jsonb("details").$type<PlanDetails["details"]>().notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userWeekdayIdx: index("plan_template_user_weekday_idx").on(
      t.userId,
      t.weekday,
    ),
  }),
);

export const planOccurrence = pgTable(
  "plan_occurrence",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => planTemplate.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    details: jsonb("details").$type<PlanDetails["details"]>().notNull(),
    status: text("status").notNull().default("planned"),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    linkedRunId: text("linked_run_id").references(() => run.id, {
      onDelete: "set null",
    }),
    linkedGymWorkoutId: text("linked_gym_workout_id").references(
      getGymWorkoutId,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("plan_occurrence_user_date_idx").on(t.userId, t.date),
    userTemplateDateUid: uniqueIndex("plan_occurrence_user_template_date_uid").on(
      t.userId,
      t.templateId,
      t.date,
    ),
  }),
);

export const gymWorkout = pgTable(
  "gym_workout",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    planOccurrenceId: text("plan_occurrence_id").references(
      getPlanOccurrenceId,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userOccurredAtIdx: index("gym_workout_user_occurred_at_idx").on(
      t.userId,
      t.occurredAt,
    ),
  }),
);

export const gymExercise = pgTable(
  "gym_exercise",
  {
    id: text("id").primaryKey(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => gymWorkout.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => ({
    workoutPositionUid: uniqueIndex("gym_exercise_workout_position_uid").on(
      t.workoutId,
      t.position,
    ),
  }),
);

export const gymSet = pgTable(
  "gym_set",
  {
    id: text("id").primaryKey(),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => gymExercise.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reps: integer("reps").notNull(),
    loadKg: real("load_kg").notNull(),
    rpe: real("rpe"),
  },
  (t) => ({
    exercisePositionUid: uniqueIndex("gym_set_exercise_position_uid").on(
      t.exerciseId,
      t.position,
    ),
  }),
);

export const nutritionDay = pgTable(
  "nutrition_day",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    targetCalories: real("target_calories"),
    targetProteinGrams: real("target_protein_grams"),
    targetCarbsGrams: real("target_carbs_grams"),
    targetFatGrams: real("target_fat_grams"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateUid: uniqueIndex("nutrition_day_user_date_uid").on(t.userId, t.date),
  }),
);

export const meal = pgTable(
  "meal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("draft"),
    items: jsonb("items").$type<MealItem[]>().notNull(),
    totalCalories: real("total_calories").notNull(),
    totalProteinGrams: real("total_protein_grams").notNull(),
    totalCarbsGrams: real("total_carbs_grams").notNull(),
    totalFatGrams: real("total_fat_grams").notNull(),
    imageReference: text("image_reference"),
    source: text("source").notNull().default("mcp"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userOccurredAtIdx: index("meal_user_occurred_at_idx").on(
      t.userId,
      t.occurredAt,
    ),
    userStatusOccurredAtIdx: index("meal_user_status_occurred_at_idx").on(
      t.userId,
      t.status,
      t.occurredAt,
    ),
  }),
);

export const planTemplateRelations = relations(planTemplate, ({ one, many }) => ({
  user: one(user, {
    fields: [planTemplate.userId],
    references: [user.id],
  }),
  occurrences: many(planOccurrence),
}));

export const planOccurrenceRelations = relations(
  planOccurrence,
  ({ one, many }) => ({
    user: one(user, {
      fields: [planOccurrence.userId],
      references: [user.id],
    }),
    template: one(planTemplate, {
      fields: [planOccurrence.templateId],
      references: [planTemplate.id],
    }),
    gymWorkouts: many(gymWorkout),
  }),
);

export const gymWorkoutRelations = relations(gymWorkout, ({ one, many }) => ({
  user: one(user, {
    fields: [gymWorkout.userId],
    references: [user.id],
  }),
  planOccurrence: one(planOccurrence, {
    fields: [gymWorkout.planOccurrenceId],
    references: [planOccurrence.id],
  }),
  exercises: many(gymExercise),
}));

export const gymExerciseRelations = relations(gymExercise, ({ one, many }) => ({
  workout: one(gymWorkout, {
    fields: [gymExercise.workoutId],
    references: [gymWorkout.id],
  }),
  sets: many(gymSet),
}));

export const gymSetRelations = relations(gymSet, ({ one }) => ({
  exercise: one(gymExercise, {
    fields: [gymSet.exerciseId],
    references: [gymExercise.id],
  }),
}));

export const nutritionDayRelations = relations(nutritionDay, ({ one }) => ({
  user: one(user, {
    fields: [nutritionDay.userId],
    references: [user.id],
  }),
}));

export const mealRelations = relations(meal, ({ one }) => ({
  user: one(user, {
    fields: [meal.userId],
    references: [user.id],
  }),
}));
