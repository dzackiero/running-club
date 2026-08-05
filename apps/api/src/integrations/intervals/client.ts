import type { IntervalsActivity } from "./map-activity";

const INTERVALS_API_BASE = "https://intervals.icu/api/v1";

export function createIntervalsClient(apiKey: string) {
  async function listActivities(
    oldest: string,
    newest: string,
  ): Promise<IntervalsActivity[]> {
    const url = new URL(`${INTERVALS_API_BASE}/athlete/0/activities`);
    url.searchParams.set("oldest", oldest);
    url.searchParams.set("newest", newest);

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString("base64")}`,
        Accept: "application/json",
        "User-Agent": "CupRun/1.0",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Intervals.icu request failed (${res.status}): ${body || res.statusText}`,
      );
    }

    return (await res.json()) as IntervalsActivity[];
  }

  return { listActivities };
}
