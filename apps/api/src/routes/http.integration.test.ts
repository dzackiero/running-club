import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { db } from "../db/client";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

const stamp = Date.now();
const testEmail = `http-int-${stamp}@example.com`;
const testPassword = "password123456";
const testName = "HTTP Integration Runner";

async function signUpAndGetCookie(): Promise<{ cookie: string; userId: string }> {
  const signUpRes = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: testName,
    }),
  });
  expect(signUpRes.status).toBe(200);
  const setCookie = signUpRes.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();

  const meRes = await app.request("/api/me", {
    headers: { cookie: setCookie! },
  });
  expect(meRes.status).toBe(200);
  const me = await meRes.json();
  return { cookie: setCookie!, userId: me.user.id as string };
}

describe("HTTP runs and goals", () => {
  let cookie: string;
  let userId: string;

  beforeAll(async () => {
    ({ cookie, userId } = await signUpAndGetCookie());
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, userId));
  });

  it("returns 401 for GET /runs without session", async () => {
    const res = await app.request("/runs");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for POST /runs without session", async () => {
    const res = await app.request("/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: "2026-08-03T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1500,
        activityType: "run",
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates and lists runs when authenticated", async () => {
    const createRes = await app.request("/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        startedAt: "2026-08-03T06:00:00.000Z",
        distanceMeters: 5000,
        durationSeconds: 1500,
        activityType: "run",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.distanceMeters).toBe(5000);
    expect(created.userId).toBe(userId);

    const listRes = await app.request("/runs?limit=10", {
      headers: { cookie },
    });
    expect(listRes.status).toBe(200);
    const runs = await listRes.json();
    expect(Array.isArray(runs)).toBe(true);
    expect(runs.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });

  it("returns 400 for invalid list query", async () => {
    const res = await app.request("/runs?limit=nope", {
      headers: { cookie },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("round-trips current weekly goal", async () => {
    const putRes = await app.request("/goals/current", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        weekStartsOn: 1,
        targetDistanceMeters: 32000,
        targetRunCount: 4,
      }),
    });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.active).toBe(true);
    expect(putBody.targetDistanceMeters).toBe(32000);

    const getRes = await app.request("/goals/current", {
      headers: { cookie },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody?.id).toBe(putBody.id);
    expect(getBody?.targetRunCount).toBe(4);
  });

  it("creates a club, joins with an invite, and returns boards", async () => {
    const createRes = await app.request("/clubs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({ name: "HTTP Club" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe("HTTP Club");
    expect(created.inviteCode).toBeTruthy();

    const patchRes = await app.request(`/clubs/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({ weeklyTargetDistanceMeters: 20000 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.weeklyTargetDistanceMeters).toBe(20000);

    const detailRes = await app.request(`/clubs/${created.id}`, {
      headers: { cookie },
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.week.board.some((row: { userId: string }) => row.userId === userId)).toBe(
      true,
    );

    const boardRes = await app.request(
      `/clubs/${created.id}/board?period=week&offset=-1`,
      { headers: { cookie } },
    );
    expect(boardRes.status).toBe(200);
    const board = await boardRes.json();
    expect(board.period).toBe("week");
    expect(board.offset).toBe(-1);
    expect(Array.isArray(board.board)).toBe(true);

    const futureRes = await app.request(
      `/clubs/${created.id}/board?period=week&offset=1`,
      { headers: { cookie } },
    );
    expect(futureRes.status).toBe(400);

    const resultsRes = await app.request(
      `/clubs/${created.id}/period-results?period=week`,
      { headers: { cookie } },
    );
    expect(resultsRes.status).toBe(200);
    const results = await resultsRes.json();
    expect(results.period).toBe("week");
    expect(results.offset).toBe(-1);
    expect(results.captured).toBe(false);
    expect(results.counts.memberCount).toBe(0);
  });
});
