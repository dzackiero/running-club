# Task 8 Report: MCP server tools wrapping domain services

## Status

DONE

## What was implemented

### Tool handlers (`apps/api/src/mcp/tools.ts`)
- Exported handlers: `handleLogRun`, `handleListRuns`, `handleGetRun`, `handleUpdateRun`, `handleDeleteRun`, `handleGetWeeklyProgress`, `handleSetWeeklyGoal`, `handleGetSummary`
- Validates with shared Zod schemas (`createRunSchema`, `updateRunSchema`, `upsertWeeklyGoalSchema`, `summaryQuerySchema`) plus local schemas for list/id args
- All handlers call domain services only — no duplicated SQL

### MCP HTTP server (`apps/api/src/mcp/server.ts`)
- `WebStandardStreamableHTTPServerTransport` + `McpServer` (SDK Hono-compatible pattern)
- Stateful sessions via `mcp-session-id`; initialize creates per-user server instance
- `verifyMcpAccessToken` on every `/mcp` request
- Missing/invalid token → `401` + `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="<PRM URL>"`
- PRM URL: `${API_PUBLIC_URL}/.well-known/oauth-protected-resource/mcp`

### App mount (`apps/api/src/app.ts`)
- `app.all("/mcp", …)` mounted before session middleware (OAuth Bearer, not cookie session)
- CORS extended for MCP headers (`mcp-session-id`, `mcp-protocol-version`, `Last-Event-ID`)

## Tools registered

| Tool | Service |
|------|---------|
| `log_run` | `createRun` |
| `list_runs` | `listRuns` |
| `get_run` | `getRun` |
| `update_run` | `updateRun` |
| `delete_run` | `deleteRun` |
| `get_weekly_progress` | `getWeekProgress` |
| `set_weekly_goal` | `upsertCurrentGoal` |
| `get_summary` | `getSummary` |

## Test summary

| Test | Result |
|------|--------|
| `pnpm --filter @running-club/api test` | 31/31 passed |

`apps/api/src/mcp/server.test.ts`:
- Tool handlers with stubbed `userId` (CRUD + goals + insights + validation error)
- HTTP 401 + WWW-Authenticate challenge on unauthenticated `/mcp` POST

## Commit

```
feat(api): expose running tools over MCP
```

## Concerns / follow-ups

1. **Manual OAuth + MCP Inspector** — not run in this task; Task 7 report has curl/Inspector steps to validate end-to-end ChatGPT connect.
2. **In-memory sessions** — session map is process-local; multi-instance deploy needs sticky sessions or external session store.
3. **Session cleanup** — `onsessionclosed` closes server/transport; long-lived SSE connections may hold memory until client disconnects.

## Review fixes

Addressed Task 8 review findings:

1. **P1** Exported `upsertWeeklyGoalObjectSchema` from shared; MCP `set_weekly_goal` uses `.shape` from that object schema. Handler still validates with refined `upsertWeeklyGoalSchema.parse()`.
2. **P2** Removed unused `updateRunSchema` import from `mcp/server.ts`.
3. **P2** Narrowed MCP tool result text content in `server.test.ts` via `textContent()` helper so `tsc` passes.
4. **Build** Replaced jose `KeyLike` with `CryptoKey` in `auth.test.ts` (jose v6 typing).

Verify: `pnpm --filter @running-club/api test` → 31/31; `pnpm --filter @running-club/api build` → pass.

```
fix(api): expose weekly goal MCP input schema and fix tsc
```
