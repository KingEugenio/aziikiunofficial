import path from "path";
import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: unit tests (money math,
// currency helpers, rate-limit logic) are plain TS/Node code with no need
// for the React plugin, Tailwind plugin, or production build settings that
// file carries. Sharing the "@" alias is the only thing worth keeping in
// sync between the two.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
