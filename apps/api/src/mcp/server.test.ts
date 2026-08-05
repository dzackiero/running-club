import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import {
  handleDeleteRun,
  handleGetRun,
  handleGetSummary,
  handleGetWeeklyProgress,
  handleListRuns,
  handleLogRun,
  handleSetWeeklyGoal,
  handleUpdateRun,
} from "./tools";
import {
  MCP_PROTECTED_RESOURCE_METADATA_URL,
  mcpUnauthorizedResponse,
} from "./server";

const userId = "user_mcp_test_1";
const testUserIds = [userId];

function textContent(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const block = result.content[0];
  if (!block || block.type !== "text" || typeof block.text !== "string") {
    throw new Error("Expected text content block");
  }
  return block.text;
}

describe("MCP tool handlers", () => {
  let createdRunId: string;

  beforeAll(async () => {
    await ensureTestUsers(testUserIds);
  });

  afterAll(async () => {
    await deleteTestUsers(testUserIds);
  });

  it("log_run creates a run for the authenticated user", async () => {
    const result = await handleLogRun(userId, {
      startedAt: "2026-08-03T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    const text = textContent(result);
    expect(text).toContain("5000");
    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(text);
    createdRunId = parsed.id;
    expect(parsed.userId).toBe(userId);
  });

  it("list_runs returns runs for the user", async () => {
    const result = await handleListRuns(userId, { limit: 10 });
    const runs = JSON.parse(textContent(result));
    expect(Array.isArray(runs)).toBe(true);
    expect(runs.some((r: { id: string }) => r.id === createdRunId)).toBe(true);
  });

  it("get_run returns a single run", async () => {
    const result = await handleGetRun(userId, { id: createdRunId });
    const runRecord = JSON.parse(textContent(result));
    expect(runRecord.id).toBe(createdRunId);
    expect(runRecord.distanceMeters).toBe(5000);
  });

  it("get_run returns streams while list_runs omits them", async () => {
    const created = await handleLogRun(userId, {
      startedAt: "2026-08-03T10:00:00.000Z",
      distanceMeters: 3000,
      durationSeconds: 900,
      activityType: "run",
      trainingLoad: 40,
      streams: { t: [0, 30], pace: [300, 298], hr: [140, 142] },
    });
    const id = JSON.parse(textContent(created)).id;

    const listed = JSON.parse(
      textContent(await handleListRuns(userId, { limit: 20 })),
    );
    const listRow = listed.find((r: { id: string }) => r.id === id);
    expect(listRow.streams).toBeNull();
    expect(listRow.trainingLoad).toBe(40);

    const one = JSON.parse(textContent(await handleGetRun(userId, { id })));
    expect(one.streams.t).toEqual([0, 30]);
  });

  it("update_run updates run fields", async () => {
    const result = await handleUpdateRun(userId, {
      id: createdRunId,
      distanceMeters: 5200,
    });
    const runRecord = JSON.parse(textContent(result));
    expect(runRecord.distanceMeters).toBe(5200);
  });

  it("set_weekly_goal upserts the active goal", async () => {
    const result = await handleSetWeeklyGoal(userId, {
      weekStartsOn: 1,
      targetDistanceMeters: 25000,
    });
    const goal = JSON.parse(textContent(result));
    expect(goal.active).toBe(true);
    expect(goal.targetDistanceMeters).toBe(25000);
  });

  it("get_weekly_progress includes totals and goal", async () => {
    const result = await handleGetWeeklyProgress(userId, {});
    const progress = JSON.parse(textContent(result));
    expect(progress.totals.runCount).toBeGreaterThanOrEqual(1);
    expect(progress.goal?.targetDistanceMeters).toBe(25000);
  });

  it("get_summary returns stats for a date range", async () => {
    const result = await handleGetSummary(userId, {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
    });
    const summary = JSON.parse(textContent(result));
    expect(summary.runCount).toBeGreaterThanOrEqual(1);
    expect(summary.totalDistanceMeters).toBeGreaterThanOrEqual(5200);
  });

  it("delete_run removes the run", async () => {
    const result = await handleDeleteRun(userId, { id: createdRunId });
    expect(textContent(result)).toContain(createdRunId);
    expect(result.isError).toBeUndefined();

    const missing = await handleGetRun(userId, { id: createdRunId });
    expect(missing.isError).toBe(true);
  });

  it("returns validation errors for invalid log_run input", async () => {
    const result = await handleLogRun(userId, {
      startedAt: "not-a-date",
      distanceMeters: -1,
      durationSeconds: 0,
      activityType: "run",
    });
    expect(result.isError).toBe(true);
    expect(textContent(result)).toContain("Validation error");
  });
});

describe("MCP HTTP auth", () => {
  it("returns 401 with WWW-Authenticate challenge when unauthenticated", async () => {
    const res = await app.request("/mcp", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    const wwwAuth = res.headers.get("WWW-Authenticate");
    expect(wwwAuth).toContain('error="invalid_token"');
    expect(wwwAuth).toContain(
      `resource_metadata="${MCP_PROTECTED_RESOURCE_METADATA_URL}"`,
    );
  });

  it("mcpUnauthorizedResponse includes protected resource metadata URL", () => {
    const res = mcpUnauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain(
      MCP_PROTECTED_RESOURCE_METADATA_URL,
    );
  });
});
