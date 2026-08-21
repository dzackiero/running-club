import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  createRunSchema,
  createMealDraftSchema,
  summaryQuerySchema,
  upsertWeeklyGoalObjectSchema,
} from "@running-club/shared";
import { env } from "../env";
import { MCP_RESOURCE, verifyMcpAccessToken } from "./auth";
import {
  handleDeleteRun,
  handleConfirmMealDraft,
  handleCreateMealDraft,
  handleDiscardMealDraft,
  handleGetMealDraft,
  handleGetRun,
  handleGetSummary,
  handleGetWeeklyProgress,
  handleListRuns,
  handleLogRun,
  handleSetWeeklyGoal,
  handleUpdateRun,
  listRunsToolSchema,
  confirmMealDraftToolSchema,
  mealDraftIdToolSchema,
  runIdToolSchema,
  updateRunToolSchema,
  createPlanTemplatesToolSchema,
  planTemplateIdToolSchema,
  handleListPlanTemplates,
  handleCreatePlanTemplate,
  handleCreatePlanTemplates,
  handleUpdatePlanTemplate,
  handleDeletePlanTemplate,
} from "./tools";

export const MCP_PROTECTED_RESOURCE_METADATA_URL = `${env.API_PUBLIC_URL}/.well-known/oauth-protected-resource/mcp`;

type McpSession = {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
  userId: string;
};

const sessions = new Map<string, McpSession>();

export function mcpUnauthorizedResponse(
  message = "Missing or invalid access token",
): Response {
  const wwwAuthenticate = `Bearer error="invalid_token", error_description="${message}", resource_metadata="${MCP_PROTECTED_RESOURCE_METADATA_URL}"`;
  return new Response(
    JSON.stringify({ error: "unauthorized", error_description: message }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": wwwAuthenticate,
      },
    },
  );
}

function createRunningClubMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "cup-run",
    version: "1.0.0",
  });

  server.registerTool(
    "list_plan_templates", { description: "List recurring personal plan templates", inputSchema: {} }, () => handleListPlanTemplates(userId),
  );
  server.registerTool(
    "create_plan_template", { description: "Create one recurring run, gym, or nutrition plan template", inputSchema: { weekday: z.number().int().min(0).max(6), category: z.enum(["run", "gym", "nutrition"]), title: z.string(), details: z.record(z.unknown()) } }, (args) => handleCreatePlanTemplate(userId, args),
  );
  server.registerTool(
    "create_plan_templates", { description: "Add multiple recurring templates for a weekly plan. This is additive and does not delete existing templates.", inputSchema: createPlanTemplatesToolSchema.shape }, (args) => handleCreatePlanTemplates(userId, args),
  );
  server.registerTool(
    "update_plan_template", { description: "Replace one recurring plan template", inputSchema: { id: z.string().uuid(), weekday: z.number().int().min(0).max(6), category: z.enum(["run", "gym", "nutrition"]), title: z.string(), details: z.record(z.unknown()) } }, (args) => handleUpdatePlanTemplate(userId, args),
  );
  server.registerTool(
    "delete_plan_template", { description: "Delete one recurring plan template while retaining materialized history", inputSchema: planTemplateIdToolSchema.shape }, (args) => handleDeletePlanTemplate(userId, args),
  );

  server.registerTool(
    "log_run",
    {
      description: "Log a new run activity",
      inputSchema: createRunSchema.shape,
    },
    (args) => handleLogRun(userId, args),
  );

  server.registerTool(
    "create_meal_draft",
    {
      description:
        "Create a reviewable meal estimate from food and portion context supplied by the client. Optional image references are opaque only: do not fetch images or perform vision inference. Confirmation is required before this meal counts toward nutrition totals.",
      inputSchema: createMealDraftSchema.shape,
    },
    (args) => handleCreateMealDraft(userId, args),
  );

  server.registerTool(
    "get_meal_draft",
    {
      description:
        "Get a pending meal draft so the user can review its food and portion estimate before confirmation. Drafts do not count toward nutrition totals.",
      inputSchema: mealDraftIdToolSchema.shape,
    },
    (args) => handleGetMealDraft(userId, args),
  );

  server.registerTool(
    "confirm_meal_draft",
    {
      description:
        "Confirm a reviewed meal draft, optionally correcting food and portion details. Explicit user confirmation is required before nutrition totals count the meal.",
      inputSchema: confirmMealDraftToolSchema.shape,
    },
    (args) => handleConfirmMealDraft(userId, args),
  );

  server.registerTool(
    "discard_meal_draft",
    {
      description:
        "Discard a pending meal draft when the user rejects its food or portion estimate. Discarded drafts never count toward nutrition totals.",
      inputSchema: mealDraftIdToolSchema.shape,
    },
    (args) => handleDiscardMealDraft(userId, args),
  );

  server.registerTool(
    "list_runs",
    {
      description:
        "List runs for the authenticated user. Omits pace/HR streams; call get_run for full analysis.",
      inputSchema: listRunsToolSchema.shape,
    },
    (args) => handleListRuns(userId, args),
  );

  server.registerTool(
    "get_run",
    {
      description:
        "Get one run by id, including training load, intensity, GAP, HR zone times and bpm bounds, splits, polyline, and downsampled pace/HR streams when present.",
      inputSchema: runIdToolSchema.shape,
    },
    (args) => handleGetRun(userId, args),
  );

  server.registerTool(
    "update_run",
    {
      description: "Update an existing run",
      inputSchema: updateRunToolSchema.shape,
    },
    (args) => handleUpdateRun(userId, args),
  );

  server.registerTool(
    "delete_run",
    {
      description: "Delete a run by id",
      inputSchema: runIdToolSchema.shape,
    },
    (args) => handleDeleteRun(userId, args),
  );

  server.registerTool(
    "get_weekly_progress",
    {
      description: "Get progress toward the current weekly goal",
      inputSchema: {},
    },
    (args) => handleGetWeeklyProgress(userId, args),
  );

  server.registerTool(
    "set_weekly_goal",
    {
      description: "Set or replace the active weekly goal",
      inputSchema: upsertWeeklyGoalObjectSchema.shape,
    },
    (args) => handleSetWeeklyGoal(userId, args),
  );

  server.registerTool(
    "get_summary",
    {
      description: "Get run summary stats for a date range",
      inputSchema: summaryQuerySchema.shape,
    },
    (args) => handleGetSummary(userId, args),
  );

  return server;
}

async function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await session.server.close();
  await session.transport.close();
}

export async function handleMcpRequest(req: Request): Promise<Response> {
  const auth = await verifyMcpAccessToken(req);
  if (!auth) {
    return mcpUnauthorizedResponse();
  }

  const sessionId = req.headers.get("mcp-session-id") ?? undefined;
  let parsedBody: unknown;

  if (req.method === "POST") {
    try {
      parsedBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found" },
          id: null,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    if (session.userId !== auth.userId) {
      return mcpUnauthorizedResponse("Session belongs to a different user");
    }
    return session.transport.handleRequest(req, { parsedBody });
  }

  if (req.method === "POST" && isInitializeRequest(parsedBody)) {
    let transport!: WebStandardStreamableHTTPServerTransport;
    const server = createRunningClubMcpServer(auth.userId);

    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, server, userId: auth.userId });
      },
      onsessionclosed: (id) => {
        void closeSession(id);
      },
    });

    await server.connect(transport);
    return transport.handleRequest(req, { parsedBody });
  }

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: valid session id or initialize request required",
      },
      id: null,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

/** @internal Test helper — clears in-memory MCP sessions between tests. */
export function resetMcpSessionsForTests() {
  sessions.clear();
}

export { MCP_RESOURCE };
