import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  createRunSchema,
  summaryQuerySchema,
  upsertWeeklyGoalObjectSchema,
} from "@running-club/shared";
import { env } from "../env";
import { MCP_RESOURCE, verifyMcpAccessToken } from "./auth";
import {
  handleDeleteRun,
  handleGetRun,
  handleGetSummary,
  handleGetWeeklyProgress,
  handleListRuns,
  handleLogRun,
  handleSetWeeklyGoal,
  handleUpdateRun,
  listRunsToolSchema,
  runIdToolSchema,
  updateRunToolSchema,
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
    "log_run",
    {
      description: "Log a new run activity",
      inputSchema: createRunSchema.shape,
    },
    (args) => handleLogRun(userId, args),
  );

  server.registerTool(
    "list_runs",
    {
      description: "List runs for the authenticated user",
      inputSchema: listRunsToolSchema.shape,
    },
    (args) => handleListRuns(userId, args),
  );

  server.registerTool(
    "get_run",
    {
      description: "Get a single run by id",
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
