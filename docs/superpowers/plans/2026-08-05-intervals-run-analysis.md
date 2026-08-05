# Intervals Run Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Intervals load / intensity / GAP / HR zones / km splits / polyline / downsampled pace+HR streams on each run, show them on run detail, and return them from MCP `get_run`.

**Architecture:** Enrich the existing `run` row (no side table). Import lists activities, then fetches `GET /activity/{id}?intervals=true` and streams only when the run is new, missing streams, or summary distance/time/HR changed. `listRuns` omits `streams`; `getRun` returns the full record. Web run detail renders hairline analysis blocks only when data exists.

**Tech Stack:** TypeScript, pnpm workspaces, Zod, Drizzle/Postgres, Vitest, Hono, Vite React, recharts

**Spec:** `docs/superpowers/specs/2026-08-05-intervals-run-analysis-design.md`

## Global Constraints

- Follow `docs/DESIGN.md`: paper + lane blue, condensed stats only, hairline sections, no card-grid dashboard, no “MCP” copy
- `packages/shared` stays schemas/types only (no decode/downsample helpers there)
- Do not add analysis fields to `LogRunDialog`
- Do not add map tiles / Leaflet / Mapbox
- Do not re-fetch streams on every 2h poll when summary is unchanged
- `list_runs` / `GET /runs` must return `streams: null`
- Intervals 429 aborts remaining enrich for that user and must not mark the integration synced
- Manual runs stay visually unchanged when analysis fields are null

---

## File structure

```
packages/shared/src/run.ts                         # Zod + RunRecord analysis fields
packages/shared/src/run.test.ts

apps/api/src/db/schema.ts                          # new run columns
apps/api/src/services/runs.ts                      # persist, list omits streams
apps/api/src/services/runs.test.ts
apps/api/src/integrations/intervals/metrics.ts     # intensity + GAP helpers
apps/api/src/integrations/intervals/metrics.test.ts
apps/api/src/integrations/intervals/map-streams.ts
apps/api/src/integrations/intervals/map-streams.test.ts
apps/api/src/integrations/intervals/map-splits.ts
apps/api/src/integrations/intervals/map-splits.test.ts
apps/api/src/integrations/intervals/map-activity.ts
apps/api/src/integrations/intervals/map-activity.test.ts
apps/api/src/integrations/intervals/client.ts      # getActivity, getStreams, status errors
apps/api/src/integrations/intervals/errors.ts      # IntervalsHttpError
apps/api/src/services/intervals-import.ts          # enrich gating
apps/api/src/services/intervals-import.test.ts
apps/api/src/mcp/server.ts                         # tool descriptions
apps/api/src/mcp/server.test.ts                    # list omits streams / get includes

apps/web/src/lib/polyline.ts                       # decode encoded polyline
apps/web/src/components/HrZoneBar.tsx
apps/web/src/components/RunRouteScribble.tsx
apps/web/src/components/RunStreamsChart.tsx
apps/web/src/pages/RunDetail.tsx
```

---

### Task 1: Shared run analysis schema

**Files:**
- Modify: `packages/shared/src/run.ts`
- Modify: `packages/shared/src/run.test.ts`

**Interfaces:**
- Consumes: existing `createRunSchema`
- Produces:

```ts
export type RunStreams = {
  t: number[];
  pace: number[];
  hr: (number | null)[];
};

export type RunSplit = {
  distanceMeters: number;
  durationSeconds: number;
  avgHeartRate?: number;
};

// createRunSchema optional fields:
// trainingLoad?: number
// intensity?: number
// gapPaceSecPerKm?: number
// hrZoneSeconds?: number[]
// streams?: RunStreams
// splits[].avgHeartRate?: number

// RunRecord adds:
// trainingLoad: number | null
// intensity: number | null
// gapPaceSecPerKm: number | null
// hrZoneSeconds: number[] | null
// streams: RunStreams | null
// splits: RunSplit[] | null
```

- [ ] **Step 1: Write the failing tests**

Append to `packages/shared/src/run.test.ts`:

```ts
  it("accepts analysis fields and split heart rate", () => {
    const parsed = createRunSchema.parse({
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1800,
      activityType: "run",
      trainingLoad: 72,
      intensity: 78,
      gapPaceSecPerKm: 295,
      hrZoneSeconds: [60, 900, 600, 240, 0],
      streams: {
        t: [0, 60, 120],
        pace: [300, 295, 290],
        hr: [140, 145, null],
      },
      splits: [
        { distanceMeters: 1000, durationSeconds: 300, avgHeartRate: 148 },
      ],
    });
    expect(parsed.trainingLoad).toBe(72);
    expect(parsed.streams?.hr).toEqual([140, 145, null]);
    expect(parsed.splits?.[0]?.avgHeartRate).toBe(148);
  });

  it("rejects mismatched stream array lengths", () => {
    expect(() =>
      createRunSchema.parse({
        startedAt: "2026-08-03T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1800,
        activityType: "run",
        streams: { t: [0, 60], pace: [300], hr: [140, 145] },
      }),
    ).toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @running-club/shared test -- src/run.test.ts`

