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
    // src/server/env.ts throws at import time if the required Supabase
    // vars aren't set - loading .env here (not auto-loaded by vitest
    // itself) is what lets the loginLockout/rate-limit tests import that
    // module at all, same as server.ts's own "import dotenv/config" first line.
    setupFiles: ["dotenv/config"],
  },
});
