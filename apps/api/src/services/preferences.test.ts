import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import { getPreferences, updatePreferences } from "./preferences";

const userId = "user_pref_email";

describe("preferences", () => {
  beforeAll(async () => {
    await ensureTestUsers([userId]);
  });

  afterAll(async () => {
    await deleteTestUsers([userId]);
  });

  it("defaults email notifications on and can turn them off", async () => {
    expect(await getPreferences(userId)).toEqual({
      emailNotifications: true,
    });
    expect(
      await updatePreferences(userId, { emailNotifications: false }),
    ).toEqual({ emailNotifications: false });
    expect(await getPreferences(userId)).toEqual({
      emailNotifications: false,
    });
  });
});
