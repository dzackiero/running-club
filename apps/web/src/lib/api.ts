import type {
  CreateRunInput,
  InsightsOverview,
  RunRecord,
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

export type { RunRecord, WeeklyGoalRecord, WeekProgress, InsightsOverview };

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

export function getCurrentGoal() {
  return apiFetch<WeeklyGoalRecord | null>("/goals/current");
}

export function putCurrentGoal(body: UpsertWeeklyGoalInput) {
  return apiFetch<WeeklyGoalRecord>("/goals/current", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function createRun(body: CreateRunInput) {
  return apiFetch<RunRecord>("/runs", {
    method: "POST",
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
