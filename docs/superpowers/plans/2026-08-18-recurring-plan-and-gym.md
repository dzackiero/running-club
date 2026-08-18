# Recurring Plan and Gym Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurring running/gym/nutrition plan occurrences, gym records, and a Today-first weekly overview.

**Architecture:** Shared Zod schemas define plan and gym payloads. API services materialize immutable date occurrences from templates and aggregate a user-scoped week. React consumes a single dashboard view for Today and a Plan page for templates/overrides; imported runs link only to exactly one compatible planned run.

**Tech Stack:** TypeScript, Zod, Drizzle ORM/Postgres, Hono, React/Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-personal-training-dashboard-design.md`

## Global Constraints

- A template change never mutates an already materialized occurrence.
- All mutations and queries scope by authenticated `userId`.
- Ambiguous Intervals matching keeps the run and leaves occurrences unchanged.
- Nutrition occurrences may be planned in this phase, but confirmed nutrition totals arrive in the nutrition/MCP plan.

---

### Task 1: Define shared contracts and persistence tables

**Files:**
- Create: `packages/shared/src/plan.ts`, `packages/shared/src/plan.test.ts`, `packages/shared/src/gym.ts`, `packages/shared/src/gym.test.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/db/schema.ts`
- Create: Drizzle migration under `apps/api/drizzle/`

**Interfaces:**
- Produces `planCategorySchema`, `planStatusSchema`, `createPlanTemplateSchema`, `updatePlanOccurrenceSchema`, `createGymWorkoutSchema`, and record types consumed by routes/services/UI.
- Produces `planTemplate`, `planOccurrence`, `gymWorkout`, `gymExercise`, `gymSet` table exports.

- [ ] **Step 1: Write schema tests first.**

  Test that `createPlanTemplateSchema` accepts `{ weekday: 2, category: "run", title: "Easy 6 km", details: { targetDistanceMeters: 6000 } }`, rejects weekday `7`, and that `updatePlanOccurrenceSchema` accepts only `planned`, `done`, or `skipped`. Test a gym workout with ordered exercises/sets and reject zero reps or negative `loadKg`.

- [ ] **Step 2: Run the shared tests and verify missing exports fail.**

  Run: `pnpm --filter @running-club/shared test -- src/plan.test.ts src/gym.test.ts`

- [ ] **Step 3: Implement schemas and tables.**

  Use these persisted fields:

  ```ts
  planOccurrence: { userId, templateId, date, category, title, details, status, overriddenAt, completedAt, linkedRunId, linkedGymWorkoutId }
  gymWorkout: { userId, occurredAt, planOccurrenceId, notes }
  gymExercise: { workoutId, name, position }
  gymSet: { exerciseId, position, reps, loadKg, rpe }
  ```

  Add user/date indexes and a partial or composite uniqueness constraint preventing duplicate generated occurrences for one `(userId, templateId, date)`.

- [ ] **Step 4: Generate migration and rerun shared tests.**

  Run: `pnpm --filter @running-club/api db:generate && pnpm --filter @running-club/shared test && pnpm --filter @running-club/api typecheck`

- [ ] **Step 5: Commit contracts and schema.**

  ```powershell
  git add packages/shared apps/api/src/db apps/api/drizzle
  git commit -m "feat: add personal plan and gym schema"
  ```

### Task 2: Implement occurrence generation, plan APIs, and weekly aggregation

**Files:**
- Create: `apps/api/src/services/plans.ts`, `apps/api/src/services/plans.test.ts`, `apps/api/src/routes/plans.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/services/insights.ts`, `apps/api/src/routes/insights.ts`, `apps/api/src/routes/http.integration.test.ts`

**Interfaces:**
- Produces `ensurePlanOccurrences(userId, fromDate, toDate)`, `getTodayDashboard(userId, date)`, `listPlanTemplates(userId)`, and `updatePlanOccurrence(userId, id, input)`.
- `GET /plan/templates`, `POST /plan/templates`, `PATCH /plan/occurrences/:id`, and `GET /insights/today?at=<ISO date>` return user-owned records only.

- [ ] **Step 1: Add failing service tests.**

  Seed a Tuesday run template and assert `ensurePlanOccurrences` creates one occurrence for Tuesday, creates no duplicate on a second call, and preserves the original title after the template is edited. Seed two users and assert user B cannot update user A’s occurrence. Assert a week dashboard returns category counts and seven dated schedule cells.

- [ ] **Step 2: Run tests to confirm missing service functions.**

  Run: `pnpm --filter @running-club/api test -- src/services/plans.test.ts`

- [ ] **Step 3: Implement services and routes.**

  Materialize only the requested date range with `onConflictDoNothing`/the unique key. Return a view shaped as:

  ```ts
  type TodayDashboard = { date: string; items: PlanOccurrenceRecord[]; week: { start: string; end: string; days: PlanDay[]; running: { distanceMeters: number; completedSessions: number; plannedSessions: number }; gym: { completedSessions: number; plannedSessions: number }; nutrition: { targetDays: number; achievedDays: number } } }
  ```

  Do not calculate nutrition achievement yet; return `achievedDays: 0` until plan 3.

- [ ] **Step 4: Add HTTP ownership and dashboard tests.**

  In `http.integration.test.ts`, create a template using an authenticated cookie, fetch `/insights/today`, update an owned occurrence, and assert a second user gets 404 for that ID.

- [ ] **Step 5: Verify and commit.**

  Run: `pnpm --filter @running-club/api test && pnpm --filter @running-club/api typecheck`

  ```powershell
  git add apps/api
  git commit -m "feat: add recurring personal plans"
  ```

### Task 3: Add gym logging and safe Intervals plan matching

**Files:**
- Create: `apps/api/src/services/gym.ts`, `apps/api/src/services/gym.test.ts`, `apps/api/src/routes/gym.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/services/intervals-import.ts`, `apps/api/src/services/intervals-import.test.ts`, `apps/api/src/services/plans.ts`

**Interfaces:**
- Produces `createGymWorkout(userId, input)` and `GET/POST /gym/workouts`.
- Produces `linkImportedRunToOccurrence(userId, run)` returning `"linked" | "ambiguous" | "none"`.

- [ ] **Step 1: Write failing tests.**

  Assert creating a gym workout inserts its exercises/sets atomically and marks its linked occurrence done. Assert a single planned run on the same local date becomes done after import, while two candidate planned runs return `ambiguous` and neither is changed.

- [ ] **Step 2: Run focused tests.**

  Run: `pnpm --filter @running-club/api test -- src/services/gym.test.ts src/services/intervals-import.test.ts`

- [ ] **Step 3: Implement the atomic gym service and importer hook.**

  Use one transaction for workout/exercise/set inserts and occurrence completion. Call `linkImportedRunToOccurrence` only after `upsertImportedRun` succeeds; match same local date and `category === "run"`, then update only one candidate.

- [ ] **Step 4: Verify and commit.**

  Run: `pnpm --filter @running-club/api test && pnpm --filter @running-club/api typecheck`

  ```powershell
  git add apps/api
  git commit -m "feat: log gym workouts and link planned runs"
  ```

### Task 4: Build Plan and Today UI

**Files:**
- Create: `apps/web/src/pages/Plan.tsx`, `apps/web/src/components/TodayAgenda.tsx`, `apps/web/src/components/WeeklyOverview.tsx`, `apps/web/src/components/GymWorkoutDialog.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/pages/Home.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/components/Layout.tsx`

**Interfaces:**
- Consumes `getTodayDashboard(at?)`, plan-template CRUD, occurrence update, and gym-workout client functions.
- Produces `/plan` recurrence editing and a Today screen with planned/done/skipped controls plus weekly metrics/schedule strip.

- [ ] **Step 1: Add client functions and type-check their contracts.**

  Define `getTodayDashboard`, `listPlanTemplates`, `createPlanTemplate`, `patchPlanOccurrence`, and `createGymWorkout` in `lib/api.ts` using the route paths from Task 2/3. Run `pnpm --filter @running-club/web typecheck` and fix all imports before UI work.

- [ ] **Step 2: Implement focused components.**

  `TodayAgenda` renders category, title, details, and status action per occurrence. `WeeklyOverview` renders the three category metrics and all seven dates. `Plan` lists templates by weekday/category and opens a form for a new template. `GymWorkoutDialog` submits exercises/sets and refreshes Today after success.

- [ ] **Step 3: Replace old home composition.**

  Have `Home` fetch `getTodayDashboard`, render `TodayAgenda` first, `WeeklyOverview` second, then retain recent runs. Make empty states say `Add a recurring plan to see today’s agenda.`

- [ ] **Step 4: Verify production build and manually exercise the key flow.**

  Run: `pnpm --filter @running-club/web build && pnpm --filter @running-club/web typecheck`

  Manual check: create a Tuesday gym template, open Today on Tuesday, log a workout, and confirm it changes from planned to done without changing future Tuesdays.

- [ ] **Step 5: Commit UI.**

  ```powershell
  git add apps/web
  git commit -m "feat: add today plan and gym dashboard"
  ```
