import { z } from "zod";

export const clubRoles = ["owner", "member"] as const;
export type ClubRole = (typeof clubRoles)[number];

export const clubPeriods = ["week", "month"] as const;
export type ClubPeriod = (typeof clubPeriods)[number];

export const createClubSchema = z.object({
  name: z.string().trim().min(1).max(80),
  weekStartsOn: z.number().int().min(0).max(6).optional().default(1),
});

export type CreateClubInput = z.input<typeof createClubSchema>;

export const joinClubSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});

export type JoinClubInput = z.infer<typeof joinClubSchema>;

export const updateClubSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  weeklyTargetDistanceMeters: z.number().positive().nullable().optional(),
  monthlyTargetDistanceMeters: z.number().positive().nullable().optional(),
  rotateInviteCode: z.boolean().optional(),
});

export type UpdateClubInput = z.infer<typeof updateClubSchema>;

export const updateClubMembershipSchema = z.object({
  emailNudges: z.boolean(),
});

export type UpdateClubMembershipInput = z.infer<
  typeof updateClubMembershipSchema
>;

export type ClubLeaderboardEntry = {
  userId: string;
  name: string;
  distanceMeters: number;
  runCount: number;
  rank: number;
};

export const clubBoardHighlightKinds = [
  "runs",
  "longest",
  "days",
] as const;
export type ClubBoardHighlightKind = (typeof clubBoardHighlightKinds)[number];

export type ClubBoardHighlight = {
  kind: ClubBoardHighlightKind;
  userId: string;
  name: string;
  value: number;
};

export type ClubPeriodBoard = {
  start: string;
  end: string;
  targetDistanceMeters: number | null;
  board: ClubLeaderboardEntry[];
  highlights: ClubBoardHighlight[];
};

export const clubBoardQuerySchema = z.object({
  period: z.enum(clubPeriods),
  offset: z.number().int().max(0).default(0),
});

export type ClubBoardQuery = z.infer<typeof clubBoardQuerySchema>;

export type ClubBoardView = {
  period: ClubPeriod;
  offset: number;
  start: string;
  end: string;
  targetDistanceMeters: number | null;
  board: ClubLeaderboardEntry[];
  highlights: ClubBoardHighlight[];
};

export type ClubSummary = {
  id: string;
  name: string;
  inviteCode: string | null;
  ownerUserId: string;
  weekStartsOn: number;
  weeklyTargetDistanceMeters: number | null;
  monthlyTargetDistanceMeters: number | null;
  role: ClubRole;
  emailNudges: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClubDetail = ClubSummary & {
  week: ClubPeriodBoard;
  month: ClubPeriodBoard;
  emailNotifications: boolean;
};

export const clubPeriodMessageTemplateIds = ["encourage", "check-in"] as const;
export type ClubPeriodMessageTemplateId =
  (typeof clubPeriodMessageTemplateIds)[number];

export const clubMissMessageTemplates: Array<{
  id: ClubPeriodMessageTemplateId;
  label: string;
  body: string;
}> = [
  {
    id: "encourage",
    label: "Encouraging note",
    body: "Last {period} in {clubName} you ran {distanceKm} km of the {targetKm} km club target ({dates}). Shake it off — next {period} is a fresh start.\n\nSee the board: {clubUrl}",
  },
  {
    id: "check-in",
    label: "Friendly check-in",
    body: "Checking in from {clubName}. Last {period} you were at {distanceKm} km vs the {targetKm} km club target ({dates}). Hope training’s going okay.\n\nBoard: {clubUrl}",
  },
];

export const clubPeriodResultsQuerySchema = z.object({
  period: z.enum(clubPeriods),
  offset: z.number().int().max(-1).default(-1),
});

export type ClubPeriodResultsQuery = z.infer<typeof clubPeriodResultsQuerySchema>;

export const sendClubPeriodMessageSchema = z.object({
  period: z.enum(clubPeriods),
  periodStart: z.string().datetime(),
  templateId: z.enum(clubPeriodMessageTemplateIds).optional().default("encourage"),
  body: z.string().trim().min(1).max(2000).optional(),
});

export type SendClubPeriodMessageInput = z.infer<
  typeof sendClubPeriodMessageSchema
>;

export type ClubPeriodResultMember = {
  userId: string;
  name: string;
  distanceMeters: number;
  hit: boolean;
  targetDistanceMeters: number | null;
  lastManualNudgeAt: string | null;
};

export type ClubPeriodResultsView = {
  period: ClubPeriod;
  offset: number;
  start: string;
  end: string;
  targetDistanceMeters: number | null;
  captured: boolean;
  counts: {
    memberCount: number;
    hit: number;
    missed: number;
    noTarget: number;
  };
  members: ClubPeriodResultMember[];
};

export type SendClubPeriodMessageResult = {
  sent: number;
  skipped: number;
};
