import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, secretHint } from "./secret-box";

describe("secret-box", () => {
  const secret = "dev-secret-at-least-32-characters-long!!";

  it("round-trips a value", () => {
    const sealed = encryptSecret("140kfhot88gm2zacwcck7ku0e", secret);
    expect(sealed).not.toContain("140kfhot");
    expect(decryptSecret(sealed, secret)).toBe("140kfhot88gm2zacwcck7ku0e");
  });

  it("returns a short hint for UI", () => {
    expect(secretHint("140kfhot88gm2zacwcck7ku0e")).toBe("ku0e");
  });

  it("fails closed when the wrapping secret changed", () => {
    const sealed = encryptSecret("140kfhot88gm2zacwcck7ku0e", secret);
    expect(() => decryptSecret(sealed, `${secret}-rotated`)).toThrow(
      /Unable to decrypt secret/,
    );
  });
});
