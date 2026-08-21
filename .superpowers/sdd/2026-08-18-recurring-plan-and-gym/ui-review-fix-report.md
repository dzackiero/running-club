# UI review fix report

## Implementation commit

`e7017a8a2c4c9ceca894418399afa76bf2c38ad8` — `fix: guard home refreshes and share dashboard contract`

## Files

- `apps/web/src/pages/Home.tsx` — ignores stale refresh completions before they can update dashboard, error, runs, notifications, or loading state.
- `apps/web/src/lib/latest-request.ts` and `apps/web/src/lib/latest-request.test.ts` — request-generation guard and regression coverage.
- `packages/shared/src/plan.ts` and `packages/shared/src/plan.test.ts` — shared plan-record and `TodayDashboard` schemas/types.
- `apps/api/src/services/plans.ts` — uses the shared `TodayDashboard` contract without changing route behavior.
- `apps/web/src/lib/api.ts` and `apps/web/src/lib/api.test.ts` — re-export the shared contract and call the client directly without an unsafe cast.

## Verification

- `pnpm --filter @running-club/shared test`: 6 files, 33 tests passed.
- `pnpm --filter @running-club/shared build`: passed.
- `pnpm --filter @running-club/web test`: 3 files, 8 tests passed.
- `pnpm --filter @running-club/web typecheck`: passed.
- `pnpm --filter @running-club/web build`: passed.
- `pnpm --filter @running-club/web lint`: passed with 3 existing Fast Refresh warnings.
- `pnpm --filter @running-club/api test -- src/services/plans.test.ts src/routes/http.integration.test.ts`: 2 files, 11 tests passed.

## Concerns

- The optional full API typecheck remains blocked by an unrelated pre-existing type error in `apps/api/src/mcp/auth.test.ts:88` involving a Vitest `MockInstance` assignment. Relevant API tests pass.
- The web production build reports the existing large-chunk warning for a 950.54 kB minified JavaScript asset.
