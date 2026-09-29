// Minimal local types for the handful of Workers runtime shapes
// src/cloudflare/index.ts actually uses. Deliberately NOT pulling in
// @cloudflare/workers-types' ambient global declarations here - those
// redeclare Request/Response/fetch globally for the whole program, which
// this project's single shared tsconfig.json (used for the browser app,
// the Node server, and this Worker alike) would then have to reconcile
// against lib.dom.d.ts's own definitions of the same names. Scoped,
// explicit interfaces avoid that entirely - this file only needs three
// simple shapes, not the whole Workers type surface.
export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}
