# CUP Run

Personal running log with a REST API and **remote MCP server** for ChatGPT. Store runs, set weekly goals, and query stats from ChatGPT via OAuth — no pasted API keys.

## Stack

**pnpm monorepo:** `apps/api` (Hono + Better Auth OAuth provider + MCP), `apps/web` (Vite + React), `packages/shared` (Zod schemas). **Postgres** via Drizzle ORM. One API process serves REST, session auth, and the MCP endpoint; the web app talks to REST only.

## Prerequisites

- **Node.js 22+**
- **pnpm 9** (`corepack enable` or install globally)
- **Postgres** (local or remote)

## Setup

### 1. Environment

One file at the repo root — API and Vite both read it:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session/JWT secret (min 32 chars) |
| `BETTER_AUTH_URL` | Public API base URL (e.g. `http://localhost:8787`) |
| `WEB_ORIGIN` | Vite dev server origin (e.g. `http://localhost:5173`) |
| `API_PUBLIC_URL` | Public URL for OAuth/MCP metadata (usually same as `BETTER_AUTH_URL`) |
| `VITE_API_URL` | API base URL the browser calls (e.g. `http://localhost:8787`) |
| `GOOGLE_CLIENT_ID` | Optional. Google OAuth client ID for “Continue with Google” |
| `GOOGLE_CLIENT_SECRET` | Optional. Google OAuth client secret |

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

Open the web app → sign up at `/sign-up` (email/password or Google). Use `/goal` to set a weekly target and `/` to view run history (logged via ChatGPT or REST).

### 5. Google sign-in (optional)

Create a Google Cloud **OAuth 2.0 Client ID** (application type **Web application**).

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your project (or create one) → **APIs & Services** → **Credentials**.
2. Configure the **OAuth consent screen** if prompted (External is fine for personal use). App name: `CUP Run`. Add your Google account as a **test user** while the app is in Testing.
3. **Create credentials** → **OAuth client ID** → **Web application**.

Fill in:

| Google field | Local value |
|---|---|
| Name | `CUP Run local` (anything) |
| Authorized JavaScript origins | `http://localhost:5173` and `http://localhost:8787` |
| Authorized redirect URIs | `http://localhost:8787/api/auth/callback/google` |

The redirect URI is the **API** origin, not the Vite origin.

Copy **Client ID** and **Client secret** into root `.env`:

```bash
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

Restart the API (`pnpm dev`). Production: add the same two vars on the API service, plus production origins/redirect:

- JS origins: `https://app.yourdomain.com`, `https://api.yourdomain.com`
- Redirect: `https://api.yourdomain.com/api/auth/callback/google`

(`BETTER_AUTH_URL` must match that API origin.)

## Intervals.icu import

One-way sync: **Intervals.icu → Cup Run**.

1. Create a personal API key in Intervals.icu **Settings → Developer Settings**.
2. In Cup Run open **Connect**, paste the key, and save it (stored encrypted per user).
3. Click **Import now**, or wait — connected accounts sync every **2 hours**.

Runs, walks, trail runs, treadmill/virtual runs, and races from the last 365 days are upserted by Intervals activity id. Strength workouts are skipped.

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
| `pnpm build:api` / `pnpm start:api` | Build / start API (Dokploy Railpack) |
| `pnpm build:web` | Build web SPA (Dokploy Railpack) |
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

## Deploy on Dokploy (Railpack)

Deploy **Postgres**, **API**, and **web** as three services from this repo. Use build type **Railpack**, build path `/`.

### API

| Setting | Value |
|---|---|
| `RAILPACK_CONFIG_FILE` | `railpack.api.json` |
| Domain container port | `8787` |
| Watch paths (optional) | `apps/api/**`, `packages/shared/**` |

Runtime env:

```bash
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=<min 32 chars>
BETTER_AUTH_URL=https://api.yourdomain.com
API_PUBLIC_URL=https://api.yourdomain.com
WEB_ORIGIN=https://app.yourdomain.com
PORT=8787
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

After first deploy, push the schema once (Dokploy shell / one-off):

```bash
pnpm --filter @running-club/api db:push
```

### Web

| Setting | Value |
|---|---|
| `RAILPACK_CONFIG_FILE` | `railpack.web.json` |
| Domain container port | `80` |
| Watch paths (optional) | `apps/web/**`, `packages/shared/**` |

Build-time env (baked into the client; redeploy web if you change it):

```bash
VITE_API_URL=https://api.yourdomain.com
```

Root helpers used by the Railpack configs: `pnpm run build:api`, `pnpm run start:api`, `pnpm run build:web`.

If deploy fails with **JavaScript heap out of memory**, add on the Dokploy app:

```bash
NODE_OPTIONS=--max-old-space-size=4096
```

Ensure the server has enough RAM (4 GB+ recommended for Railpack monorepo builds). Railpack configs install only the workspace package needed per app (`api...` / `web...`).
