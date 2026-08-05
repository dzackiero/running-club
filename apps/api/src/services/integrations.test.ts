import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteUserIntegration,
  getUserIntegrationStatus,
  getUserIntegrationSecret,
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
});
