import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import {
  apiRequestUrlPatterns,
  pwaManifest,
  pwaNavigateFallbackDenylist,
} from "./pwa-manifest.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const apiPatterns = apiRequestUrlPatterns(
    env.VITE_API_URL || "http://localhost:8787",
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: pwaManifest,
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: pwaNavigateFallbackDenylist,
          runtimeCaching: apiPatterns.map((urlPattern) => ({
            urlPattern,
            handler: "NetworkOnly" as const,
          })),
        },
      }),
    ],
    // Load VITE_* from the monorepo root `.env` (same file as the API).
    envDir: repoRoot,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
