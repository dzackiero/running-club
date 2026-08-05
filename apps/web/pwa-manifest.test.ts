import { describe, expect, it } from "vitest";
import {
  apiRequestUrlPatterns,
  pwaManifest,
} from "./pwa-manifest.ts";

describe("pwaManifest", () => {
  it("installs as a standalone app from /", () => {
    expect(pwaManifest.name).toBe("CUP Run");
    expect(pwaManifest.short_name).toBe("CUP Run");
    expect(pwaManifest.description).toMatch(/Coffee Unite People/i);
    expect(pwaManifest.display).toBe("standalone");
    expect(pwaManifest.start_url).toBe("/");
    expect(pwaManifest.scope).toBe("/");
  });

  it("uses track-chalk paper for theme and splash", () => {
    expect(pwaManifest.theme_color).toBe("#F7F8FA");
    expect(pwaManifest.background_color).toBe("#F7F8FA");
  });

  it("includes 192 and 512 png icons", () => {
    const sizes = pwaManifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      pwaManifest.icons.every(
        (icon) => icon.type === "image/png" && icon.src.endsWith(".png"),
      ),
    ).toBe(true);
  });
});

describe("apiRequestUrlPatterns", () => {
  function matchesApi(url: string, apiBaseUrl?: string): boolean {
    return apiRequestUrlPatterns(apiBaseUrl).some((pattern) => pattern.test(url));
  }

  it("bypasses same-origin /api and local API port", () => {
    expect(matchesApi("http://localhost:5173/api/auth/session")).toBe(true);
    expect(matchesApi("http://localhost:8787/runs")).toBe(true);
    expect(matchesApi("http://localhost:5173/settings")).toBe(false);
    expect(matchesApi("http://localhost:5173/")).toBe(false);
  });

  it("bypasses the configured VITE_API_URL origin", () => {
    expect(
      matchesApi(
        "https://api.example.com/runs",
        "https://api.example.com",
      ),
    ).toBe(true);
    expect(
      matchesApi(
        "https://app.example.com/goal",
        "https://api.example.com",
      ),
    ).toBe(false);
  });
});
