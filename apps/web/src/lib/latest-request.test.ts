import { describe, expect, it } from "vitest";
import { createLatestRequestGuard } from "./latest-request";

describe("latest request guard", () => {
  it("rejects an earlier request after a newer one starts", () => {
    const guard = createLatestRequestGuard();
    const earlier = guard.begin();
    const newer = guard.begin();

    expect(guard.isLatest(earlier)).toBe(false);
    expect(guard.isLatest(newer)).toBe(true);
  });

  it("allows only the newest request to apply a result", () => {
    const guard = createLatestRequestGuard();
    const earlier = guard.begin();
    const newer = guard.begin();
    const applied: string[] = [];

    if (guard.isLatest(newer)) applied.push("newer");
    if (guard.isLatest(earlier)) applied.push("earlier");

    expect(applied).toEqual(["newer"]);
  });
});
