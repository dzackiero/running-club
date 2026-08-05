import { describe, expect, it } from "vitest";
import { googleSocialProviders } from "./social";

describe("googleSocialProviders", () => {
  it("is undefined until both Google credentials are set", () => {
    expect(googleSocialProviders({})).toBeUndefined();
    expect(
      googleSocialProviders({ GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com" }),
    ).toBeUndefined();
    expect(googleSocialProviders({ GOOGLE_CLIENT_SECRET: "secret" })).toBeUndefined();
  });

  it("returns google when both credentials are set", () => {
    expect(
      googleSocialProviders({
        GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "secret",
      }),
    ).toEqual({
      google: {
        clientId: "id.apps.googleusercontent.com",
        clientSecret: "secret",
      },
    });
  });
});
