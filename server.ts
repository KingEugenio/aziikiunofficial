// Local dev / Render / Railway / Fly entry point. This process actually
// listens on a port and stays running — it's NOT what runs on Vercel (see
// api/index.ts and vercel.json for that). The route/middleware setup itself
// lives in src/server/app.ts and is shared by both entry points so it can
// never drift between "how it runs locally" and "how it runs on Vercel".
import "dotenv/config";
import { env } from "./src/server/env";

import path from "path";
import fs from "fs";
import mime from "mime-types";
import express from "express";
import { createServer as createViteServer } from "vite";

import { createApp } from "./src/server/app";
import { runOverdueInvoiceSweep } from "./src/server/notifications/overdueInvoiceSweep";

async function startServer() {
  const app = createApp();

  // ---------------------------------------------------------------------
  // Vite (dev) / static build (prod) - unchanged from before. This block
  // only makes sense for a long-running process serving its own files; the
  // Vercel entry point never runs this because Vercel's CDN serves dist/
  // directly (see vercel.json's outputDirectory).
  // ---------------------------------------------------------------------
  if (env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }

      const requestedPath = decodeURIComponent(req.path);
      const filePath = path.join(distPath, requestedPath);
      if (!filePath.startsWith(distPath)) {
        next();
        return;
      }

      const acceptsBrotli = req.acceptsEncodings("br") === "br";
      const acceptsGzip = req.acceptsEncodings("gzip") === "gzip";

      const tryEncoding = (ext: string, encoding: string, contentType: string | false) => {
        const compressedPath = `${filePath}${ext}`;
        if (fs.existsSync(compressedPath)) {
          res.set("Content-Encoding", encoding);
          res.set("Vary", "Accept-Encoding");
          if (contentType) res.type(contentType);
          res.sendFile(compressedPath);
          return true;
        }
        return false;
      };

      if (acceptsBrotli && tryEncoding(".br", "br", mime.lookup(filePath))) return;
      if (acceptsGzip && tryEncoding(".gz", "gzip", mime.lookup(filePath))) return;
      next();
    });

    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`[aziiki] server listening on http://0.0.0.0:${env.PORT} [env: ${env.NODE_ENV}]`);
  });

  // Overdue-invoice reminders run on a plain timer within this same
  // long-lived process. This ONLY works because this file keeps a process
  // alive with app.listen() — it would silently never fire on Vercel, which
  // is exactly why Vercel gets its own Cron-triggered endpoint instead
  // (see api/cron/overdue-sweep.ts) rather than reusing this timer.
  const OVERDUE_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    runOverdueInvoiceSweep().catch((err) => console.error("[overdue sweep] failed:", err));
  }, 30_000);
  setInterval(() => {
    runOverdueInvoiceSweep().catch((err) => console.error("[overdue sweep] failed:", err));
  }, OVERDUE_SWEEP_INTERVAL_MS);
}

startServer();
