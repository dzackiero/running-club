import { describe, expect, it } from "vitest";
import { app } from "../app";
import { AUTH_ISSUER, MCP_RESOURCE } from "../mcp/auth";

describe("MCP OAuth metadata", () => {
  it("returns protected resource metadata at root well-known path", async () => {
    const res = await app.request("/.well-known/oauth-protected-resource");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.resource).toBe(MCP_RESOURCE);
    expect(body.authorization_servers).toEqual([AUTH_ISSUER]);
  });

  it("returns protected resource metadata at MCP path variant", async () => {
    const res = await app.request("/mcp/.well-known/oauth-protected-resource");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.resource).toBe(MCP_RESOURCE);
  });

  it("returns OAuth authorization server metadata", async () => {
    const res = await app.request(
      "/.well-known/oauth-authorization-server/api/auth",
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.issuer).toBe(AUTH_ISSUER);
    expect(body.authorization_endpoint).toContain("/oauth2/authorize");
  });

  it("verifyMcpAccessToken returns null without Authorization header", async () => {
    const { verifyMcpAccessToken } = await import("../mcp/auth");
    const result = await verifyMcpAccessToken(
      new Request("http://localhost/mcp"),
    );
    expect(result).toBeNull();
  });
});
