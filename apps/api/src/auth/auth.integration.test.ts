import { describe, expect, it } from "vitest";
import { app } from "../app";

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = "password123456";
const testName = "Test Runner";

describe("auth integration", () => {
  it("returns 401 for /api/me without session", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("signs up and returns user via session cookie", async () => {
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
    const body = await meRes.json();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.name).toBe(testName);
  });
});
