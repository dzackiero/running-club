import { exportJWK, generateKeyPair, type JWK, type KeyLike, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { AUTH_ISSUER, MCP_RESOURCE, verifyMcpAccessToken } from "../mcp/auth";

describe("MCP OAuth metadata", () => {
  it("returns protected resource metadata at root well-known path", async () => {
    const res = await app.request("/.well-known/oauth-protected-resource");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.resource).toBe(MCP_RESOURCE);
    expect(body.authorization_servers).toEqual([AUTH_ISSUER]);
  });

  it("returns protected resource metadata at RFC 9728 path-aware /mcp variant", async () => {
    const res = await app.request(
      "/.well-known/oauth-protected-resource/mcp",
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.resource).toBe(MCP_RESOURCE);
  });

  it("does not expose incorrect /mcp/.well-known PRM path", async () => {
    const res = await app.request("/mcp/.well-known/oauth-protected-resource");
    // Not registered as PRM; may 404 from missing MCP mount or fall through
    expect(res.status).not.toBe(200);
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
});

describe("verifyMcpAccessToken", () => {
  it("returns null without Authorization header", async () => {
    const result = await verifyMcpAccessToken(
      new Request("http://localhost/mcp"),
    );
    expect(result).toBeNull();
  });

  it("returns null for non-Bearer Authorization schemes", async () => {
    const result = await verifyMcpAccessToken(
      new Request("http://localhost/mcp", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      }),
    );
    expect(result).toBeNull();
  });
});

/**
 * Limitation: does not run the full Better Auth OAuth code/token flow.
 * Crafts a locally signed JWT and stubs JWKS so issuer/audience checks
 * in verifyMcpAccessToken are exercised independently of DCR/consent.
 *
 * One keypair + one JWKS stub for the suite — jose's remote JWKS client
 * caches by URL, so rotating keys across tests would false-fail.
 */
describe("verifyMcpAccessToken issuer/audience", () => {
  const kid = "task7-test-key";
  let privateKey: KeyLike;
  let publicJwk: JWK;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    publicJwk = await exportJWK(pair.publicKey);
    publicJwk.kid = kid;
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/jwks")) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function signAccessToken(claims: {
    iss: string;
    aud: string;
    sub?: string;
  }) {
    return new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(claims.iss)
      .setAudience(claims.aud)
      .setSubject(claims.sub ?? "user-task7")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  }

  it("rejects JWT with wrong audience (valid signature)", async () => {
    const token = await signAccessToken({
      iss: AUTH_ISSUER,
      aud: "https://evil.example/mcp",
    });

    const result = await verifyMcpAccessToken(
      new Request("http://localhost/mcp", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(result).toBeNull();
  });

  it("rejects JWT with wrong issuer (valid signature)", async () => {
    const token = await signAccessToken({
      iss: "https://evil.example/api/auth",
      aud: MCP_RESOURCE,
    });

    const result = await verifyMcpAccessToken(
      new Request("http://localhost/mcp", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(result).toBeNull();
  });

  it("accepts JWT with matching issuer and audience", async () => {
    const token = await signAccessToken({
      iss: AUTH_ISSUER,
      aud: MCP_RESOURCE,
      sub: "user-ok",
    });

    const result = await verifyMcpAccessToken(
      new Request("http://localhost/mcp", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(result).toEqual({ userId: "user-ok" });
  });
});
