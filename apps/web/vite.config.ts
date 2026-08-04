import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Load VITE_* from the monorepo root `.env` (same file as the API).
  envDir: repoRoot,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
