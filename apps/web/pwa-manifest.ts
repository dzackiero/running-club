export const PWA_THEME_COLOR = "#F7F8FA";
export const PWA_BACKGROUND_COLOR = "#F7F8FA";

export const pwaManifest = {
  name: "CUP Run",
  short_name: "CUP Run",
  description: "Coffee Unite People — personal running log",
  start_url: "/",
  scope: "/",
  display: "standalone" as const,
  background_color: PWA_BACKGROUND_COLOR,
  theme_color: PWA_THEME_COLOR,
  lang: "en",
  icons: [
    {
      src: "pwa-192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "pwa-512.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: "pwa-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export const pwaNavigateFallbackDenylist = [/^\/api(?:\/|$)/];

export function apiRequestUrlPatterns(
  apiBaseUrl = "http://localhost:8787",
): RegExp[] {
  const patterns = [/\/api(?:\/|$)/i, /^https?:\/\/localhost:8787(?:\/|$)/i];

  try {
    const origin = new URL(apiBaseUrl).origin;
    if (origin !== "http://localhost:8787" && origin !== "https://localhost:8787") {
      patterns.push(new RegExp(`^${escapeRegExp(origin)}(?:/|$)`, "i"));
    }
  } catch {
    // Ignore invalid API URLs; local /api + :8787 patterns still apply.
  }

  return patterns;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
