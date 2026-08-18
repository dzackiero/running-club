# Nutrition MCP Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let MCP create meal estimates from photo-informed portion context, require user review/confirmation, and display confirmed nutrition progress in Today and weekly overview.

**Architecture:** Nutrition data has daily targets and statused meals. MCP only persists a structured estimate supplied by the client; confirmation is a separate mutation that may amend items/macros. Aggregation queries count confirmed meals only, and are folded into the existing `TodayDashboard` view.

**Tech Stack:** TypeScript, Zod, Drizzle ORM/Postgres, Hono, MCP SDK, React/Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-personal-training-dashboard-design.md`

## Global Constraints

- A draft meal never contributes to calories, macros, daily target completion, or weekly adherence.
- The server does not perform vision inference or access arbitrary external photo URLs; it validates structured estimates and an optional opaque image reference.
- Every meal and nutrition day is user-owned; a foreign user must receive not-found behavior for IDs.
- Confirming a draft is idempotent: confirming an already-confirmed meal returns the confirmed record and does not duplicate totals.

---

### Task 1: Add nutrition schemas, tables, and service lifecycle

**Files:**
- Create: `packages/shared/src/nutrition.ts`, `packages/shared/src/nutrition.test.ts`, `apps/api/src/services/nutrition.ts`, `apps/api/src/services/nutrition.test.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/db/schema.ts`
- Create: Drizzle migration under `apps/api/drizzle/`

**Interfaces:**
- Produces `createMealDraftSchema`, `confirmMealDraftSchema`, `updateNutritionDaySchema`, `MealRecord`, and `NutritionDayRecord`.
- Produces `createMealDraft`, `getMealDraft`, `confirmMealDraft`, `discardMealDraft`, `getNutritionProgress`.

- [ ] **Step 1: Write failing shared and service tests.**

  Assert a draft accepts items with `{ name, grams, calories, proteinGrams, carbsGrams, fatGrams }`, rejects negative macros, and accepts optional `imageReference`. Assert draft totals do not change `getNutritionProgress`; after `confirmMealDraft`, totals and target status update. Assert confirm twice returns one confirmed row.

- [ ] **Step 2: Run focused tests to establish failures.**

  Run: `pnpm --filter @running-club/shared test -- src/nutrition.test.ts; pnpm --filter @running-club/api test -- src/services/nutrition.test.ts`

- [ ] **Step 3: Implement tables and lifecycle.**

  Create `nutritionDay` with unique `(userId, date)` and calorie/protein/carbs/fat target columns. Create `meal` with `status` (`draft`, `confirmed`, `discarded`), `items` JSONB, total macro columns, `occurredAt`, `imageReference`, `source`, and `notes`. Implement confirmation as a transaction that applies corrected items/totals, sets `status: "confirmed"`, and returns the record.

- [ ] **Step 4: Generate migration and verify.**

  Run: `pnpm --filter @running-club/api db:generate && pnpm --filter @running-club/shared test && pnpm --filter @running-club/api test -- src/services/nutrition.test.ts`

- [ ] **Step 5: Commit the nutrition model.**

  ```powershell
  git add packages/shared apps/api/src/db apps/api/src/services apps/api/drizzle
  git commit -m "feat: add reviewable nutrition meals"
  ```

### Task 2: Expose nutrition REST APIs and MCP draft tools

**Files:**
- Create: `apps/api/src/routes/nutrition.ts`, `apps/api/src/routes/nutrition.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/mcp/tools.ts`, `apps/api/src/mcp/server.ts`, `apps/api/src/mcp/server.test.ts`, `apps/api/src/routes/http.integration.test.ts`

**Interfaces:**
- REST: `GET/PUT /nutrition/days/:date`, `GET /nutrition/meals?date=YYYY-MM-DD`, `POST /nutrition/meals`, `POST /nutrition/meals/:id/confirm`, `POST /nutrition/meals/:id/discard`.
- MCP tools: `create_meal_draft`, `get_meal_draft`, `confirm_meal_draft`, `discard_meal_draft`.

- [ ] **Step 1: Add failing HTTP and MCP tests.**

  Test that one authenticated user can create a draft, a second cannot fetch/confirm it, confirmation returns `status: "confirmed"`, and discarded drafts cannot be confirmed. In `mcp/server.test.ts`, initialize a session and assert tool listing includes the four nutrition tool names.

- [ ] **Step 2: Run focused tests.**

  Run: `pnpm --filter @running-club/api test -- src/routes/nutrition.test.ts src/mcp/server.test.ts`

- [ ] **Step 3: Implement route handlers and MCP handlers.**

  Follow `goalsRoutes` for JSON parsing/Zod error responses and `handleLogRun` for `CallToolResult` formatting. Register each MCP tool in `createRunningClubMcpServer` with its shared schema `.shape`; descriptions must state that the client should send food/portion context and that confirmation is required before totals count.

- [ ] **Step 4: Verify all API behavior.**

  Run: `pnpm --filter @running-club/api test && pnpm --filter @running-club/api typecheck`

- [ ] **Step 5: Commit endpoints and MCP integration.**

  ```powershell
  git add apps/api
  git commit -m "feat: add MCP meal draft confirmation"
  ```

### Task 3: Integrate confirmed nutrition into Today and weekly overview

**Files:**
- Modify: `apps/api/src/services/plans.ts`, `apps/api/src/services/plans.test.ts`, `apps/api/src/services/insights.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/components/TodayAgenda.tsx`, `apps/web/src/components/WeeklyOverview.tsx`, `apps/web/src/pages/Home.tsx`

**Interfaces:**
- Extends `TodayDashboard.week.nutrition` to return `{ targetDays, achievedDays, today: { calories, proteinGrams, targetCalories, targetProteinGrams } }`.
- `TodayAgenda` renders confirmed progress and a link/instruction to log a meal via MCP; it never treats a pending draft as intake.

- [ ] **Step 1: Add failing aggregation tests.**

  Seed seven nutrition days with protein targets, confirmed meals on five dates, and draft meals on the other two. Assert `achievedDays === 5`, `targetDays === 7`, and the today protein total excludes draft macros.

- [ ] **Step 2: Run plan service tests.**

  Run: `pnpm --filter @running-club/api test -- src/services/plans.test.ts`

- [ ] **Step 3: Implement confirmed-only aggregation and rendering.**

  Query meals with `status = "confirmed"` inside the dashboard date range, group by local date, and evaluate calorie/protein targets. Update the Today nutrition card to display `current / target protein` and the weekly card to display `achieved / target days`; show `No nutrition target yet` when no target exists.

- [ ] **Step 4: Verify user-facing artifact.**

  Run: `pnpm --filter @running-club/api test && pnpm --filter @running-club/web build && pnpm --filter @running-club/web typecheck`

- [ ] **Step 5: Commit dashboard integration.**

  ```powershell
  git add apps/api apps/web
  git commit -m "feat: show confirmed nutrition progress"
  ```

### Task 4: Document the MCP photo-assisted workflow and run final verification

**Files:**
- Modify: `README.md`, `docs/DESIGN.md`

**Interfaces:**
- Consumes completed MCP tool contracts.
- Produces copy that instructs users to provide a photo plus approximate food types/weights, then review and confirm the returned draft.

- [ ] **Step 1: Update MCP tool table and example.**

  Add the four meal tools and a short example request narrative: `Photo of chicken rice; rice about 200 g, chicken about 120 g; create a draft, show me the estimate, and wait for confirmation.` State explicitly that estimates do not count until confirmed.

- [ ] **Step 2: Search for contradicted behavior.**

  Run: `rg -n -i "automatic.*food|photo.*save|clubs|leaderboard" README.md docs apps packages -g '!node_modules'`

  Expected: no documentation claims photo-only automatic logging or a still-active clubs feature.

- [ ] **Step 3: Run the repository quality gate.**

  Run: `pnpm test && pnpm build && pnpm lint`

- [ ] **Step 4: Commit documentation.**

  ```powershell
  git add README.md docs
  git commit -m "docs: explain meal draft confirmation"
  ```
