# Running Club v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a multi-user personal running API (Hono) with Vite UI, Better Auth (session + OAuth 2.1 for ChatGPT MCP), rich run storage, personal weekly goals, light insights, and MCP tools wrapping the same domain services.

**Architecture:** pnpm monorepo — `apps/api` (Hono REST + Better Auth + MCP), `apps/web` (Vite React), `packages/shared` (Zod schemas). Postgres via Drizzle. REST is source of truth; MCP tools call the same services. Durable Node host (not serverless-only).

**Tech Stack:** TypeScript, pnpm workspaces, Hono, Drizzle ORM, Postgres, Better Auth + `@better-auth/oauth-provider` + JWT plugin, Zod, Vitest, Vite + React, `@modelcontextprotocol/sdk` (or `mcp-handler` if it fits the Hono mount cleanly)

**Spec:** `docs/superpowers/specs/2026-08-03-running-club-design.md`

## Global Constraints

- v1 is personal tool first — no Strava sync, clubs, or Resend email
- Required run fields only: `startedAt`, `distanceMeters`, `durationSeconds`, `activityType`; all smartwatch extras optional but supported
- Store distance in meters; one active weekly goal per user
- ChatGPT MCP auth is OAuth 2.1 via Better Auth OAuth Provider — not personal access tokens as the primary path
- `packages/shared` stays schemas/types only (no DB, no React)
- Skip Turborepo/Nx; pnpm workspaces only

---

## File structure (create as tasks proceed)

```
package.json                          # pnpm workspace root scripts
pnpm-workspace.yaml
tsconfig.base.json
.env.example

packages/shared/
  package.json
  tsconfig.json
  src/index.ts
  src/run.ts                          # Zod run schemas + activity types
  src/goal.ts                         # Zod weekly goal schemas
  src/insights.ts                     # Zod insight query/response schemas
  src/errors.ts                       # shared error codes
  src/*.test.ts

apps/api/
  package.json
  tsconfig.json
  vitest.config.ts
  drizzle.config.ts
  src/index.ts                        # serve Hono app
  src/app.ts                          # Hono app composition
  src/env.ts
  src/db/client.ts
  src/db/schema.ts                    # drizzle tables: user/session (BA) + runs + weekly_goals
  src/auth/index.ts                   # betterAuth + oauthProvider + jwt
  src/middleware/session.ts
  src/middleware/require-user.ts
  src/services/runs.ts
  src/services/goals.ts
  src/services/insights.ts
  src/routes/runs.ts
  src/routes/goals.ts
  src/routes/insights.ts
  src/mcp/server.ts                   # MCP tools
  src/mcp/auth.ts                     # token verify + protected-resource metadata
  src/lib/errors.ts
  src/lib/pace.ts
  src/**/*.test.ts

apps/web/
  package.json
  vite.config.ts
  index.html
  src/main.tsx
  src/App.tsx
  src/lib/auth-client.ts
  src/lib/api.ts
  src/pages/SignIn.tsx
  src/pages/SignUp.tsx
  src/pages/Consent.tsx               # OAuth consent (Better Auth oauthProvider)
  src/pages/Home.tsx
  src/pages/Goal.tsx
  src/pages/Connect.tsx
```

---

