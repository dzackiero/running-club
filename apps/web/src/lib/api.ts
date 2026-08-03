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

export type RunRecord = {
  id: string;
  startedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  activityType: string;
  avgPaceSecPerKm: number | null;
};

export type WeeklyGoalRecord = {
  id: string;
  weekStartsOn: number;
  targetDistanceMeters: number | null;
  targetDurationSeconds: number | null;
  targetRunCount: number | null;
};

export type WeekProgress = {
  weekStart: string;
  weekEnd: string;
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    runCount: number;
  };
  goal: WeeklyGoalRecord | null;
  progress: {
    distanceRatio: number | null;
    durationRatio: number | null;
    runCountRatio: number | null;
  };
};

export function listRuns(limit = 10) {
  return apiFetch<RunRecord[]>(`/runs?limit=${limit}`);
}

export function getWeekProgress() {
  return apiFetch<WeekProgress>("/insights/week");
}

export function getCurrentGoal() {
  return apiFetch<WeeklyGoalRecord | null>("/goals/current");
}

export function putCurrentGoal(body: {
  weekStartsOn: number;
  targetDistanceMeters?: number;
  targetDurationSeconds?: number;
  targetRunCount?: number;
}) {
  return apiFetch<WeeklyGoalRecord>("/goals/current", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function createRun(body: {
  startedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  activityType: "run" | "trail" | "treadmill" | "race";
}) {
  return apiFetch<RunRecord>("/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
