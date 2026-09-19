// Bundles the Vercel serverless functions into self-contained files.
//
// Why this exists: package.json is "type": "module" and this codebase imports
// its own TypeScript with extensionless relative paths ("./routes/auth"),
// which TypeScript's bundler resolution allows but Node's ES-module loader
// does NOT. Vercel compiles each file under api/ on its own and leaves those
// imports as-is, so the deployed function crashed on its very first request
// with `Cannot find module '/var/task/src/server/app'` - every /api call
// returned a 500. Bundling with esbuild resolves every internal import at
// build time; only third-party packages stay external (Vercel installs those).
//
// Sources live in src/vercel/, outputs are api/index.js and api/cron/*.js.
// The outputs are COMMITTED (Vercel finds functions from the repository files,
// so a file that only exists after the build step isn't reliably picked up),
// and src/vercel/vercelApiBundle.test.ts fails if they go stale.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const ENTRIES = [
  ["src/vercel/index.ts", "api/index.js"],
  ["src/vercel/cron/overdue-sweep.ts", "api/cron/overdue-sweep.js"],
  ["src/vercel/cron/rate-limit-cleanup.ts", "api/cron/rate-limit-cleanup.js"],
];

/** Builds every function into `outRoot` (default: the project root). */
export async function buildVercelApi(outRoot = root) {
  for (const [entry, out] of ENTRIES) {
    await build({
      entryPoints: [path.join(root, entry)],
      outfile: path.join(outRoot, out),
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node20",
      packages: "external",
      logLevel: "warning",
      legalComments: "none",
      banner: {
        js: `// GENERATED FILE - do not edit. Source: ${entry}. Rebuild with \`npm run build:api\`.`,
      },
    });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildVercelApi();
  console.log(`Built ${ENTRIES.length} Vercel functions:`, ENTRIES.map(([, out]) => out).join(", "));
}
