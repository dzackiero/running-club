# Intervals run analysis

**Date:** 2026-08-05  
**Status:** Draft — pending user review  
**Product:** CUP Run  
**Source:** Intervals.icu import → richer `get_run` (web + MCP)

## Problem

Intervals import only keeps watch-summary fields (distance, time, HR, elevation, calories, cadence, RPE, notes). The run page and ChatGPT cannot see load, GAP, HR zones, km splits, the route, or pace/HR over time — data Intervals already has.

## Goals

1. Persist analysis on the `run` row so web and MCP share one record.
2. Show full analysis on run detail for Intervals-imported runs: load / intensity / GAP / HR zones, km splits, route, pace + HR charts.
3. Keep lists cheap: no stream payloads on `list_runs`.
4. Backfill existing Intervals runs on the next sync without blowing the 5k/day API-key budget.

## Non-goals

- Elevation / cadence charts, weather, decoupling, CTL/ATL
- Insights aggregating training load (later)
- Map tiles / Mapbox / Leaflet
- Editing analysis fields in the manual log form
- Stream charts for manual runs (no source data)
- Cloning the full Intervals activity UI

## Decisions

| Choice | Decision |
|---|---|
| Depth | Full analysis: charts + load/intensity/GAP/zones + splits + route |
| Consumers | Web run detail **and** MCP `get_run` |
| Storage | Enrich the `run` record (not a side table, not a raw Intervals dump) |
| Streams | Downsampled ~250 points, stored as jsonb |
| Route | Encoded polyline → SVG scribble (no tile vendor) |

## Data model

Nullable columns on `run`:

| Field | DB | Meaning |
|---|---|---|
| `trainingLoad` | `real` | Intervals `icu_training_load` |
| `intensity` | `real` | Intervals `icu_intensity` as percent (e.g. `78`). If the value is in `0–1`, multiply by 100. |
| `gapPaceSecPerKm` | `real` | Grade-adjusted pace, **sec/km** (same unit as `avgPaceSecPerKm`) |
| `hrZoneSeconds` | `jsonb` | `number[]` — seconds in each HR zone, index order from Intervals |
| `streams` | `jsonb` | Downsampled pace + HR series |

Reuse:

- `splits` — km laps; each item `{ distanceMeters, durationSeconds, avgHeartRate?: number }`
- `polyline` — encoded summary polyline from the activity map

Stream shape:

```ts
{
  t: number[];                 // seconds from start
  pace: number[];              // sec/km, same length as t
  hr: (number | null)[];       // bpm; null when no strap / gap
}
```

Cap at **250 points**, sampled evenly along the time index. Drop leading/trailing zeros and non-finite velocities before computing pace (`1000 / mps`).

Shared Zod (`createRunSchema` / `RunRecord`):

- All new fields optional on write.
- `hrZoneSeconds`: array of non-negative numbers, max length 12.
- `streams`: three arrays, equal length, `t` monotonic non-decreasing, max 250 points.
- Split objects gain optional positive int `avgHeartRate`.

`listRuns` **must not select `streams`** (return `streams: null`). Splits, polyline, and scalar analysis fields may appear on list records. `getRun` returns everything.

Manual `LogRunDialog` does not expose the new fields. MCP `log_run` / `update_run` may set them if a client sends them.

## Sync / import

Extend the Intervals client:

- `listActivities(oldest, newest)` — unchanged
- `getActivity(id)` — `GET /api/v1/activity/{id}?intervals=true`
- `getStreams(id)` — `GET /api/v1/activity/{id}/streams?types=time,distance,heartrate,velocity_smooth`

Import loop per listed activity:

1. Map summary → skip if not a Cup Run type (same as today).
2. Decide whether to enrich (see below).
3. If enriching: fetch activity detail + streams. Detail failure → keep summary-only upsert. Stream failure → upsert detail metrics/splits/polyline, leave `streams` null, log warning. Do not fail the whole user import on one activity.
4. Upsert via `upsertImportedRun`.

**When to enrich** (protects the 2-hour poll):

| Situation | Enrich? |
|---|---|
| New `externalId` | Yes |
| Existing run and `streams` is null | Yes (backfill) |
| Existing run already has streams, and list summary distance / moving time / avg HR unchanged | No — summary-only upsert, omit analysis keys so streams/splits/polyline/load stay |
| Existing run has streams, but those summary fields changed | Yes (Intervals edited the activity) |

Compare summary with integer meters, integer seconds, and integer bpm so float noise does not retrigger enrich.

After the first backfill, steady-state poll is one list call plus detail/stream calls only for new or changed runs.

