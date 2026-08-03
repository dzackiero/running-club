# Running Club

Personal running log with a REST API and **remote MCP server** for ChatGPT. Store runs, set weekly goals, and query stats from ChatGPT via OAuth — no pasted API keys.

## Stack

**pnpm monorepo:** `apps/api` (Hono + Better Auth OAuth provider + MCP), `apps/web` (Vite + React), `packages/shared` (Zod schemas). **Postgres** via Drizzle ORM. One API process serves REST, session auth, and the MCP endpoint; the web app talks to REST only.

## Prerequisites

- **Node.js 22+**
- **pnpm 9** (`corepack enable` or install globally)
- **Postgres** (local or remote)

## Setup

### 1. Environment

Copy env templates and adjust values:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
```

**Root `.env`** (API — loaded by `apps/api`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session/JWT secret (min 32 chars) |
| `BETTER_AUTH_URL` | Public API base URL (e.g. `http://localhost:8787`) |
| `WEB_ORIGIN` | Vite dev server origin (e.g. `http://localhost:5173`) |
| `API_PUBLIC_URL` | Public URL for OAuth/MCP metadata (usually same as `BETTER_AUTH_URL`) |

**`apps/web/.env`** (Vite):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL the browser calls (e.g. `http://localhost:8787`) |

### 2. Install and database

```bash
pnpm install
pnpm --filter @running-club/api db:push
```

### 3. Run locally

From the repo root:

```bash
pnpm dev
```

- **API:** http://localhost:8787
- **Web:** http://localhost:5173

Run individually: `pnpm --filter @running-club/api dev` or `pnpm --filter @running-club/web dev`.

### 4. Create an account

Open the web app → sign up at `/sign-up`. Use `/goal` to set a weekly target and `/` to view run history (logged via ChatGPT or REST).

## Connect ChatGPT

Add a **remote MCP server** in ChatGPT (Settings → Connectors / MCP or Developer mode):

```
${API_PUBLIC_URL}/mcp
```

Local default: `http://localhost:8787/mcp`

ChatGPT discovers OAuth via protected-resource metadata and redirects you to sign in (`/sign-in`) and approve access (`/consent`). No personal access token flow in v1.

The web app’s **Connect** page (`/connect`) shows the same URL and steps.

### MCP tools (v1)

| Tool | Description |
|---|---|
| `log_run` | Log a new run |
| `list_runs` | List runs (optional date filters) |
| `get_run` | Get one run by id |
| `update_run` | Update a run |
| `delete_run` | Delete a run |
| `get_weekly_progress` | Progress toward current weekly goal |
| `set_weekly_goal` | Set or replace weekly goal |
| `get_summary` | Aggregated stats for a date range |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run API + web in parallel |
| `pnpm test` | Run tests in all packages |
| `pnpm build` | Build all packages |
| `pnpm --filter @running-club/api db:push` | Push Drizzle schema to Postgres |

## v1 non-goals

Not implemented in v1 (schema may be forward-compatible):

- **Strava** OAuth sync
- **Running clubs** / shared mileage
- **Email** notifications (Resend)
- Deep coaching / stored training plans
- Heavy dashboard UI (ChatGPT is the primary interface)

## Project layout

```
apps/api/          Hono REST + Better Auth + MCP
apps/web/          Vite React UI
packages/shared/   Shared Zod schemas and types
```
