import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { env } from "./env";
import { requireUser } from "./middleware/require-user";
import { sessionMiddleware } from "./middleware/session";

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

app.use("*", sessionMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/me", requireUser, (c) =>
  c.json({ user: c.get("user"), session: c.get("session") }),
);
