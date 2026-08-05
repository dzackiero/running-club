import type {
  ClubBoardView,
  ClubDetail,
  ClubPeriod,
  ClubPeriodResultsView,
  ClubSummary,
  CreateClubInput,
  InsightsBestEfforts,
  InsightsOverview,
  PreferencesRecord,
  RunRecord,
  SendClubPeriodMessageInput,
  SendClubPeriodMessageResult,
  UpdateClubInput,
  UpdatePreferencesInput,
  UpdateRunInput,
  UpsertWeeklyGoalInput,
  WeekProgress,
  WeeklyGoalRecord,
} from "@running-club/shared";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      throw new Error(parsed.error?.message || body || res.statusText);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(body || res.statusText);
      }
      throw err;
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export type {
  ClubBoardView,
  ClubDetail,
  ClubPeriod,
  ClubPeriodResultsView,
  ClubSummary,
  PreferencesRecord,
  RunRecord,
  WeeklyGoalRecord,
  WeekProgress,
  InsightsOverview,
  InsightsBestEfforts,
};

export type ListRunsOptions = {
  limit?: number;
  from?: string;
  to?: string;
};

export function listRuns(options: ListRunsOptions = {}) {
  const params = new URLSearchParams();
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  const qs = params.toString();
  return apiFetch<RunRecord[]>(`/runs${qs ? `?${qs}` : ""}`);
}

export function getRun(id: string) {
  return apiFetch<RunRecord>(`/runs/${id}`);
}

export function getWeekProgress(at?: string) {
  const qs = at ? `?at=${encodeURIComponent(at)}` : "";
  return apiFetch<WeekProgress>(`/insights/week${qs}`);
}

export function getInsightsOverview(
  from?: string,
  to?: string,
  grain?: "day" | "week" | "month",
) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (grain) params.set("grain", grain);
  const qs = params.toString();
  return apiFetch<InsightsOverview>(
    `/insights/overview${qs ? `?${qs}` : ""}`,
  );
}

export function getInsightsBestEfforts() {
  return apiFetch<InsightsBestEfforts>("/insights/best-efforts");
}

export function getCurrentGoal() {
  return apiFetch<WeeklyGoalRecord | null>("/goals/current");
}

export function getPreferences() {
  return apiFetch<PreferencesRecord>("/preferences");
}

export function updatePreferences(body: UpdatePreferencesInput) {
  return apiFetch<PreferencesRecord>("/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function putCurrentGoal(body: UpsertWeeklyGoalInput) {
  return apiFetch<WeeklyGoalRecord>("/goals/current", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function updateRun(id: string, body: UpdateRunInput) {
  return apiFetch<RunRecord>(`/runs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteRun(id: string) {
  return apiFetch<void>(`/runs/${id}`, {
    method: "DELETE",
  });
}

export type IntervalsImportResult = {
  imported: number;
  updated: number;
  skipped: number;
};

export type IntervalsStatus = {
  connected: boolean;
  hint: string | null;
  lastSyncedAt: string | null;
};

export function getIntervalsStatus() {
  return apiFetch<IntervalsStatus>("/integrations/intervals");
}

export function saveIntervalsApiKey(apiKey: string) {
  return apiFetch<IntervalsStatus>("/integrations/intervals", {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
}

export function disconnectIntervals() {
  return apiFetch<void>("/integrations/intervals", {
    method: "DELETE",
  });
}

export function importIntervalsActivities() {
  return apiFetch<IntervalsImportResult>("/integrations/intervals/import", {
    method: "POST",
  });
}

export function listClubs() {
  return apiFetch<ClubSummary[]>("/clubs");
}

export function createClub(body: CreateClubInput) {
  return apiFetch<ClubSummary>("/clubs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function joinClub(inviteCode: string) {
  return apiFetch<ClubSummary>("/clubs/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
}

export function getClub(id: string) {
  return apiFetch<ClubDetail>(`/clubs/${id}`);
}

export function getClubBoard(id: string, period: ClubPeriod, offset = 0) {
  const params = new URLSearchParams({
    period,
    offset: String(offset),
  });
  return apiFetch<ClubBoardView>(`/clubs/${id}/board?${params}`);
}

export function getClubPeriodResults(id: string, period: ClubPeriod, offset = -1) {
  const params = new URLSearchParams({
    period,
    offset: String(offset),
  });
  return apiFetch<ClubPeriodResultsView>(`/clubs/${id}/period-results?${params}`);
}

export function sendClubPeriodMessage(
  id: string,
  body: SendClubPeriodMessageInput,
) {
  return apiFetch<SendClubPeriodMessageResult>(
    `/clubs/${id}/period-results/message`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function updateClub(id: string, body: UpdateClubInput) {
  return apiFetch<ClubSummary>(`/clubs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteClub(id: string) {
  return apiFetch<void>(`/clubs/${id}`, { method: "DELETE" });
}

export function leaveClub(id: string) {
  return apiFetch<void>(`/clubs/${id}/leave`, { method: "POST" });
}

export function updateClubNudges(id: string, emailNudges: boolean) {
  return apiFetch<ClubSummary>(`/clubs/${id}/me`, {
    method: "PATCH",
    body: JSON.stringify({ emailNudges }),
  });
}

export function removeClubMember(clubId: string, userId: string) {
  return apiFetch<void>(`/clubs/${clubId}/members/${userId}`, {
    method: "DELETE",
  });
}
