import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { auth } from "./auth";
import { env } from "./env";
import {
  getProtectedResourceMetadata,
  protectedResourceMetadataResponse,
} from "./mcp/auth";
import { requireUser } from "./middleware/require-user";
import { sessionMiddleware } from "./middleware/session";
import { goalsRoutes } from "./routes/goals";
import { insightsRoutes } from "./routes/insights";
import { runsRoutes } from "./routes/runs";

export type AppEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

export const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: env.WEB_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["WWW-Authenticate"],
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const authServerMetadata = oauthProviderAuthServerMetadata(auth);
const openIdConfigMetadata = oauthProviderOpenIdConfigMetadata(auth);

app.get("/.well-known/oauth-authorization-server", (c) =>
  authServerMetadata(c.req.raw),
);
app.get("/.well-known/oauth-authorization-server/api/auth", (c) =>
  authServerMetadata(c.req.raw),
);
app.get("/.well-known/openid-configuration", (c) =>
  openIdConfigMetadata(c.req.raw),
);
app.get("/.well-known/openid-configuration/api/auth", (c) =>
  openIdConfigMetadata(c.req.raw),
);

async function oauthProtectedResourceHandler() {
  const metadata = await getProtectedResourceMetadata();
  return protectedResourceMetadataResponse(metadata);
}

app.get("/.well-known/oauth-protected-resource", oauthProtectedResourceHandler);
// RFC 9728 path-aware PRM for resource `${API_PUBLIC_URL}/mcp`
app.get(
  "/.well-known/oauth-protected-resource/mcp",
  oauthProtectedResourceHandler,
);

app.use("*", sessionMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/me", requireUser, (c) =>
  c.json({ user: c.get("user"), session: c.get("session") }),
);

app.use("/runs/*", requireUser);
app.route("/runs", runsRoutes);

app.use("/goals/*", requireUser);
app.route("/goals", goalsRoutes);

app.use("/insights/*", requireUser);
app.route("/insights", insightsRoutes);