Expected: FAIL — `trainingLoad` / `streams` unknown or splits reject `avgHeartRate`

- [ ] **Step 3: Implement schema**

In `packages/shared/src/run.ts`, add helpers above `createRunSchema`:

```ts
export const runStreamsSchema = z
  .object({
    t: z.array(z.number()).max(250),
    pace: z.array(z.number()).max(250),
    hr: z.array(z.number().nullable()).max(250),
  })
  .refine(
    (value) =>
      value.t.length === value.pace.length &&
      value.t.length === value.hr.length,
    { message: "stream arrays must be the same length" },
  );

export type RunStreams = z.infer<typeof runStreamsSchema>;

export const runSplitSchema = z.object({
  distanceMeters: z.number().positive(),
  durationSeconds: z.number().int().positive(),
  avgHeartRate: z.number().int().positive().optional(),
});
```

Replace `splits` / add fields on `createRunSchema`:

```ts
  splits: z.array(runSplitSchema).optional(),
  polyline: z.string().optional(),
  trainingLoad: z.number().nonnegative().optional(),
  intensity: z.number().nonnegative().optional(),
  gapPaceSecPerKm: z.number().positive().optional(),
  hrZoneSeconds: z.array(z.number().nonnegative()).max(12).optional(),
  streams: runStreamsSchema.optional(),
```

Extend `RunRecord`:

```ts
  splits: z.infer<typeof runSplitSchema>[] | null;
  polyline: string | null;
  trainingLoad: number | null;
  intensity: number | null;
  gapPaceSecPerKm: number | null;
  hrZoneSeconds: number[] | null;
  streams: RunStreams | null;
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @running-club/shared test -- src/run.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/run.ts packages/shared/src/run.test.ts
git commit -m "Add run analysis fields to shared schema."
```

---

