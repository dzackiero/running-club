import type {
  CreateRunInput,
  RunRecord,
  UpsertWeeklyGoalInput,
  WeekProgress,
  WeeklyGoalRecord,
} from "@running-club/shared";

const baseUrl = import.meta.env.VITE_API_URL;

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

export function listRuns(limit = 10) {
  return apiFetch<RunRecord[]>(`/runs?limit=${limit}`);
}

export function getWeekProgress() {
  return apiFetch<WeekProgress>("/insights/week");
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
