import { mapIntervalsActivityToRun } from "../integrations/intervals/map-activity";
import type { IntervalsActivity } from "../integrations/intervals/map-activity";
import { upsertImportedRun } from "./runs";

export type IntervalsImportClient = {
  listActivities(oldest: string, newest: string): Promise<IntervalsActivity[]>;
};

export type IntervalsImportResult = {
  imported: number;
  updated: number;
  skipped: number;
};

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

    const result = await upsertImportedRun(userId, {
      ...mapped,
      source: "intervals",
      externalId: mapped.externalId,
    });
    if (result.created) imported += 1;
    else updated += 1;
  }

  return { imported, updated, skipped };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
