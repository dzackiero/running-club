import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { userIntegration } from "../db/schema";
import { encryptSecret } from "../lib/secret-box";
import {
  deleteUserIntegration,
  getUserIntegrationStatus,
  getUserIntegrationSecret,
  IntegrationSecretError,
  listIntervalsCredentials,
  markIntegrationSynced,
  upsertUserIntegration,
} from "./integrations";
import { deleteTestUsers, ensureTestUsers } from "../test/users";

const userId = "user_intervals_cred";

describe("user integrations", () => {
  beforeAll(async () => {
    await ensureTestUsers([userId]);
  });

  afterAll(async () => {
    await deleteTestUsers([userId]);
  });

  it("stores an Intervals key encrypted and returns only a hint", async () => {
    expect(await getUserIntegrationStatus(userId, "intervals")).toEqual({
      connected: false,
      hint: null,
      lastSyncedAt: null,
    });

    const saved = await upsertUserIntegration(
      userId,
      "intervals",
      "140kfhot88gm2zacwcck7ku0e",
    );
    expect(saved).toEqual({
      connected: true,
      hint: "ku0e",
      lastSyncedAt: null,
    });

    expect(await getUserIntegrationSecret(userId, "intervals")).toBe(
      "140kfhot88gm2zacwcck7ku0e",
    );
    expect(await getUserIntegrationStatus(userId, "intervals")).toEqual({
      connected: true,
      hint: "ku0e",
      lastSyncedAt: null,
    });

    await deleteUserIntegration(userId, "intervals");
    expect(await getUserIntegrationSecret(userId, "intervals")).toBeNull();
    expect(await getUserIntegrationStatus(userId, "intervals")).toEqual({
      connected: false,
      hint: null,
      lastSyncedAt: null,
    });
  });

  it("lists Intervals credentials with lastSyncedAt for the poller", async () => {
    await upsertUserIntegration(
      userId,
      "intervals",
      "140kfhot88gm2zacwcck7ku0e",
    );

    const beforeSync = (await listIntervalsCredentials()).find(
      (row) => row.userId === userId,
    );
    expect(beforeSync).toEqual({
      userId,
      apiKey: "140kfhot88gm2zacwcck7ku0e",
      lastSyncedAt: null,
    });

    await markIntegrationSynced(
      userId,
      "intervals",
      new Date("2026-08-05T10:00:00.000Z"),
    );

    const afterSync = (await listIntervalsCredentials()).find(
      (row) => row.userId === userId,
    );
    expect(afterSync?.apiKey).toBe("140kfhot88gm2zacwcck7ku0e");
    expect(afterSync?.lastSyncedAt?.toISOString()).toBe(
      "2026-08-05T10:00:00.000Z",
    );

    await deleteUserIntegration(userId, "intervals");
  });

  it("rejects a key sealed with a different app secret", async () => {
    await upsertUserIntegration(
      userId,
      "intervals",
      "140kfhot88gm2zacwcck7ku0e",
    );
    await db
      .update(userIntegration)
      .set({
        secretCiphertext: encryptSecret(
          "140kfhot88gm2zacwcck7ku0e",
          "other-secret-at-least-32-characters!!",
        ),
      })
      .where(
        and(
          eq(userIntegration.userId, userId),
          eq(userIntegration.provider, "intervals"),
        ),
      );

    await expect(getUserIntegrationSecret(userId, "intervals")).rejects.toBeInstanceOf(
      IntegrationSecretError,
    );
    expect(
      (await listIntervalsCredentials()).some((row) => row.userId === userId),
    ).toBe(false);

    await deleteUserIntegration(userId, "intervals");
  });
});
