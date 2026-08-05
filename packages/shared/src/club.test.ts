import { describe, expect, it } from "vitest";
import {
  clubBoardQuerySchema,
  clubPeriodResultsQuerySchema,
  createClubSchema,
  joinClubSchema,
  sendClubPeriodMessageSchema,
  updateClubSchema,
  updateClubMembershipSchema,
} from "./club";

describe("club schemas", () => {
  it("creates a club with a default week start", () => {
    const parsed = createClubSchema.parse({ name: "  Dawn Patrol  " });
    expect(parsed.name).toBe("Dawn Patrol");
    expect(parsed.weekStartsOn).toBe(1);
  });

  it("rejects an empty club name", () => {
    expect(() => createClubSchema.parse({ name: "   " })).toThrow();
  });

  it("joins with a trimmed invite code", () => {
    expect(joinClubSchema.parse({ inviteCode: "  abcd1234  " })).toEqual({
      inviteCode: "abcd1234",
    });
  });

  it("allows clearing club targets with null", () => {
    const parsed = updateClubSchema.parse({
      weeklyTargetDistanceMeters: null,
      monthlyTargetDistanceMeters: 40_000,
      rotateInviteCode: true,
    });
    expect(parsed.weeklyTargetDistanceMeters).toBeNull();
    expect(parsed.monthlyTargetDistanceMeters).toBe(40_000);
    expect(parsed.rotateInviteCode).toBe(true);
  });

  it("updates membership nudge preference", () => {
    expect(updateClubMembershipSchema.parse({ emailNudges: false })).toEqual({
      emailNudges: false,
    });
  });

  it("defaults board offset to the current period", () => {
    expect(clubBoardQuerySchema.parse({ period: "month" })).toEqual({
      period: "month",
      offset: 0,
    });
    expect(() =>
      clubBoardQuerySchema.parse({ period: "week", offset: 1 }),
    ).toThrow();
  });

  it("defaults period-results offset to the last closed period", () => {
    expect(clubPeriodResultsQuerySchema.parse({ period: "week" })).toEqual({
      period: "week",
      offset: -1,
    });
    expect(() =>
      clubPeriodResultsQuerySchema.parse({ period: "month", offset: 0 }),
    ).toThrow();
  });

  it("accepts a template or custom body for owner miss messages", () => {
    expect(
      sendClubPeriodMessageSchema.parse({
        period: "week",
        periodStart: "2026-07-27T00:00:00.000Z",
        templateId: "encourage",
      }),
    ).toMatchObject({
      period: "week",
      templateId: "encourage",
    });
    expect(
      sendClubPeriodMessageSchema.parse({
        period: "month",
        periodStart: "2026-07-01T00:00:00.000Z",
        body: "Custom note for the misses.",
      }),
    ).toMatchObject({
      body: "Custom note for the misses.",
      templateId: "encourage",
    });
  });
});
