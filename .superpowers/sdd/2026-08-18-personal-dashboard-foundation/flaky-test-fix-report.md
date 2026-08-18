# Flaky test fix report

## Root cause

`get_weekly_progress includes totals and goal` reused runs dated `2026-08-03`, but the MCP handler calls `getWeekProgress(userId)` with the current time. On `2026-08-18`, those runs are outside the current UTC week, so `progress.totals.runCount` was `0`.

## Fix

Added a test-only `handleLogRun` fixture inside the weekly-progress test with `startedAt: new Date().toISOString()`. Production code and static summary fixtures were not changed.

## Verification

- Before: `pnpm --filter @running-club/api test -- src/mcp/server.test.ts` failed with 1 failed test; `expected 0 to be greater than or equal to 1` at `server.test.ts:117`.
- After: the focused command passed: 1 test file, 12 tests passed.
- Full suite: `pnpm test` passed: API 21 files / 107 tests, web 1 file / 5 tests, shared 4 files / 20 tests.

## Concerns

The fixture uses the runtime timestamp because the handler intentionally has no injectable clock. A test crossing a week boundary between insert and query is theoretically possible, though unlikely; no production behavior was altered.
