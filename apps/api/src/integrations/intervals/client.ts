import { IntervalsHttpError } from "./errors";
import type { IntervalsActivity } from "./map-activity";
import type { IntervalsStream } from "./map-streams";

const INTERVALS_API_BASE = "https://intervals.icu/api/v1";

export function createIntervalsClient(apiKey: string) {
  const headers = {
    Authorization: `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString("base64")}`,
    Accept: "application/json",
    "User-Agent": "CupRun/1.0",
  };

  async function request(url: string): Promise<unknown> {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new IntervalsHttpError(
        res.status,
        `Intervals.icu request failed (${res.status}): ${body || res.statusText}`,
      );
    }
    return res.json();
  }

  async function listActivities(
    oldest: string,
    newest: string,
  ): Promise<IntervalsActivity[]> {
    const url = new URL(`${INTERVALS_API_BASE}/athlete/0/activities`);
    url.searchParams.set("oldest", oldest);
    url.searchParams.set("newest", newest);
    return (await request(url.toString())) as IntervalsActivity[];
  }

  async function getActivity(id: string): Promise<IntervalsActivity> {
    const url = new URL(`${INTERVALS_API_BASE}/activity/${id}`);
    url.searchParams.set("intervals", "true");
    return (await request(url.toString())) as IntervalsActivity;
  }

  async function getStreams(id: string): Promise<IntervalsStream[]> {
    const url = new URL(`${INTERVALS_API_BASE}/activity/${id}/streams`);
    url.searchParams.set(
      "types",
      "time,distance,heartrate,velocity_smooth",
    );
    return normalizeStreams(await request(url.toString()));
  }

  return { listActivities, getActivity, getStreams };
}

function normalizeStreams(payload: unknown): IntervalsStream[] {
  if (Array.isArray(payload)) return payload as IntervalsStream[];
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload as Record<string, unknown>).map(
    ([type, data]) => ({
      type,
      data: Array.isArray(data) ? (data as Array<number | null>) : undefined,
    }),
  );
}
