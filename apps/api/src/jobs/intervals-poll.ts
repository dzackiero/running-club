import { createIntervalsClient } from "../integrations/intervals/client";
import { logger } from "../lib/logger";
import {
  listIntervalsCredentials,
  markIntegrationSynced,
} from "../services/integrations";
import { importFromIntervals } from "../services/intervals-import";

export const INTERVALS_POLL_INTERVAL_MS = 10 * 60 * 1000;
export const INTERVALS_POLL_INITIAL_DELAY_MS = 30 * 1000;
export const INTERVALS_SYNC_DUE_AFTER_MS = 2 * 60 * 60 * 1000;

export type IntervalsPollDeps = {
  listCredentials: typeof listIntervalsCredentials;
  importUser: (
    userId: string,
    apiKey: string,
  ) => Promise<{ imported: number; updated: number; skipped: number }>;
  now?: () => Date;
};

export function isIntervalsSyncDue(
  lastSyncedAt: Date | null,
  now: Date,
  dueAfterMs = INTERVALS_SYNC_DUE_AFTER_MS,
): boolean {
  if (lastSyncedAt == null) return true;
  return now.getTime() - lastSyncedAt.getTime() >= dueAfterMs;
}

export async function pollAllIntervalsImports(
  deps: IntervalsPollDeps = {
    listCredentials: listIntervalsCredentials,
    importUser: async (userId, apiKey) => {
      const result = await importFromIntervals(
        userId,
        createIntervalsClient(apiKey),
      );
      await markIntegrationSynced(userId, "intervals");
      return result;
    },
  },
): Promise<{ users: number; due: number; failures: number }> {
  const credentials = await deps.listCredentials();
  const now = deps.now?.() ?? new Date();
  let due = 0;
  let failures = 0;

  for (const { userId, apiKey, lastSyncedAt } of credentials) {
    if (!isIntervalsSyncDue(lastSyncedAt, now)) {
      continue;
    }

    due += 1;
    try {
      await deps.importUser(userId, apiKey);
    } catch (err) {
      failures += 1;
      logger.error(
        { err, userId, provider: "intervals" },
        "Intervals poll failed for user",
      );
    }
  }

  return { users: credentials.length, due, failures };
}

export function startIntervalsPoller(
  intervalMs = INTERVALS_POLL_INTERVAL_MS,
  initialDelayMs = INTERVALS_POLL_INITIAL_DELAY_MS,
): void {
  const tick = async () => {
    const result = await pollAllIntervalsImports();
    logger.info({ ...result, intervalMs }, "Intervals poll finished");
  };

  const initial = setTimeout(() => {
    void tick();
    const repeating = setInterval(() => {
      void tick();
    }, intervalMs);
    repeating.unref?.();
  }, initialDelayMs);

  initial.unref?.();
  logger.info({ intervalMs, initialDelayMs }, "Intervals poller scheduled");
}
