import {
  activityTypes,
  createRunSchema,
  summaryQuerySchema,
  updateRunSchema,
  upsertWeeklyGoalSchema,
} from "@running-club/shared";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError, z } from "zod";
import { upsertCurrentGoal } from "../services/goals";
import { getSummary, getWeekProgress } from "../services/insights";
import {
  createRun,
  deleteRun,
  getRun,
  listRuns,
  updateRun,
} from "../services/runs";

export const listRunsToolSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  activityType: z.enum(activityTypes).optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().datetime().optional(),
});

export const runIdToolSchema = z.object({
  id: z.string().uuid(),
});

export const updateRunToolSchema = updateRunSchema.extend({
  id: z.string().uuid(),
});

function jsonText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function validationErrorResult(err: ZodError): CallToolResult {
  return {
    content: [{ type: "text", text: `Validation error: ${err.message}` }],
    isError: true,
  };
}

function notFoundResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export async function handleLogRun(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const parsed = createRunSchema.parse(input);
    const run = await createRun(userId, parsed);
    return { content: [{ type: "text", text: jsonText(run) }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}

export async function handleListRuns(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const parsed = listRunsToolSchema.parse(input ?? {});
    const runs = await listRuns(userId, parsed);
    return { content: [{ type: "text", text: jsonText(runs) }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}

export async function handleGetRun(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const { id } = runIdToolSchema.parse(input);
    const run = await getRun(userId, id);
    if (!run) return notFoundResult("Run not found");
    return { content: [{ type: "text", text: jsonText(run) }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}

export async function handleUpdateRun(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const { id, ...updates } = updateRunToolSchema.parse(input);
    const run = await updateRun(userId, id, updates);
    if (!run) return notFoundResult("Run not found");
    return { content: [{ type: "text", text: jsonText(run) }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}

export async function handleDeleteRun(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const { id } = runIdToolSchema.parse(input);
    const deleted = await deleteRun(userId, id);
    if (!deleted) return notFoundResult("Run not found");
    return { content: [{ type: "text", text: `Deleted run ${id}` }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}

export async function handleGetWeeklyProgress(
  userId: string,
  _input: unknown,
): Promise<CallToolResult> {
  const progress = await getWeekProgress(userId);
  return { content: [{ type: "text", text: jsonText(progress) }] };
}

export async function handleSetWeeklyGoal(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const parsed = upsertWeeklyGoalSchema.parse(input);
    const goal = await upsertCurrentGoal(userId, parsed);
    return { content: [{ type: "text", text: jsonText(goal) }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}

export async function handleGetSummary(
  userId: string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const query = summaryQuerySchema.parse(input);
    const summary = await getSummary(userId, query);
    return { content: [{ type: "text", text: jsonText(summary) }] };
  } catch (err) {
    if (err instanceof ZodError) return validationErrorResult(err);
    throw err;
  }
}
