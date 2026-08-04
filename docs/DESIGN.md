# Running Club — Design System

**Direction:** Track chalk / daylight stadium (theme 2)  
**Product:** Personal running log (REST + ChatGPT MCP companion)  
**UI role:** Thin account / goals / history / connect — not a marketing site

## Intent

Morning training energy: bright, honest, outdoor. Data is readable; big numbers feel athletic without dark-mode gym chrome. Brand stays quiet; weekly mileage and pace do the talking.

## Do / Don’t

| Do | Don’t |
|---|---|
| Cool off-white surfaces | Warm cream / terracotta stacks |
| Lane-marker blue as the one accent | Purple / indigo SaaS gradients |
| Sporty condensed type for **stats only** | Condensed type on every label |
| Hairline dividers, airy lists | Card grids and pill clusters |
| Tabular figures for pace/km | Decorative glow / neon |

## Color tokens

Named CSS variables (map into shadcn theme in `apps/web`):

| Token | Hex | Use |
|---|---|---|
| `--rc-paper` | `#F7F8FA` | App background |
| `--rc-surface` | `#FFFFFF` | Panels / inputs |
| `--rc-ink` | `#12151A` | Primary text |
| `--rc-muted` | `#5C6570` | Secondary text |
| `--rc-line` | `#E2E6EC` | Borders / dividers |
| `--rc-lane` | `#1E5EFF` | Primary actions, links, progress |
| `--rc-lane-soft` | `#E8F0FF` | Soft selected / focus wash |
| `--rc-sky` | `#9EC5FF` | Optional secondary accent (charts, idle progress) |
| `--rc-good` | `#0F7A4A` | Success |
| `--rc-bad` | `#C62828` | Errors |

**shadcn mapping (light only for v1):**

- `--background` → `--rc-paper`
- `--foreground` → `--rc-ink`
- `--card` → `--rc-surface`
- `--primary` → `--rc-lane`
- `--primary-foreground` → `#FFFFFF`
- `--muted` → `--rc-lane-soft` (or a neutral grey wash)
- `--muted-foreground` → `--rc-muted`
- `--border` / `--input` → `--rc-line`
- `--ring` → `--rc-lane`
- `--destructive` → `--rc-bad`

No dark theme in v1 unless we explicitly add one later.

## Typography

| Role | Face | Notes |
|---|---|---|
| Display / stats | **Barlow Condensed** (or similar condensed athletic sans) | Week km, pace, big totals only. Weight 600–700. |
| UI / body | **DM Sans** (or Inter only if DM unavailable) | Nav, forms, lists, body copy. |
| Mono / splits | **IBM Plex Mono** (optional) | Pace strings like `5:12 /km` if not using tabular Barlow. |

**Scale (approx):**

- Stat hero: `3rem–4rem` condensed, tight tracking
- Page title: `1.5rem` UI sans
- Section: `1.05rem` medium
- Body / list: `0.925rem`
- Caption / muted: `0.8rem`

Load via Google Fonts or `fontsource` in `apps/web`. Prefer `font-variant-numeric: tabular-nums` on run tables.

## Layout

- Max content width ~720–800px centered (tool, not dashboard wall).
- Header: brand left, text nav right — no mega-menu.
- Home: one weekly progress block → recent runs list. No stat-card strip.
- Forms: single column, calm labels above inputs.
- Radius: `0.375rem–0.5rem` (slightly soft, not pill).
- Spacing: prefer vertical rhythm over boxed sections.

```
┌──────────────────────────────────┐
│ Running Club          Goal Connect│
├──────────────────────────────────┤
│ THIS WEEK                        │
│ 42.3 km          ████████░░ 50km │  ← condensed stats
│                                  │
│ Recent                           │
│ Mon  8.0  42m  5:15   run        │  ← hairline rows
│ …                                │
└──────────────────────────────────┘
```

## Components (shadcn)

Use shadcn as the primitive kit; skin with the tokens above.

**Add first:** `button`, `input`, `label`, `card` (sparingly), `separator`, `badge` (rare), `alert`.

**Rules:**

- Primary button = lane blue; secondary = outline on paper.
- Prefer list + separator over nested cards.
- Progress = simple bar or text ratio in lane blue — not a chart widget yet.
- Errors use `alert` destructive / `--rc-bad` text.

## Motion

Minimal: 150–200ms ease on button/hover/focus. No page-load choreography. Respect `prefers-reduced-motion`.

## Voice / copy

Plain, coach-like, sentence case. Buttons say the action (“Save goal”, “Create account”). Empty states invite one next step (“Log a run from ChatGPT or set a weekly goal”).

## Signature

**Daylight track + lane blue + condensed weekly km.** If you remove the brand wordmark, the first viewport should still feel like a training log in morning light — not a generic SaaS dashboard.

## Implementation notes

- Source of truth for product UI: this file + CSS variables in `apps/web/src/index.css`.
- Component kit: **shadcn/ui** (Radix Nova) in `apps/web` — use `button`, `input`, `label`, `separator`, `alert` first.
- Env stays in repo-root `.env` (Vite `envDir` = monorepo root).
- Fonts: `@fontsource-variable/dm-sans`, `@fontsource/barlow-condensed`.
- When adding screens, check this doc before inventing new colors or radii.
- Full page restyle applied to Layout, Home, Sign in/up, Goal, Connect, Consent using shadcn + Track chalk tokens; mobile header uses a menu toggle under `sm`.