### Task 2: Persist analysis on run rows

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/services/runs.ts`
- Modify: `apps/api/src/services/runs.test.ts`

**Interfaces:**
- Consumes: `CreateRunInput` analysis fields from Task 1
- Produces: `createRun` / `updateRun` persist new columns; `getRun` returns them; `listRuns` always sets `streams: null`; `findRunByExternalId(userId, externalId)` returns `{ id, distanceMeters, durationSeconds, avgHeartRate, streams }` or `null`

- [ ] **Step 1: Write the failing service test**

Add to `apps/api/src/services/runs.test.ts`:

```ts
  it("stores analysis on getRun and omits streams from listRuns", async () => {
    const created = await createRun(userId, {
      startedAt: "2026-08-03T09:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
      trainingLoad: 70,
      intensity: 80,
      gapPaceSecPerKm: 290,
      hrZoneSeconds: [0, 600, 900],
      streams: {
        t: [0, 60],
        pace: [300, 295],
        hr: [140, 150],
      },
      splits: [{ distanceMeters: 1000, durationSeconds: 300, avgHeartRate: 144 }],
      polyline: "_p~iF~ps|U_ulLnnqC",
    });

    const fetched = await getRun(userId, created.id);
    expect(fetched?.trainingLoad).toBe(70);
    expect(fetched?.streams?.t).toEqual([0, 60]);
    expect(fetched?.splits?.[0]?.avgHeartRate).toBe(144);

    const listed = await listRuns(userId, { limit: 50 });
    const row = listed.find((run) => run.id === created.id);
    expect(row?.trainingLoad).toBe(70);
    expect(row?.streams).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @running-club/api test -- src/services/runs.test.ts`

Expected: FAIL (columns / mapping missing)

- [ ] **Step 3: Add columns and wire the service**

In `apps/api/src/db/schema.ts` `run` table, after `polyline`:

```ts
    trainingLoad: real("training_load"),
    intensity: real("intensity"),
    gapPaceSecPerKm: real("gap_pace_sec_per_km"),
    hrZoneSeconds: jsonb("hr_zone_seconds"),
    streams: jsonb("streams"),
```

Update `toRunRecord`:

```ts
    splits: row.splits as RunRecord["splits"],
    polyline: row.polyline,
    trainingLoad: row.trainingLoad,
    intensity: row.intensity,
    gapPaceSecPerKm: row.gapPaceSecPerKm,
    hrZoneSeconds: (row.hrZoneSeconds as RunRecord["hrZoneSeconds"]) ?? null,
    streams: (row.streams as RunRecord["streams"]) ?? null,
```

Pass the new fields through `createRun` `.values(...)` and `updateRun` (only when `!== undefined`).

Change `listRuns` to select every `run` column **except** `streams`, then map with `toRunRecord({ ...row, streams: null })`.

Add:

```ts
export async function findRunByExternalId(
  userId: string,
  externalId: string,
): Promise<Pick<
  RunRecord,
  "id" | "distanceMeters" | "durationSeconds" | "avgHeartRate" | "streams"
> | null> {
  const [row] = await db
    .select({
      id: run.id,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.durationSeconds,
      avgHeartRate: run.avgHeartRate,
      streams: run.streams,
    })
    .from(run)
    .where(and(eq(run.userId, userId), eq(run.externalId, externalId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    distanceMeters: row.distanceMeters,
    durationSeconds: row.durationSeconds,
    avgHeartRate: row.avgHeartRate,
    streams: (row.streams as RunRecord["streams"]) ?? null,
  };
}
```

- [ ] **Step 4: Push schema and run tests**

Run:

```bash
pnpm --filter @running-club/api db:push
pnpm --filter @running-club/api test -- src/services/runs.test.ts
```

Expected: PASS (db:push applies `training_load`, `intensity`, `gap_pace_sec_per_km`, `hr_zone_seconds`, `streams`)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/runs.ts apps/api/src/services/runs.test.ts
git commit -m "Persist run analysis fields and keep lists stream-free."
```

---

### Task 3: Metrics, stream downsample, and split mappers

**Files:**
- Create: `apps/api/src/integrations/intervals/metrics.ts`
- Create: `apps/api/src/integrations/intervals/metrics.test.ts`
- Create: `apps/api/src/integrations/intervals/map-streams.ts`
- Create: `apps/api/src/integrations/intervals/map-streams.test.ts`
- Create: `apps/api/src/integrations/intervals/map-splits.ts`
- Create: `apps/api/src/integrations/intervals/map-splits.test.ts`

**Interfaces:**
- Consumes: nothing from DB
- Produces:

```ts
export function normalizeIntensity(value: number | null | undefined): number | undefined;
export function gapToPaceSecPerKm(gap: number | null | undefined): number | undefined;

export type IntervalsStream = { type?: string; data?: Array<number | null> };

export function downsampleIntervalsStreams(
  streams: IntervalsStream[],
  maxPoints?: number, // default 250
): { t: number[]; pace: number[]; hr: (number | null)[] } | undefined;

export type IntervalsLap = {
  type?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  average_heartrate?: number | null;
};

export function mapIntervalsLapsToSplits(
  laps: IntervalsLap[],
): Array<{ distanceMeters: number; durationSeconds: number; avgHeartRate?: number }>;

export function splitsFromDistanceStream(
  time: number[],
  distance: number[],
  hr?: Array<number | null>,
): Array<{ distanceMeters: number; durationSeconds: number; avgHeartRate?: number }>;
```

- [ ] **Step 1: Write failing tests**

`metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gapToPaceSecPerKm, normalizeIntensity } from "./metrics";

describe("normalizeIntensity", () => {
  it("passes through percents and scales 0–1 values", () => {
    expect(normalizeIntensity(78)).toBe(78);
    expect(normalizeIntensity(0.78)).toBe(78);
    expect(normalizeIntensity(0)).toBe(0);
    expect(normalizeIntensity(null)).toBeUndefined();
  });
});

describe("gapToPaceSecPerKm", () => {
  it("converts m/s and keeps sec/km", () => {
    expect(gapToPaceSecPerKm(3.333333)).toBeCloseTo(300, 0);
    expect(gapToPaceSecPerKm(295)).toBe(295);
    expect(gapToPaceSecPerKm(0)).toBeUndefined();
  });
});
```

`map-streams.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { downsampleIntervalsStreams } from "./map-streams";

describe("downsampleIntervalsStreams", () => {
  it("builds equal-length pace and hr series and caps length", () => {
    const time = Array.from({ length: 500 }, (_, i) => i);
    const velocity = time.map(() => 3.333);
    const hr = time.map((t) => (t % 10 === 0 ? null : 150));
    const streams = downsampleIntervalsStreams(
      [
        { type: "time", data: time },
        { type: "velocity_smooth", data: velocity },
        { type: "heartrate", data: hr },
      ],
      250,
    );
    expect(streams?.t).toHaveLength(250);
    expect(streams?.pace).toHaveLength(250);
    expect(streams?.hr).toHaveLength(250);
    expect(streams?.pace[0]).toBeCloseTo(300, 0);
    expect(streams?.hr[0]).toBeNull();
  });

  it("returns undefined when time or velocity is missing", () => {
    expect(
      downsampleIntervalsStreams([{ type: "heartrate", data: [140] }]),
    ).toBeUndefined();
  });
});
```

`map-splits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapIntervalsLapsToSplits, splitsFromDistanceStream } from "./map-splits";

describe("mapIntervalsLapsToSplits", () => {
  it("keeps LAP rows and skips WORK/REST", () => {
    expect(
      mapIntervalsLapsToSplits([
        {
          type: "LAP",
          distance: 1000,
          moving_time: 300,
          average_heartrate: 148,
        },
        { type: "WORK", distance: 400, moving_time: 90 },
        { type: "REST", distance: 50, moving_time: 60 },
      ]),
    ).toEqual([
      { distanceMeters: 1000, durationSeconds: 300, avgHeartRate: 148 },
    ]);
  });

  it("treats unlabeled ~1km rows as laps", () => {
    expect(
      mapIntervalsLapsToSplits([
        { type: null, distance: 1002, moving_time: 310, average_heartrate: 150 },
      ]),
    ).toEqual([
      { distanceMeters: 1002, durationSeconds: 310, avgHeartRate: 150 },
    ]);
  });
});

describe("splitsFromDistanceStream", () => {
  it("cuts a split each kilometer", () => {
    const time = [0, 150, 300, 450];
    const distance = [0, 500, 1000, 1500];
    const hr = [140, 142, 145, 148];
    const splits = splitsFromDistanceStream(time, distance, hr);
    expect(splits[0]?.distanceMeters).toBeCloseTo(1000, 0);
    expect(splits[0]?.durationSeconds).toBe(300);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @running-club/api test -- src/integrations/intervals/metrics.test.ts src/integrations/intervals/map-streams.test.ts src/integrations/intervals/map-splits.test.ts`

Expected: FAIL (modules missing)

- [ ] **Step 3: Implement mappers**

`metrics.ts`:

```ts
export function normalizeIntensity(
  value: number | null | undefined,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  if (value > 0 && value <= 1) return Math.round(value * 1000) / 10;
  return value;
}

export function gapToPaceSecPerKm(
  gap: number | null | undefined,
): number | undefined {
  if (typeof gap !== "number" || !Number.isFinite(gap) || gap <= 0) {
    return undefined;
  }
  if (gap < 20) return 1000 / gap;
  return gap;
}
```

`map-streams.ts`: pick `time` + `velocity_smooth` (fallback `velocity`) + optional `heartrate` / `distance`. Sample indices `0 … n-1` inclusive with `maxPoints`. Pace = `1000 / mps` when `mps > 0`; otherwise skip that sample (do not insert `Infinity`). If after filtering there are no points, return `undefined`.

`map-splits.ts`:

- `mapIntervalsLapsToSplits`: keep row if `type` uppercased is `LAP`, or `type` is empty and distance is between 800 and 1200 inclusive, or type is empty and distance `> 200`. Skip `WORK` / `REST` / `RECOVERY`. Duration from `moving_time` else `elapsed_time`, rounded int `> 0`. Distance must be `> 0`.
- `splitsFromDistanceStream`: walk distance; each time cumulative distance crosses the next km boundary, emit a split for that km using interpolated time; last partial km only if `>= 200m`. Average HR over samples inside the split when present.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @running-club/api test -- src/integrations/intervals/metrics.test.ts src/integrations/intervals/map-streams.test.ts src/integrations/intervals/map-splits.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/integrations/intervals/metrics.ts apps/api/src/integrations/intervals/metrics.test.ts apps/api/src/integrations/intervals/map-streams.ts apps/api/src/integrations/intervals/map-streams.test.ts apps/api/src/integrations/intervals/map-splits.ts apps/api/src/integrations/intervals/map-splits.test.ts
git commit -m "Add Intervals metrics, stream, and split mappers."
```

---

### Task 4: Map Intervals detail payloads onto create-run input

**Files:**
- Modify: `apps/api/src/integrations/intervals/map-activity.ts`
- Modify: `apps/api/src/integrations/intervals/map-activity.test.ts`

**Interfaces:**
- Consumes: `normalizeIntensity`, `gapToPaceSecPerKm`, `mapIntervalsLapsToSplits`, `splitsFromDistanceStream`, `downsampleIntervalsStreams`
- Produces:

```ts
export type IntervalsActivity = {
  // existing fields, plus:
  icu_training_load?: number | null;
  icu_intensity?: number | null;
  gap?: number | null;
  icu_gap?: number | null;
  icu_hr_zone_times?: number[] | null;
  hr_zone_times?: number[] | null;
  map?: { summary_polyline?: string | null } | null;
  icu_intervals?: IntervalsLap[] | null;
};

export function mapIntervalsActivityToRun(activity: IntervalsActivity): CreateRunInput | null;
// now also sets trainingLoad, intensity, gapPaceSecPerKm, hrZoneSeconds, splits, polyline when present
```

- [ ] **Step 1: Extend mapper tests**

Add to `map-activity.test.ts`:

```ts
  it("maps load, intensity, gap, zones, laps, and polyline", () => {
    const mapped = mapIntervalsActivityToRun({
      ...baseRun,
      icu_training_load: 72,
      icu_intensity: 0.8,
      gap: 3.333,
      icu_hr_zone_times: [30, 600, 400],
      map: { summary_polyline: "_p~iF~ps|U_ulLnnqC" },
      icu_intervals: [
        {
          type: "LAP",
          distance: 1000,
          moving_time: 300,
          average_heartrate: 149,
        },
      ],
    });
    expect(mapped?.trainingLoad).toBe(72);
    expect(mapped?.intensity).toBe(80);
    expect(mapped?.gapPaceSecPerKm).toBeCloseTo(300, 0);
    expect(mapped?.hrZoneSeconds).toEqual([30, 600, 400]);
    expect(mapped?.polyline).toBe("_p~iF~ps|U_ulLnnqC");
    expect(mapped?.splits).toEqual([
      { distanceMeters: 1000, durationSeconds: 300, avgHeartRate: 149 },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @running-club/api test -- src/integrations/intervals/map-activity.test.ts`

Expected: FAIL on new fields

- [ ] **Step 3: Implement mapping**

Extend `IntervalsActivity`. After building the existing return object, attach:

```ts
    ...(normalizeIntensity(activity.icu_intensity) != null
      ? { intensity: normalizeIntensity(activity.icu_intensity) }
      : {}),
    ...(positiveNumber(activity.icu_training_load) != null ||
    activity.icu_training_load === 0
      ? { trainingLoad: nonNegativeNumber(activity.icu_training_load) }
      : {}),
    ...(gapToPaceSecPerKm(activity.icu_gap ?? activity.gap) != null
      ? { gapPaceSecPerKm: gapToPaceSecPerKm(activity.icu_gap ?? activity.gap) }
      : {}),
```

Zones: first non-empty array among `icu_hr_zone_times`, `hr_zone_times`.

Splits: `mapIntervalsLapsToSplits(activity.icu_intervals ?? [])`; if empty, omit (import will fill from streams later).

Polyline: `activity.map?.summary_polyline?.trim()` if non-empty.

Keep `trainingLoad: 0` allowed via `nonNegativeNumber`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @running-club/api test -- src/integrations/intervals/map-activity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/integrations/intervals/map-activity.ts apps/api/src/integrations/intervals/map-activity.test.ts
git commit -m "Map Intervals detail metrics onto run input."
```

---

### Task 5: Intervals client + enriching import

**Files:**
- Create: `apps/api/src/integrations/intervals/errors.ts`
- Modify: `apps/api/src/integrations/intervals/client.ts`
- Modify: `apps/api/src/services/intervals-import.ts`
- Modify: `apps/api/src/services/intervals-import.test.ts`

**Interfaces:**
- Consumes: `findRunByExternalId`, mappers from Tasks 3–4
- Produces:

```ts
export class IntervalsHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string);
}

export function createIntervalsClient(apiKey: string): {
  listActivities(oldest: string, newest: string): Promise<IntervalsActivity[]>;
  getActivity(id: string): Promise<IntervalsActivity>;
  getStreams(id: string): Promise<IntervalsStream[]>;
};

export type IntervalsImportClient = {
  listActivities(oldest: string, newest: string): Promise<IntervalsActivity[]>;
  getActivity?(id: string): Promise<IntervalsActivity>;
  getStreams?(id: string): Promise<IntervalsStream[]>;
};

export function shouldEnrichIntervalsRun(
  existing: {
    streams: unknown;
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate: number | null;
  } | null,
  incoming: {
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate?: number;
  },
): boolean;
```

- [ ] **Step 1: Write failing import tests**

Replace/extend `intervals-import.test.ts` with a richer mock client. Keep the existing summary import test working by making `getActivity` / `getStreams` optional — if omitted, behave like today.

Add tests:

```ts
  it("enriches new runs with detail and streams", async () => {
    const result = await importFromIntervals(userId, {
      listActivities: async () => [
        {
          id: "i-enrich-1",
          type: "Run",
          name: "Tracked",
          start_date: "2026-07-03T00:00:00Z",
          distance: 5000,
          moving_time: 1500,
          average_heartrate: 150,
        },
      ],
      getActivity: async () => ({
        id: "i-enrich-1",
        type: "Run",
        name: "Tracked",
        start_date: "2026-07-03T00:00:00Z",
        distance: 5000,
        moving_time: 1500,
        average_heartrate: 150,
        icu_training_load: 65,
        icu_intensity: 75,
        gap: 3.2,
        icu_hr_zone_times: [100, 800, 600],
        map: { summary_polyline: "abc" },
        icu_intervals: [
          { type: "LAP", distance: 1000, moving_time: 300, average_heartrate: 148 },
        ],
      }),
      getStreams: async () => [
        { type: "time", data: [0, 60, 120] },
        { type: "velocity_smooth", data: [3.3, 3.3, 3.3] },
        { type: "heartrate", data: [140, 145, 150] },
      ],
    });
    expect(result).toEqual({ imported: 1, updated: 0, skipped: 0 });
    const run = (await listRuns(userId, {})).find((r) => r.externalId === "i-enrich-1");
    expect(run?.trainingLoad).toBe(65);
    expect(run?.polyline).toBe("abc");
    const full = await getRun(userId, run!.id);
    expect(full?.streams?.t.length).toBeGreaterThan(0);
  });

  it("skips stream refetch when summary is unchanged", async () => {
    let streamCalls = 0;
    const listItem = {
      id: "i-enrich-2",
      type: "Run",
      name: "Stable",
      start_date: "2026-07-04T00:00:00Z",
      distance: 4000,
      moving_time: 1200,
      average_heartrate: 140,
    };
    const client = {
      listActivities: async () => [listItem],
      getActivity: async () => ({
        ...listItem,
        icu_training_load: 40,
        icu_intervals: [
          { type: "LAP", distance: 1000, moving_time: 300, average_heartrate: 140 },
        ],
      }),
      getStreams: async () => {
        streamCalls += 1;
        return [
          { type: "time", data: [0, 30] },
          { type: "velocity_smooth", data: [3.3, 3.3] },
          { type: "heartrate", data: [140, 141] },
        ];
      },
    };
    await importFromIntervals(userId, client);
    await importFromIntervals(userId, client);
    expect(streamCalls).toBe(1);
  });

  it("rethrows 429 so sync is not marked complete", async () => {
    await expect(
      importFromIntervals(userId, {
        listActivities: async () => [
          {
            id: "i-429",
            type: "Run",
            name: "Limited",
            start_date: "2026-07-05T00:00:00Z",
            distance: 3000,
            moving_time: 900,
          },
        ],
        getActivity: async () => {
          throw new IntervalsHttpError(429, "rate limited");
        },
      }),
    ).rejects.toMatchObject({ status: 429 });
  });
```

Import `getRun` and `IntervalsHttpError` in the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @running-club/api test -- src/services/intervals-import.test.ts`

Expected: FAIL (client/import do not enrich)

- [ ] **Step 3: Implement error type, client methods, gating, import loop**

`errors.ts`:

```ts
export class IntervalsHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "IntervalsHttpError";
    this.status = status;
  }
}
```

In `client.ts`, share one `request(url)` helper that throws `IntervalsHttpError` with `res.status` when `!res.ok`. Add:

- `getActivity(id)` → `GET ${INTERVALS_API_BASE}/activity/${id}?intervals=true`
- `getStreams(id)` → `GET ${INTERVALS_API_BASE}/activity/${id}/streams?types=time,distance,heartrate,velocity_smooth`

Normalize streams JSON: if the payload is an object map, convert to `{ type, data }[]`.

`shouldEnrichIntervalsRun` in `intervals-import.ts` (export for tests if useful):

```ts
export function shouldEnrichIntervalsRun(existing, incoming): boolean {
  if (!existing) return true;
  if (existing.streams == null) return true;
  return (
    Math.round(existing.distanceMeters) !== Math.round(incoming.distanceMeters) ||
    existing.durationSeconds !== incoming.durationSeconds ||
    (existing.avgHeartRate ?? null) !== (incoming.avgHeartRate ?? null)
  );
}
```

Import loop:

1. `mapped = mapIntervalsActivityToRun(activity)` — skip if null / no externalId
2. `existing = await findRunByExternalId(userId, mapped.externalId)`
3. If `shouldEnrich` and `client.getActivity`:
   - `try { detail = await getActivity; detailed = mapIntervalsActivityToRun(detail) ?? mapped }`
   - on `IntervalsHttpError` with `status === 429`, rethrow
   - on other errors, log and keep `mapped`
4. If enriching and `client.getStreams`:
   - `try { streams = downsampleIntervalsStreams(await getStreams(id)) }`
   - 429 rethrow; other errors log
   - if streams defined, set `detailed.streams`
   - if `!detailed.splits?.length`, derive splits from time+distance streams via `splitsFromDistanceStream` (get distance stream from the same payload; if downsample dropped distance, call `splitsFromDistanceStream` on raw stream arrays before downsample)
5. `upsertImportedRun` with the object. When **not** enriching, upsert summary-only `mapped` **without** `trainingLoad`, `intensity`, `gapPaceSecPerKm`, `hrZoneSeconds`, `splits`, `polyline`, `streams` keys so `updateRun` leaves them untouched. Easiest: build summary mapping that never includes those keys (today’s mapper will start including them if list payloads contain `icu_*` — strip analysis keys when `!enrich`).

Strip helper:

```ts
function summaryOnly(
  input: CreateRunInput,
): CreateRunInput {
  const {
    trainingLoad: _tl,
    intensity: _i,
    gapPaceSecPerKm: _g,
    hrZoneSeconds: _z,
    splits: _s,
    polyline: _p,
    streams: _st,
    ...rest
  } = input;
  return rest;
}
```

Use `logger.warn` for per-activity failures (same logger as poller).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @running-club/api test -- src/services/intervals-import.test.ts src/integrations/intervals/map-activity.test.ts src/services/runs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/integrations/intervals/errors.ts apps/api/src/integrations/intervals/client.ts apps/api/src/services/intervals-import.ts apps/api/src/services/intervals-import.test.ts
git commit -m "Enrich Intervals import with detail, streams, and backfill gating."
```

---

### Task 6: MCP get_run / list_runs contract

**Files:**
- Modify: `apps/api/src/mcp/server.ts`
- Modify: `apps/api/src/mcp/server.test.ts`

**Interfaces:**
- Consumes: `handleLogRun` / `handleGetRun` / `handleListRuns` unchanged signatures
- Produces: tool descriptions that tell the model to use `get_run` for streams, zones, splits, load, GAP; list omits streams

- [ ] **Step 1: Extend MCP tests**

In `apps/api/src/mcp/server.test.ts`, after `get_run` test, add a dedicated case (or extend `log_run` input):

```ts
  it("get_run returns streams while list_runs omits them", async () => {
    const created = await handleLogRun(userId, {
      startedAt: "2026-08-03T10:00:00.000Z",
      distanceMeters: 3000,
      durationSeconds: 900,
      activityType: "run",
      trainingLoad: 40,
      streams: { t: [0, 30], pace: [300, 298], hr: [140, 142] },
    });
    const id = JSON.parse(textContent(created)).id;

    const listed = JSON.parse(textContent(await handleListRuns(userId, { limit: 20 })));
    const listRow = listed.find((r: { id: string }) => r.id === id);
    expect(listRow.streams).toBeNull();
    expect(listRow.trainingLoad).toBe(40);

    const one = JSON.parse(textContent(await handleGetRun(userId, { id })));
    expect(one.streams.t).toEqual([0, 30]);
  });
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @running-club/api test -- src/mcp/server.test.ts`

Expected: PASS once Task 2 is done; if descriptions are untested, still update them.

- [ ] **Step 3: Update tool descriptions**

```ts
    "list_runs",
    {
      description:
        "List runs for the authenticated user. Omits pace/HR streams; call get_run for full analysis.",
```

```ts
    "get_run",
    {
      description:
        "Get one run by id, including training load, intensity, GAP, HR zones, splits, polyline, and downsampled pace/HR streams when present.",
```

- [ ] **Step 4: Re-run MCP tests**

Run: `pnpm --filter @running-club/api test -- src/mcp/server.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/mcp/server.ts apps/api/src/mcp/server.test.ts
git commit -m "Expose run analysis through MCP get_run."
```

---

### Task 7: Run detail analysis UI

**Files:**
- Create: `apps/web/src/lib/polyline.ts`
- Create: `apps/web/src/components/HrZoneBar.tsx`
- Create: `apps/web/src/components/RunRouteScribble.tsx`
- Create: `apps/web/src/components/RunStreamsChart.tsx`
- Modify: `apps/web/src/pages/RunDetail.tsx`
- Modify: `apps/web/src/lib/format.ts` only if a tiny helper is cleaner (`formatPercent`)

**Interfaces:**
- Consumes: `RunRecord` analysis fields from Task 1 (via `@running-club/shared` / `api.ts` re-export)
- Produces: run detail sections rendered only when data exists

- [ ] **Step 1: Polyline decoder**

Create `apps/web/src/lib/polyline.ts` with standard encoded-polyline decode returning `{ lat: number; lng: number }[]`. Include a sanity check in a comment fixture: `"_p~iF~ps|U_ulLnnqC"` starts near `38.5, -120.2`.

- [ ] **Step 2: Presentational components**

`HrZoneBar`: props `{ seconds: number[] }`. Horizontal flex row; each non-zero zone is `flexGrow: seconds`. Label row `Z1…Zn` (index `0` → Z1) with duration via `formatDuration`. Colors: lane blue at decreasing opacity (`bg-primary` → `bg-primary/80` … → `bg-sky` / muted). No card chrome.

`RunRouteScribble`: decode polyline → fit points into a viewBox with padding → SVG `polyline` / `path`, `stroke: var(--rc-lane)` or `stroke-primary`, fill none, `h-40 w-full`. Return `null` if fewer than 2 points.

`RunStreamsChart`: map `{ t, pace, hr }` to recharts rows `{ t, pace, hr }`. Use existing `ChartContainer` + `LineChart`. Pace line `var(--color-pace)` lane blue; HR line sky/muted. Dual Y axes: pace inverted (`reversed` / domain nice). Tooltip: clock time from `t`, `formatPace(pace)`, bpm. If every `hr` is null, omit HR line and right axis. `className="aspect-auto h-56 w-full"`.

- [ ] **Step 3: Restyle RunDetail**

Replace boxed extra `DetailStat` grid with:

1. Hero row: pace (condensed, first), distance, duration — still three numbers, prefer hairline/`<dl>` over heavy bordered cards if easy; if keeping `DetailStat` for hero only, that is OK.
2. Secondary hairline row for any of: load, intensity (`${Math.round(intensity)}%`), GAP (`formatPace`), avg HR, max HR, elevation, calories, cadence, effort.
3. `HrZoneBar` when `hrZoneSeconds` has a positive sum.
4. `RunRouteScribble` when `polyline` is set.
5. `RunStreamsChart` when `streams?.t.length`.
6. Existing splits list; show `avgHeartRate` when present.
7. Notes + started footer unchanged.

Do not show empty analysis headings.

- [ ] **Step 4: Typecheck web**

Run: `pnpm --filter @running-club/web build`

Expected: PASS (`tsc -b` + vite build)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/polyline.ts apps/web/src/components/HrZoneBar.tsx apps/web/src/components/RunRouteScribble.tsx apps/web/src/components/RunStreamsChart.tsx apps/web/src/pages/RunDetail.tsx apps/web/src/lib/format.ts
git commit -m "Show Intervals analysis on the run detail page."
```

---

### Task 8: Verify locally

**Files:** none required (manual)

- [ ] **Step 1: Run the full automated suite**

```bash
pnpm --filter @running-club/shared test
pnpm --filter @running-club/api test
pnpm --filter @running-club/web build
```

Expected: all PASS. Ignore pre-existing `mcp/auth.test.ts` TS2322 mock typing only if it already failed `typecheck` before this work — do not expand scope to fix it unless your edit triggered it.

- [ ] **Step 2: Backfill from Connect**

With API+web running and Intervals connected, click Import. Confirm a recent outdoor run shows load, zones, route scribble, pace/HR chart, and splits. Confirm a second Import does not hammer Intervals (fast; unchanged runs). Open the same run via MCP `get_run` or REST `GET /runs/:id` and confirm `streams` is present; `GET /runs` has `streams: null`.

- [ ] **Step 3: Commit only if Step 2 forced a small fix**

If a mapper bug appears, fix with a test first, then commit:

```bash
git commit -m "Fix Intervals analysis mapping from live import."
```

---

## Self-review

| Spec requirement | Task |
|---|---|
| Persist load, intensity, GAP, zones, streams on `run` | 1–2 |
| Splits + optional HR, polyline reuse | 1, 3–5 |
| Downsample ~250 points | 3 |
| `list_runs` omits streams; `get_run` full | 2, 6 |
| Enrich new / backfill missing streams / skip unchanged | 5 |
| 429 aborts and skips `markIntegrationSynced` | 5 (throw) + existing poller `try/catch` |
| Run detail UI blocks | 7 |
| No log-form analysis fields / no map tiles / no extra insights | honored by omission |
| MCP descriptions | 6 |
| Manual import backfill | 8 |

No TBD placeholders. Names (`shouldEnrichIntervalsRun`, `IntervalsHttpError`, `downsampleIntervalsStreams`, `findRunByExternalId`) are consistent across tasks.
