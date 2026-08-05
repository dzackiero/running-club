import type {
  CreateRunInput,
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
    throw new Error(body || res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export type { RunRecord, WeeklyGoalRecord, WeekProgress };

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