GAP normalization: Intervals `gap` / `icu_gap` is typically m/s (same family as `average_speed`). Convert with `1000 / mps` when `0 < mps < 20`. If the value already looks like sec/km (`>= 20`), store it directly.

Splits: prefer `icu_intervals` entries that represent distance laps (`type === "LAP"` or ~1 km distance with no WORK/REST label). Map `moving_time` → `durationSeconds`, `average_heartrate` → `avgHeartRate`. If no laps, derive km splits from the distance + time streams.

Polyline: `map.summary_polyline` or equivalent encoded string on the detail payload.

## API + MCP

No new routes or tools.

| Surface | Behavior |
|---|---|
| `GET /runs` | Records without `streams` |
| `GET /runs/:id` | Full record |
| `POST /runs`, `PATCH /runs/:id` | Accept optional analysis fields via shared schema |
| MCP `list_runs` | Same as list; description notes streams are omitted |
| MCP `get_run` | Full record including streams, zones, splits, polyline, load/GAP |
| MCP `get_run` description | Tell the model this is the tool for pace/HR series, zones, and splits |

REST and MCP stay on the same `runs` service.

## Run detail UI

Follow `docs/DESIGN.md`: paper surface, lane-blue accent, condensed stats, hairline sections — not a card grid or Intervals clone.

Only render a block when that data exists. Manual runs stay as they are today.

```
Back                              Edit  Delete

[icon] Run
Sat · 2 Aug 2026 · Intervals

5:12/km          10.2 km         48:12
pace             distance        duration

Load 72     Intensity 78%     GAP 4:55     Avg HR 152

HR zones
[ Z1 ][======== Z2 ========][=== Z3 ===][ Z4 ]
  4m           28m                12m      4m

Route
(SVG path from decoded polyline, lane-blue stroke on paper)

Pace & heart rate
(shared time axis; pace = lane blue; HR = sky/muted)
tooltip: time · pace · bpm

Splits
1   1.00 km   5:12   148 bpm
2   1.00 km   5:08   151 bpm
…

Notes (if any)
Started Saturday …
```

- Hero stays three numbers; pace uses Barlow Condensed.
- Secondary metrics are a hairline row / simple definition list, not boxed `DetailStat` cards.
- Zone bar is a single horizontal stacked bar; labels Z1…Zn by index (skip zero-second zones in the label row if that keeps it readable).
- Route is an inline SVG scribble (decode Google-style polyline). No OSM tiles, no API key. Hide the section when `polyline` is null (treadmill / indoor).
- Chart uses existing `recharts` + `ChartContainer`. One panel, dual series. Omit the HR series (and its axis) when every `hr` value is null. Respect `prefers-reduced-motion`.
- Splits reuse the existing list; show HR when present.

Home list unchanged aside from whatever scalar fields already ride along unused.

## Error handling

- Per-activity Intervals errors: skip enrich for that activity, continue the user import.
- HTTP 429: abort that user’s remaining enrich calls; do **not** mark the integration synced; next poll retries. Log rate-limit headers.
- Corrupt / mismatched stream array lengths: treat streams as missing (`null`), still save scalars/splits/polyline.
- Missing HR: zones and HR chart hidden; pace chart still shown.
- Disconnect Intervals: stored analysis remains on the run.

## Testing

- Mapper: load, intensity, GAP conversion, zones, lap splits, polyline, skip rules.
- Downsample: length cap, equal array lengths, pace from velocity, null HR gaps.
- Import: enrich new runs; skip enrich when streams exist and summary unchanged; backfill when streams null; detail fail → summary upsert; stream fail → metrics without streams.
- `listRuns` response has `streams: null`; `getRun` includes streams.
- Shared Zod: valid/invalid streams and zone arrays; split `avgHeartRate`.
- No new browser E2E required for v1.

## Implementation sketch

1. Shared schema + DB columns (`db:push`).
2. Stream downsample + activity/detail/split mappers + tests.
3. Intervals client `getActivity` / `getStreams`.
4. Import enrich gating + upsert field wiring.
5. `listRuns` column select vs `getRun`.
6. MCP tool descriptions.
7. Run detail UI: metrics row, zone bar, SVG route, pace/HR chart, richer splits.
8. Manual import + poll once locally to backfill.

## Success criteria

- Opening an Intervals run shows pace/HR chart, load/intensity/GAP, HR zones, splits, and route when Intervals provided them.
- `get_run` over MCP returns the same fields so ChatGPT can discuss the workout.
- `list_runs` / home stay fast (no stream blobs).
- Re-import / 2h poll does not re-download streams for unchanged activities.
- Manual runs are visually unchanged.
