# Running Club — Design Spec

**Date:** 2026-08-03  
**Status:** Approved for planning  
**Product focus (v1):** Personal running data layer for ChatGPT (MCP + API), not clubs yet

## Problem

ChatGPT memory is a weak store for training data: fuzzy, lossy, and not queryable. Runners need a durable source of truth that ChatGPT can read and write via MCP, with a real multi-user backend ready for clubs and Strava later.

## Goals (v1)

1. Store running stats (rich schema; sparse manual entry)
2. Review stats and light insights (totals, trends, consistency, goal progress)
3. Expose the same capabilities via REST and MCP
4. Multi-user auth from day one (Better Auth)
5. Personal weekly mileage goals (km and/or duration and/or run count)
6. ChatGPT connects via remote MCP using **OAuth 2.1** (not pasted API keys)

## Non-goals (v1)

- Strava OAuth sync (schema is Strava-ready; sync later)
- Running clubs / shared weekly mileage
- Email notifications via Resend
- Deep AI coaching / stored training plans
- Heavy marketing site or dense dashboard UI

## Approach

**Single Hono app** in a **light pnpm monorepo**:

```
apps/api       → Hono: REST + Better Auth + MCP endpoint
apps/web       → Vite React: auth, goals, history, ChatGPT connect help
packages/shared → Zod schemas / shared types only
```

- One long-running API process (Node or Bun) on a durable host (Fly / Railway / VPS) — not serverless-only
- Postgres as the database
- REST is the source of truth; MCP tools are thin wrappers over the same domain services
- Vite talks only to REST

### Why not Next.js

ChatGPT is the primary UI. The backend’s job is storage, auth, and MCP. Next.js adds App Router/hosting complexity without helping the MCP-first shape. A thin Vite app is enough for account and goal management.

### Why light monorepo (not split services)

Keeps FE/BE and shared types clean without separate MCP deploys. Skip Turborepo/Nx until needed; pnpm workspaces are enough. Keep `packages/shared` thin (schemas/types only).

## Architecture

```
ChatGPT ──OAuth + MCP──► Hono domain services ──► Postgres
Vite    ──session REST──►         ▲
                                  └── shared Zod validation
```

| Concern | Choice |
|---|---|
| API + MCP | Hono (single process) |
| Web | Vite + React |
| Auth | Better Auth (sessions for web; OAuth provider for MCP) |
| DB | Postgres |
| Validation | Zod in `packages/shared` |
| Package manager | pnpm workspaces |

## Data model

### User

- Identity owned by Better Auth (email/password in v1)
- App may add `displayName`, `timezone` (timezone matters for “this week”)

### Run

**Required**

| Field | Notes |
|---|---|
| `userId` | Owner |
| `startedAt` | Start timestamp |
| `distanceMeters` | Store metric; display as km |
| `durationSeconds` | Elapsed time |
| `activityType` | `run` \| `trail` \| `treadmill` \| `race` (extensible) |

**Optional (smartwatch-shaped; all inputtable)**

- Heart rate: `avgHeartRate`, `maxHeartRate`
- `elevationGainMeters`, `calories`, `avgCadence`
- `perceivedEffort` (1–10), `notes`
- `splits` (JSON array)
- GPS: `polyline` (nullable; useful when Strava lands)
- `source`: `manual` \| `strava` \| `import` (v1 mostly `manual`)
- `externalId` (nullable; Strava dedup later)

**Derived (not required on write)**

- Average pace from `distanceMeters` + `durationSeconds`

**Indexes**

- `(userId, startedAt)` for period queries
- Unique `(userId, externalId)` where `externalId` is present

### WeeklyGoal (personal)

- `userId`
- Week boundary: default Monday (`weekStartsOn`; user-configurable later)
- Targets (any combination allowed; nulls for unused):
  - `targetDistanceMeters`
  - `targetDurationSeconds`
  - `targetRunCount`
- `active` boolean — **one active goal per user in v1**

### Insights (computed, not a table in v1)

- Period totals: distance, duration, run count, avg pace
- vs previous period
- Consistency: number of days with a run
- Weekly goal progress when an active goal exists

## REST API

Better Auth mounts at `/api/auth/*`.

Authenticated, user-scoped routes:

| Area | Endpoints |
|---|---|
| Runs | `POST /runs`, `GET /runs`, `GET /runs/:id`, `PATCH /runs/:id`, `DELETE /runs/:id` |
| Goals | `GET /goals/current`, `PUT /goals/current` |
| Insights | `GET /insights/summary?from=&to=`, `GET /insights/week` |

- List filters: `from`, `to`, `activityType`, pagination
- Validation via shared Zod schemas
- Error shape: `{ error: { code, message } }` (+ field details on validation failures)

## MCP

Mounted on the same Hono app (e.g. `/mcp`).

| Tool | Purpose |
|---|---|
| `log_run` | Create run (required + any optionals) |
| `list_runs` | Recent / filtered runs |
| `get_run` | One run by id |
| `update_run` / `delete_run` | Edit / remove |
| `get_weekly_progress` | Goal vs actual this week |
| `set_weekly_goal` | Upsert personal weekly goal |
| `get_summary` | Period totals + light insights |

Tools call the same domain services as REST so behavior cannot drift.

## Auth

### Web (Vite)

- Better Auth email/password
- Session cookies; CORS allowlist for web origin (dev + prod)

### ChatGPT (MCP) — OAuth 2.1

ChatGPT authenticated remote MCP expects OAuth 2.1 (PKCE, protected-resource metadata, bearer access tokens), not pasted personal access tokens.

- Better Auth acts as the **OAuth authorization server** for MCP clients via its MCP / OAuth Provider plugin (prefer current Better Auth recommendation at implementation time: `@better-auth/mcp` or OAuth Provider plugin)
- Expose discovery / protected-resource metadata as required by the MCP auth spec and ChatGPT
- Unauthenticated MCP calls return `401` + challenge metadata so ChatGPT can start the link flow
- User signs in on the Vite login page during the OAuth redirect, then ChatGPT receives a token scoped to that user

### Optional (not required for ChatGPT)

- Personal access tokens for local MCP / scripts / debugging — secondary only

## Web UI (thin)

1. **Auth** — sign up / sign in  
2. **Home / history** — recent runs, week totals  
3. **Goal** — set weekly target(s)  
4. **Connect** — public MCP URL + short “add in ChatGPT → sign in when prompted” instructions  

Day-to-day logging can stay in ChatGPT. No heavy dashboard.

## Ops

- Single Hono deploy + managed Postgres
- Env: database URL, Better Auth secret, web origin, public API/MCP base URL
- No background workers in v1

## Testing

- Unit: run / goal / insight domain logic
- Integration: session auth and OAuth-backed MCP session → create/list runs
- Manual: ChatGPT connect → `log_run` → run visible in Vite

## Future phases

1. **Strava** — OAuth link, activity pull, dedup via `externalId`
2. **Clubs** — membership, shared weekly mileage aggregates
3. **Resend** — email when personal (or club) weekly goal is behind

## Success criteria (v1)

- A user can sign up in the web app, set a weekly goal, and connect ChatGPT via OAuth MCP
- ChatGPT can log a run (required fields + optionals) and retrieve summaries / weekly progress
- The same data is visible in the Vite history view
- Schema accepts rich optional fields without requiring them for every manual log
