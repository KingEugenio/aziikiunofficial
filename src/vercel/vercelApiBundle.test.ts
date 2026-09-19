import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildVercelApi, ENTRIES } from "../../scripts/build-vercel-api.mjs";

// The deployed Vercel functions are the committed api/*.js bundles (see
// scripts/build-vercel-api.mjs for why they exist). They MUST match the
// current source: if someone edits src/server/* and forgets `npm run build:api`,
// production would keep running the OLD code. This makes that a failing test
// instead of a silent stale deploy.
const root = path.resolve(__dirname, "../..");

describe("committed Vercel function bundles", () => {
  it("are up to date with the source (run `npm run build:api` if this fails)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aziiki-api-"));
    try {
      await buildVercelApi(tmp);
      for (const [, out] of ENTRIES as Array<[string, string]>) {
        const fresh = fs.readFileSync(path.join(tmp, out), "utf8");
        const committed = fs.readFileSync(path.join(root, out), "utf8");
        expect(committed === fresh, `${out} is stale - run \`npm run build:api\` and commit it`).toBe(true);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);

  it("contain no extensionless relative imports (the thing that crashed production)", () => {
    for (const [, out] of ENTRIES as Array<[string, string]>) {
      const code = fs.readFileSync(path.join(root, out), "utf8");
      expect(/from\s+["']\.\.?\//.test(code), `${out} still imports a relative file`).toBe(false);
      expect(/import\(\s*["']\.\.?\//.test(code), `${out} still dynamically imports a relative file`).toBe(false);
    }
  });

  it("export a default request handler", async () => {
    const mod = await import("../../api/index.js");
    expect(typeof mod.default).toBe("function");
  });
});
