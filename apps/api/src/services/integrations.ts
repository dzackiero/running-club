import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userIntegration } from "../db/schema";
import { env } from "../env";
import { decryptSecret, encryptSecret, secretHint } from "../lib/secret-box";

export type IntegrationProvider = "intervals";

export type IntegrationStatus = {
  connected: boolean;
  hint: string | null;
  lastSyncedAt: string | null;
};

export async function getUserIntegrationStatus(
  userId: string,
  provider: IntegrationProvider,
): Promise<IntegrationStatus> {
  const [row] = await db
    .select({
      hint: userIntegration.hint,
      lastSyncedAt: userIntegration.lastSyncedAt,
    })
    .from(userIntegration)
    .where(
      and(
        eq(userIntegration.userId, userId),
        eq(userIntegration.provider, provider),
      ),
    )
    .limit(1);

  if (!row) return { connected: false, hint: null, lastSyncedAt: null };
  return {
    connected: true,
    hint: row.hint,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

export async function getUserIntegrationSecret(
  userId: string,
  provider: IntegrationProvider,
): Promise<string | null> {
  const [row] = await db
    .select({ secretCiphertext: userIntegration.secretCiphertext })
    .from(userIntegration)
    .where(
      and(
        eq(userIntegration.userId, userId),
        eq(userIntegration.provider, provider),
      ),
    )
    .limit(1);

  if (!row) return null;
  return decryptSecret(row.secretCiphertext, env.BETTER_AUTH_SECRET);
}

export async function upsertUserIntegration(
  userId: string,
  provider: IntegrationProvider,
  secret: string,
): Promise<IntegrationStatus> {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error("API key is required");
  }

  const hint = secretHint(trimmed);
  const secretCiphertext = encryptSecret(trimmed, env.BETTER_AUTH_SECRET);
  const now = new Date();

  const [existing] = await db
    .select({
      id: userIntegration.id,
      lastSyncedAt: userIntegration.lastSyncedAt,
    })
    .from(userIntegration)
    .where(
      and(
        eq(userIntegration.userId, userId),
        eq(userIntegration.provider, provider),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(userIntegration)
      .set({ secretCiphertext, hint, updatedAt: now })
      .where(eq(userIntegration.id, existing.id));
    return {
      connected: true,
      hint,
      lastSyncedAt: existing.lastSyncedAt?.toISOString() ?? null,
    };
  }

  await db.insert(userIntegration).values({
    id: crypto.randomUUID(),
    userId,
    provider,
    secretCiphertext,
    hint,
    createdAt: now,
    updatedAt: now,
  });

  return { connected: true, hint, lastSyncedAt: null };
}

export async function markIntegrationSynced(
  userId: string,
  provider: IntegrationProvider,
  at = new Date(),
): Promise<void> {
  await db
    .update(userIntegration)
    .set({ lastSyncedAt: at, updatedAt: at })
    .where(
      and(
        eq(userIntegration.userId, userId),
        eq(userIntegration.provider, provider),
      ),
    );
}

export async function listIntervalsCredentials(): Promise<
  { userId: string; apiKey: string; lastSyncedAt: Date | null }[]
> {
  const rows = await db
    .select({
      userId: userIntegration.userId,
      secretCiphertext: userIntegration.secretCiphertext,
      lastSyncedAt: userIntegration.lastSyncedAt,
    })
    .from(userIntegration)
    .where(eq(userIntegration.provider, "intervals"));

  return rows.map((row) => ({
    userId: row.userId,
    apiKey: decryptSecret(row.secretCiphertext, env.BETTER_AUTH_SECRET),
    lastSyncedAt: row.lastSyncedAt ?? null,
  }));
}

export async function deleteUserIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  await db
    .delete(userIntegration)
    .where(
      and(
        eq(userIntegration.userId, userId),
        eq(userIntegration.provider, provider),
      ),
    );
}
