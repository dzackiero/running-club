import { describe, expect, it } from "vitest";
import { updatePreferencesSchema } from "./preferences";

describe("preferences schema", () => {
  it("accepts a global email toggle", () => {
    expect(
      updatePreferencesSchema.parse({ emailNotifications: false }),
    ).toEqual({ emailNotifications: false });
  });
});