### Task 1: Monorepo scaffold + shared Zod schemas

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/**`
- Test: `packages/shared/src/run.test.ts`, `packages/shared/src/goal.test.ts`

**Interfaces:**
- Produces: `CreateRunInput`, `createRunSchema`, `ActivityType`, `UpsertWeeklyGoalInput`, `upsertWeeklyGoalSchema`, `SummaryQuery`, `summaryQuerySchema`

- [ ] **Step 1: Scaffold workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Root `package.json`:
```json
{
  "name": "running-club",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "engines": {
    "node": ">=22"
  },
  "packageManager": "pnpm@9.15.0"
}
```

`.gitignore`:
```
node_modules
dist
.env
.env.local
*.log
.DS_Store
coverage
```

`.env.example`:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/running_club
BETTER_AUTH_SECRET=replace-with-long-random-secret
BETTER_AUTH_URL=http://localhost:8787
WEB_ORIGIN=http://localhost:5173
API_PUBLIC_URL=http://localhost:8787
```

- [ ] **Step 2: Create `packages/shared` with Vitest and write failing tests**

`packages/shared/package.json`:
```json
{
  "name": "@running-club/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "dev": "vitest",
    "build": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/shared/src/run.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createRunSchema } from "./run";

describe("createRunSchema", () => {
  it("accepts required fields only", () => {
    const parsed = createRunSchema.parse({
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1800,
      activityType: "run",
    });
    expect(parsed.distanceMeters).toBe(5000);
    expect(parsed.avgHeartRate).toBeUndefined();
  });

  it("rejects missing duration", () => {
    expect(() =>
      createRunSchema.parse({
        startedAt: "2026-08-03T06:00:00.000Z",
        distanceMeters: 5000,
        activityType: "run",
      }),
    ).toThrow();
  });

  it("accepts optional smartwatch fields", () => {
    const parsed = createRunSchema.parse({
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 10000,
      durationSeconds: 3600,
      activityType: "trail",
      avgHeartRate: 150,
      maxHeartRate: 175,
      elevationGainMeters: 220,
      calories: 650,
      avgCadence: 172,
      perceivedEffort: 7,
      notes: "hilly",
      source: "manual",
    });
    expect(parsed.avgHeartRate).toBe(150);
    expect(parsed.activityType).toBe("trail");
  });
});
```

`packages/shared/src/goal.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { upsertWeeklyGoalSchema } from "./goal";

describe("upsertWeeklyGoalSchema", () => {
  it("requires at least one target metric", () => {
    expect(() =>
      upsertWeeklyGoalSchema.parse({
        weekStartsOn: 1,
      }),
    ).toThrow();
  });

  it("accepts distance-only weekly goal", () => {
    const parsed = upsertWeeklyGoalSchema.parse({
      weekStartsOn: 1,
      targetDistanceMeters: 40000,
    });
    expect(parsed.targetDistanceMeters).toBe(40000);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (modules missing)**

Run: `pnpm install` from repo root, then `pnpm --filter @running-club/shared test`  
Expected: FAIL resolving `./run` / `./goal` or exports

- [ ] **Step 4: Implement shared schemas**

`packages/shared/src/run.ts`:
```ts
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
```

`packages/shared/src/goal.ts`:
```ts
import { z } from "zod";

export const upsertWeeklyGoalSchema = z
  .object({
    weekStartsOn: z.number().int().min(0).max(6).default(1),
    targetDistanceMeters: z.number().positive().optional(),
    targetDurationSeconds: z.number().int().positive().optional(),
    targetRunCount: z.number().int().positive().optional(),
  })
  .refine(
    (v) =>
      v.targetDistanceMeters != null ||
      v.targetDurationSeconds != null ||
      v.targetRunCount != null,
    { message: "At least one of targetDistanceMeters, targetDurationSeconds, targetRunCount is required" },
  );

export type UpsertWeeklyGoalInput = z.infer<typeof upsertWeeklyGoalSchema>;
```

`packages/shared/src/insights.ts`:
```ts
import { z } from "zod";

export const summaryQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
```

`packages/shared/src/errors.ts`:
```ts
export const errorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];
```

`packages/shared/src/index.ts`:
```ts
export * from "./run";
export * from "./goal";
export * from "./insights";
export * from "./errors";
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `pnpm --filter @running-club/shared test`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example packages/shared
git commit -m "chore: scaffold monorepo and shared Zod schemas"
```

---

### Task 2: API app + Drizzle schema for runs and goals

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/drizzle.config.ts`, `apps/api/src/db/**`, `apps/api/src/env.ts`, `apps/api/src/lib/pace.ts`
- Test: `apps/api/src/lib/pace.test.ts`

**Interfaces:**
- Consumes: shared activity/source enums conceptually
- Produces: Drizzle tables `run`, `weeklyGoal`; `avgPaceSecPerKm(distanceMeters, durationSeconds): number | null`

- [ ] **Step 1: Scaffold `apps/api` dependencies**

`apps/api/package.json` (scripts + deps):
```json
{
  "name": "@running-club/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@running-club/shared": "workspace:*",
    "better-auth": "^1.3.0",
    "@better-auth/oauth-provider": "^1.3.0",
    "drizzle-orm": "^0.39.0",
    "hono": "^4.7.0",
    "@hono/node-server": "^1.14.0",
    "postgres": "^3.4.0",
    "zod": "^3.24.0",
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Pin exact versions at install time to whatever is current/stable; keep Better Auth OAuth Provider paired with `better-auth`.

- [ ] **Step 2: Write failing pace test**

`apps/api/src/lib/pace.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { avgPaceSecPerKm } from "./pace";

describe("avgPaceSecPerKm", () => {
  it("computes pace for 5k in 25:00", () => {
    expect(avgPaceSecPerKm(5000, 1500)).toBe(300);
  });

  it("returns null for zero distance", () => {
    expect(avgPaceSecPerKm(0, 1500)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `pnpm --filter @running-club/api test`  
Expected: FAIL cannot find `./pace`

- [ ] **Step 4: Implement pace helper + Drizzle schema**

`apps/api/src/lib/pace.ts`:
```ts
export function avgPaceSecPerKm(
  distanceMeters: number,
  durationSeconds: number,
): number | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;
  return durationSeconds / (distanceMeters / 1000);
}
```

`apps/api/src/db/schema.ts` (app tables; Better Auth tables generated/added in Task 3 — for now define runs/goals and leave a comment that BA tables come from `auth migrate` / drizzle adapter):

```ts
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";

import { index, uniqueIndex } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Non-unique: a user may log multiple runs with the same startedAt
    userStartedIdx: index("run_user_started_idx").on(t.userId, t.startedAt),
    // Dedup for Strava later — enforce non-null externalId in service or use partial unique SQL
    userExternalUid: uniqueIndex("run_user_external_uid").on(t.userId, t.externalId),
  }),
);
```

`weeklyGoal` table:
```ts
export const weeklyGoal = pgTable("weekly_goal", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  targetDistanceMeters: real("target_distance_meters"),
  targetDurationSeconds: integer("target_duration_seconds"),
  targetRunCount: integer("target_run_count"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`apps/api/src/db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../env";

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
```

`apps/api/src/env.ts`:
```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  PORT: z.coerce.number().default(8787),
});

export const env = envSchema.parse(process.env);
```

Wire `drizzle.config.ts` to `DATABASE_URL` and `src/db/schema.ts`.

- [ ] **Step 5: Run pace tests — expect PASS; push schema when DB available**

Run: `pnpm --filter @running-club/api test`  
Expected: PASS  

If local Postgres is up: `pnpm --filter @running-club/api db:push`  
Expected: tables created

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): add drizzle schema for runs and weekly goals"
```

---

### Task 3: Better Auth (email/password) + Hono session middleware

**Files:**
- Create: `apps/api/src/auth/index.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/middleware/session.ts`, `apps/api/src/middleware/require-user.ts`, `apps/api/src/lib/errors.ts`
- Modify: `apps/api/src/db/schema.ts` (merge Better Auth Drizzle tables per BA docs)
- Test: `apps/api/src/auth/auth.integration.test.ts` (signup + session cookie against test DB, or skip if no DB and document manual check)

**Interfaces:**
- Produces: `auth` instance; `AppEnv` with `user` / `session`; `requireUser` middleware; JSON error helper `jsonError(c, status, code, message)`

- [ ] **Step 1: Implement Better Auth with Drizzle adapter (email/password only for now)**

Follow https://better-auth.com/docs/integrations/hono and https://better-auth.com/docs/installation  

`apps/api/src/auth/index.ts` sketch:
```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { env } from "../env";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  emailAndPassword: { enabled: true },
  // oauthProvider added in Task 7
});
```

Generate/merge BA tables into `schema.ts` via `pnpm dlx @better-auth/cli generate` (or project’s `auth generate`) and `db:push`.

- [ ] **Step 2: Mount Hono app with CORS + auth handler + session middleware**

`apps/api/src/app.ts`:
```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { env } from "./env";

export type AppEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

export const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: env.WEB_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["WWW-Authenticate"],
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));
```

`require-user.ts`:
```ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return jsonError(c, 401, "UNAUTHORIZED", "Authentication required");
  await next();
};
```

- [ ] **Step 3: Smoke-test auth**

Run API: `pnpm --filter @running-club/api dev`  
Manual or integration: `POST /api/auth/sign-up/email` then `GET` a protected stub that returns `c.get("user")`  
Expected: user JSON when cookie present; 401 without

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat(api): add Better Auth email/password and session middleware"
```

---

### Task 4: Runs service + REST routes (TDD)

**Files:**
- Create: `apps/api/src/services/runs.ts`, `apps/api/src/routes/runs.ts`
- Modify: `apps/api/src/app.ts` (mount routes)
- Test: `apps/api/src/services/runs.test.ts`

**Interfaces:**
- Consumes: `CreateRunInput`, `UpdateRunInput`, `db`, `avgPaceSecPerKm`
- Produces:
  - `createRun(userId, input): Promise<RunRecord>`
  - `listRuns(userId, { from?, to?, activityType?, limit?, cursor? }): Promise<RunRecord[]>`
  - `getRun(userId, id): Promise<RunRecord | null>`
  - `updateRun(userId, id, input): Promise<RunRecord | null>`
  - `deleteRun(userId, id): Promise<boolean>`
  - `RunRecord` includes computed `avgPaceSecPerKm`

- [ ] **Step 1: Write failing service tests** (use transactional test DB or drizzle mock — prefer real Postgres test DB)

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createRun, getRun, listRuns, deleteRun } from "./runs";

const userId = "user_test_1";

describe("runs service", () => {
  it("creates a run with required fields and derived pace", async () => {
    const run = await createRun(userId, {
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    expect(run.id).toBeTruthy();
    expect(run.avgPaceSecPerKm).toBe(300);
    expect(run.source).toBe("manual");
  });

  it("lists only the owning user's runs", async () => {
    await createRun("other", {
      startedAt: "2026-08-03T07:00:00.000Z",
      distanceMeters: 1000,
      durationSeconds: 400,
      activityType: "run",
    });
    const mine = await listRuns(userId, {});
    expect(mine.every((r) => r.userId === userId)).toBe(true);
  });

  it("deletes owned run", async () => {
    const run = await createRun(userId, {
      startedAt: "2026-08-03T08:00:00.000Z",
      distanceMeters: 2000,
      durationSeconds: 700,
      activityType: "treadmill",
    });
    expect(await deleteRun(userId, run.id)).toBe(true);
    expect(await getRun(userId, run.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @running-club/api test`  
Expected: FAIL `createRun` not found / not implemented

- [ ] **Step 3: Implement service + routes**

Service responsibilities:
- Generate `id` with `crypto.randomUUID()`
- Parse dates to `Date`
- Default `source` to `manual`
- Map DB row → `RunRecord` with `avgPaceSecPerKm`
- Enforce `userId` on all reads/writes

Routes (`/runs`):
- `POST /` → `createRunSchema.parse` → 201
- `GET /` → query `from`,`to`,`activityType`,`limit`
- `GET /:id` → 404 if missing
- `PATCH /:id` → `updateRunSchema`
- `DELETE /:id` → 204/200

Mount with `requireUser`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add runs service and REST routes"
```

---

### Task 5: Weekly goals service + REST (TDD)

**Files:**
- Create: `apps/api/src/services/goals.ts`, `apps/api/src/routes/goals.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/services/goals.test.ts`

**Interfaces:**
- Produces:
  - `getCurrentGoal(userId): Promise<WeeklyGoalRecord | null>`
  - `upsertCurrentGoal(userId, input): Promise<WeeklyGoalRecord>` — deactivates previous active goal, inserts/activates one

- [ ] **Step 1: Failing tests for one-active-goal invariant**

```ts
it("upsert replaces previous active goal", async () => {
  const first = await upsertCurrentGoal(userId, {
    weekStartsOn: 1,
    targetDistanceMeters: 30000,
  });
  const second = await upsertCurrentGoal(userId, {
    weekStartsOn: 1,
    targetDistanceMeters: 40000,
    targetRunCount: 4,
  });
  expect(second.active).toBe(true);
  expect(second.targetDistanceMeters).toBe(40000);
  const current = await getCurrentGoal(userId);
  expect(current?.id).toBe(second.id);
  expect(current?.id).not.toBe(first.id);
});
```

- [ ] **Step 2: Implement service + `GET/PUT /goals/current`**

Validate body with `upsertWeeklyGoalSchema`.

- [ ] **Step 3: Tests PASS + commit**

```bash
git add apps/api
git commit -m "feat(api): add personal weekly goals API"
```

---

### Task 6: Insights service + REST (TDD)

**Files:**
- Create: `apps/api/src/services/insights.ts`, `apps/api/src/routes/insights.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/services/insights.test.ts`

**Interfaces:**
- Produces:
  - `getSummary(userId, { from, to }): Promise<Summary>`
  - `getWeekProgress(userId, now?: Date): Promise<WeekProgress>`

`Summary` shape:
```ts
type Summary = {
  from: string;
  to: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  runCount: number;
  avgPaceSecPerKm: number | null;
  daysWithRun: number;
  previousPeriod: {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    runCount: number;
    avgPaceSecPerKm: number | null;
  };
};
```

`WeekProgress` shape:
```ts
type WeekProgress = {
  weekStart: string;
  weekEnd: string;
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    runCount: number;
  };
  goal: WeeklyGoalRecord | null;
  progress: {
    distanceRatio: number | null;
    durationRatio: number | null;
    runCountRatio: number | null;
  };
};
```

Week start: use goal’s `weekStartsOn` (default Monday=1) and user timezone later; v1 use UTC with `weekStartsOn`.

- [ ] **Step 1: Seed runs across two weeks; assert vs-previous and goal ratios**

- [ ] **Step 2: Implement + mount `GET /insights/summary` and `GET /insights/week`**

- [ ] **Step 3: Tests PASS + commit**

```bash
git add apps/api
git commit -m "feat(api): add summary and weekly progress insights"
```

---

### Task 7: OAuth 2.1 provider for ChatGPT MCP

**Files:**
- Modify: `apps/api/src/auth/index.ts`
- Create: `apps/api/src/mcp/auth.ts`
- Modify: `apps/api/src/app.ts` (protected-resource metadata route)
- Web consent/sign-in pages come in Task 9; API must redirect `loginPage` / `consentPage` to web origins

**Interfaces:**
- Produces: OAuth authorization server via Better Auth; `verifyMcpAccessToken(req): Promise<{ userId: string } | null>`; `GET /.well-known/oauth-protected-resource` (and path variants as required)

- [ ] **Step 1: Add `@better-auth/oauth-provider` + `jwt()` plugins**

Per https://better-auth.com/docs/plugins/oauth-provider :

```ts
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";

plugins: [
  jwt(),
  oauthProvider({
    loginPage: `${env.WEB_ORIGIN}/sign-in`,
    consentPage: `${env.WEB_ORIGIN}/consent`,
    allowDynamicClientRegistration: true,
    // enable unauthenticated public client registration if required by ChatGPT DCR at implementation time
    allowUnauthenticatedClientRegistration: true,
  }),
],
```

Run schema migrate/push for OAuth tables.

- [ ] **Step 2: Expose protected-resource metadata for `API_PUBLIC_URL`**

Point `authorization_servers` at `BETTER_AUTH_URL`. Audience/resource = `API_PUBLIC_URL` (or `${API_PUBLIC_URL}/mcp` — pick one and use the same value in token verification).

- [ ] **Step 3: Implement `verifyMcpAccessToken`**

Use `oauthProvider` verification helpers (`verifyAccessToken` / introspection / `mcpHandler` patterns from docs). Map token subject → `userId`.

- [ ] **Step 4: Manual check with MCP Inspector OAuth flow against local API**

Expected: authorize → redirect to web login URL; after login/consent, access token verifies.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add Better Auth OAuth provider for MCP clients"
```

---

### Task 8: MCP server tools wrapping domain services

**Files:**
- Create: `apps/api/src/mcp/server.ts`
- Modify: `apps/api/src/app.ts` (mount `/mcp`)
- Test: `apps/api/src/mcp/server.test.ts` (invoke tool handlers with a fake auth userId)

**Interfaces:**
- Consumes: runs/goals/insights services; `verifyMcpAccessToken`
- Produces: MCP tools — `log_run`, `list_runs`, `get_run`, `update_run`, `delete_run`, `get_weekly_progress`, `set_weekly_goal`, `get_summary`

- [ ] **Step 1: Write unit tests for tool input → service calls** (auth stubbed)

Example:
```ts
it("log_run creates a run for the authenticated user", async () => {
  const result = await handleLogRun("user_1", {
    startedAt: "2026-08-03T06:00:00.000Z",
    distanceMeters: 5000,
    durationSeconds: 1500,
    activityType: "run",
  });
  expect(result.content[0].text).toContain("5000");
});
```

- [ ] **Step 2: Implement MCP HTTP transport on `/mcp`**

- On missing/invalid token: `401` + `WWW-Authenticate` / MCP auth challenge metadata so ChatGPT can start OAuth
- On success: resolve `userId`, dispatch tools
- Validate tool args with the same Zod schemas as REST

Tool behavior must call existing services only — no duplicated SQL.

- [ ] **Step 3: Tests PASS + commit**

```bash
git add apps/api
git commit -m "feat(api): expose running tools over MCP"
```

---

### Task 9: Vite web app (auth, history, goal, connect, consent)

**Files:**
- Create: `apps/web/**` as listed in file structure
- Modify: root scripts if needed

**Interfaces:**
- Consumes: Better Auth client; REST `/runs`, `/goals/current`, `/insights/week`
- Produces: pages at `/sign-in`, `/sign-up`, `/consent`, `/`, `/goal`, `/connect`

- [ ] **Step 1: Scaffold Vite React TS app in `apps/web`**

```bash
pnpm create vite apps/web --template react-ts
```

Add deps: `better-auth`, react-router (or minimal router).

`src/lib/auth-client.ts`:
```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
});
```

`src/lib/api.ts` — `fetch` helpers with `credentials: "include"` to `VITE_API_URL`.

- [ ] **Step 2: Implement SignIn / SignUp**

Use `authClient.signIn.email` / `signUp.email`. After success, navigate to `/`.

- [ ] **Step 3: Implement Consent page**

Follow Better Auth OAuth Provider consent UI requirements (approve scopes / client). Must work when ChatGPT redirects to `consentPage`.

- [ ] **Step 4: Home — list recent runs + week snapshot from `/insights/week`**

Keep UI thin: brand/name, week progress line, recent runs list. No card-heavy dashboard.

- [ ] **Step 5: Goal page — form bound to `PUT /goals/current`**

Fields: distance km (convert ↔ meters), duration minutes, run count, week starts on.

- [ ] **Step 6: Connect page**

Show `VITE_API_URL` + `/mcp`, short steps: add remote MCP in ChatGPT → sign in / consent when prompted. No primary PAT flow.

- [ ] **Step 7: Manual E2E**

1. Sign up in web  
2. Set weekly goal  
3. `POST /runs` via web or API  
4. See run on home  
5. (If possible) OAuth connect via MCP Inspector  

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add auth, history, goal, and ChatGPT connect pages"
```

---

### Task 10: README + runbook polish

**Files:**
- Create: `README.md`
- Modify: `.env.example` if any vars missing (`VITE_API_URL`)

- [ ] **Step 1: Write README**

Include:
- What this is (personal running MCP + API)
- Stack diagram (one paragraph)
- Prerequisites (Node 22+, pnpm, Postgres)
- Setup: copy `.env.example`, `pnpm install`, `db:push`, `pnpm dev`
- How to connect ChatGPT (OAuth MCP URL)
- v1 non-goals (Strava, clubs, email)

- [ ] **Step 2: Commit**

```bash
git add README.md .env.example
git commit -m "docs: add setup and ChatGPT MCP runbook"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Store runs (rich, sparse required fields) | 1, 2, 4 |
| Light insights | 6 |
| REST + MCP same services | 4–6, 8 |
| Better Auth multi-user | 3 |
| OAuth 2.1 for ChatGPT MCP | 7, 8, 9 consent |
| Personal weekly goals | 5, 9 |
| Thin Vite UI | 9 |
| Hono + Vite monorepo + shared Zod | 1–2, 9 |
| Strava / clubs / Resend deferred | Explicitly absent (Task 10 documents) |
| Durable host note | README |

No TBD placeholders. Types/names aligned: `createRun`, `upsertCurrentGoal`, `getSummary`, `getWeekProgress`, MCP tool names match spec.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-03-running-club-v1.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

Which approach?
