# Task 5 Report: Weekly goals service + REST (TDD)

## Status

DONE

## What was implemented

### Service (`apps/api/src/services/goals.ts`)
- `getCurrentGoal(userId)` — returns active `WeeklyGoalRecord` or null
- `upsertCurrentGoal(userId, input)` — deactivates prior active goals, inserts new active goal
- `WeeklyGoalRecord` with ISO string timestamps

### Routes (`apps/api/src/routes/goals.ts`)
- `GET /goals/current` → current active goal (null if none)
- `PUT /goals/current` → upsert with `upsertWeeklyGoalSchema` validation
- Zod validation errors → 400 `VALIDATION_ERROR`

### App (`apps/api/src/app.ts`)
- Mounted `/goals` with `requireUser` middleware

## TDD cycle

1. **RED** — `goals.test.ts` added; test failed: module `./goals` not found
2. **GREEN** — service + routes implemented; 8/8 tests pass
3. **Build** — `pnpm --filter @running-club/api build` exit 0

## Test summary

| Suite | Result |
|-------|--------|
| `goals.test.ts` | 1/1 passed (upsert replaces previous active goal) |
| `runs.test.ts` | 3/3 passed |
| `pace.test.ts` | 2/2 passed |
| `auth.integration.test.ts` | 2/2 passed |
| **Total** | **8/8 passed** |

Tests use real Postgres; `afterAll` deletes rows for `user_test_goals_1`.

## Commit

```
feat(api): add personal weekly goals API
```

## Files changed

| Path | Action |
|------|--------|
| `apps/api/src/services/goals.ts` | Created |
| `apps/api/src/services/goals.test.ts` | Created |
| `apps/api/src/routes/goals.ts` | Created |
| `apps/api/src/app.ts` | Modified (mount `/goals`) |

## Self-review

- Service has no HTTP/Hono imports; routes are thin (parse → service → jsonError/status)
- One-active-goal invariant enforced in `upsertCurrentGoal` via deactivate-then-insert
- Matches runs pattern (`services/`, `routes/`, `app.ts` mount, `requireUser`)
- Uses shared `upsertWeeklyGoalSchema` for validation

## Concerns

1. **No route integration tests** — only service-layer test; REST behavior verified by code review
2. **No DB unique constraint** — one-active-goal relies on application logic; race under concurrent upserts possible
3. **GET returns null body** — `GET /goals/current` returns JSON `null` when no goal; clients must handle null vs 404

## Review fix: transactional upsert

### Finding
Wrap `upsertCurrentGoal` deactivate + insert in a DB transaction so failure after deactivate cannot leave zero active goals, and concurrent risk is reduced.

### Fix
- `upsertCurrentGoal` now uses `db.transaction(async (tx) => { ... })` for deactivate-then-insert
- Test strengthened: after upsert, asserts exactly one active goal for the user and that the first goal row is inactive

### Test output

```
pnpm --filter @running-club/api test

 ✓ src/lib/pace.test.ts (2 tests)
 ✓ src/services/goals.test.ts (1 test)
 ✓ src/services/runs.test.ts (3 tests)
 ✓ src/auth/auth.integration.test.ts (2 tests)

 Test Files  4 passed (4)
      Tests  8 passed (8)
```

### Commit

```
fix(api): make weekly goal upsert transactional
```
