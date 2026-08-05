import type { CreateRunInput } from "@running-club/shared";
import { IntervalsHttpError } from "../integrations/intervals/errors";
import { mapIntervalsActivityToRun } from "../integrations/intervals/map-activity";
import type { IntervalsActivity } from "../integrations/intervals/map-activity";
import { splitsFromDistanceStream } from "../integrations/intervals/map-splits";
import {
  downsampleIntervalsStreams,
  type IntervalsStream,
} from "../integrations/intervals/map-streams";
import { logger } from "../lib/logger";
import { findRunByExternalId, upsertImportedRun } from "./runs";

export type IntervalsImportClient = {
  listActivities(oldest: string, newest: string): Promise<IntervalsActivity[]>;
  getActivity?(id: string): Promise<IntervalsActivity>;
  getStreams?(id: string): Promise<IntervalsStream[]>;
};

export type IntervalsImportResult = {
  imported: number;
  updated: number;
  skipped: number;
};

export function shouldEnrichIntervalsRun(
  existing: {
    streams: unknown;
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate: number | null;
    hrZoneBpm?: number[] | null;
  } | null,
  incoming: {
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate?: number;
  },
): boolean {
  if (!existing) return true;
  if (existing.streams == null) return true;
  if (existing.hrZoneBpm == null) return true;
  return summaryChanged(existing, incoming);
}

function summaryChanged(
  existing: {
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate: number | null;
  },
  incoming: {
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate?: number;
  },
): boolean {
  return (
    Math.round(existing.distanceMeters) !== Math.round(incoming.distanceMeters) ||
    existing.durationSeconds !== incoming.durationSeconds ||
    (existing.avgHeartRate ?? null) !== (incoming.avgHeartRate ?? null)
  );
}

export async function importFromIntervals(
  userId: string,
  client: IntervalsImportClient,
  range: { oldest?: Date; newest?: Date } = {},
): Promise<IntervalsImportResult> {
  const newest = range.newest ?? new Date();
  const oldest =
    range.oldest ?? new Date(newest.getTime() - 365 * 24 * 60 * 60 * 1000);

  const activities = await client.listActivities(
    toDateOnly(oldest),
    toDateOnly(newest),
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const activity of activities) {
    const mapped = mapIntervalsActivityToRun(activity);
    if (!mapped?.externalId) {
      skipped += 1;
      continue;
    }

    const existing = await findRunByExternalId(userId, mapped.externalId);
    const enrich = shouldEnrichIntervalsRun(existing, mapped);
    let payload: CreateRunInput = enrich ? mapped : summaryOnly(mapped);

    if (enrich && client.getActivity) {
      try {
        const detail = await client.getActivity(mapped.externalId);
        payload = mapIntervalsActivityToRun(detail) ?? mapped;
      } catch (err) {
        if (err instanceof IntervalsHttpError && err.status === 429) throw err;
        logger.warn(
          { err, externalId: mapped.externalId },
          "Intervals activity detail failed",
        );
      }
    }

    const refetchStreams =
      !existing || existing.streams == null || summaryChanged(existing, mapped);

    if (enrich && refetchStreams && client.getStreams) {
      try {
        const rawStreams = await client.getStreams(mapped.externalId);
        const streams = downsampleIntervalsStreams(rawStreams);
        if (streams) payload = { ...payload, streams };
        if (!payload.splits?.length) {
          const derived = splitsFromRawStreams(rawStreams);
          if (derived.length > 0) payload = { ...payload, splits: derived };
        }
      } catch (err) {
        if (err instanceof IntervalsHttpError && err.status === 429) throw err;
        logger.warn(
          { err, externalId: mapped.externalId },
          "Intervals activity streams failed",
        );
      }
    }

    const result = await upsertImportedRun(userId, {
      ...payload,
      source: "intervals",
      externalId: mapped.externalId,
    });
    if (result.created) imported += 1;
    else updated += 1;
  }

  return { imported, updated, skipped };
}

function summaryOnly(input: CreateRunInput): CreateRunInput {
  const {
    trainingLoad: _trainingLoad,
    intensity: _intensity,
    gapPaceSecPerKm: _gapPaceSecPerKm,
    hrZoneSeconds: _hrZoneSeconds,
    hrZoneBpm: _hrZoneBpm,
    splits: _splits,
    polyline: _polyline,
    streams: _streams,
    ...rest
  } = input;
  return rest;
}

function splitsFromRawStreams(streams: IntervalsStream[]) {
  const time = numericStream(streams, "time");
  const distance = numericStream(streams, "distance");
  if (!time || !distance) return [];
  const hr = streamValues(streams, "heartrate");
  return splitsFromDistanceStream(time, distance, hr ?? undefined);
}

function streamValues(
  streams: IntervalsStream[],
  type: string,
): Array<number | null> | null {
  const match = streams.find(
    (stream) => (stream.type ?? "").toLowerCase() === type,
  );
  return match?.data ?? null;
}

function numericStream(
  streams: IntervalsStream[],
  type: string,
): number[] | null {
  const data = streamValues(streams, type);
  if (!data) return null;
  return data.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : Number.NaN,
  );
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
