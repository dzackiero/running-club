import { createIntervalsClient } from "../integrations/intervals/client";
import { logger } from "../lib/logger";
import {
  listIntervalsCredentials,
  markIntegrationSynced,
} from "../services/integrations";
import { importFromIntervals } from "../services/intervals-import";

export const INTERVALS_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000;

export type IntervalsPollDeps = {
  listCredentials: typeof listIntervalsCredentials;
  importUser: (
    userId: string,
    apiKey: string,
  ) => Promise<{ imported: number; updated: number; skipped: number }>;
};

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
): Promise<{ users: number; failures: number }> {
  const credentials = await deps.listCredentials();
  let failures = 0;

  for (const { userId, apiKey } of credentials) {
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

  return { users: credentials.length, failures };
}

export function startIntervalsPoller(
  intervalMs = INTERVALS_POLL_INTERVAL_MS,
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
  }, intervalMs);

  initial.unref?.();
  logger.info({ intervalMs }, "Intervals poller scheduled");
}
