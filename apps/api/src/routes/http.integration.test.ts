import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { db } from "../db/client";
import { run, user, weeklyGoal } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

const stamp = Date.now();
const testPassword = "password123456";
const testName = "HTTP Integration Runner";

async function signUpAndGetCookie(
  suffix: string,
): Promise<{ cookie: string; userId: string }> {
  const signUpRes = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `http-int-${stamp}-${suffix}@example.com`,
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
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    ({ cookie, userId } = await signUpAndGetCookie("primary"));
    createdUserIds.push(userId);
  });

  afterAll(async () => {
    await db.delete(user).where(inArray(user.id, createdUserIds));
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

  it("returns 404 for GET /clubs", async () => {
    const res = await app.request("/clubs", { headers: { cookie } });
    expect(res.status).toBe(404);
  });

  it("creates personal templates, serves today, and isolates occurrence updates", async () => {
    const createTemplateRes = await app.request("/plan/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        weekday: 2,
        category: "gym",
        title: "Tuesday strength",
        details: { focus: "lower body" },
      }),
    });
    expect(createTemplateRes.status).toBe(201);

    const todayRes = await app.request(
      "/insights/today?at=2026-08-04T12:00:00.000Z",
      { headers: { cookie } },
    );
    expect(todayRes.status).toBe(200);
    const today = await todayRes.json();
    expect(today.items).toHaveLength(1);
    expect(today.items[0].title).toBe("Tuesday strength");
    expect(today.week.days).toHaveLength(7);

    const ownedOccurrenceId = today.items[0].id as string;
    const updateRes = await app.request(`/plan/occurrences/${ownedOccurrenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ status: "done" }),
    });
    expect(updateRes.status).toBe(200);
    expect((await updateRes.json()).status).toBe("done");

    const other = await signUpAndGetCookie("other");
    createdUserIds.push(other.userId);
    const forbiddenUpdateRes = await app.request(
      `/plan/occurrences/${ownedOccurrenceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: other.cookie },
        body: JSON.stringify({ status: "skipped" }),
      },
    );
    expect(forbiddenUpdateRes.status).toBe(404);
  });

  it("retains run and weekly goal rows for the authenticated user", async () => {
    const [runs, goals] = await Promise.all([
      db.select().from(run).where(eq(run.userId, userId)),
      db.select().from(weeklyGoal).where(eq(weeklyGoal.userId, userId)),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.userId).toBe(userId);
    expect(goals).toHaveLength(1);
    expect(goals[0]?.userId).toBe(userId);
  });
});
