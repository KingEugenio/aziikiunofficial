// Ambient declaration for Cloudflare's built-in "cloudflare:node" module
// (bridges a real Node http.Server into a Workers fetch handler - see
// index.ts). This is the only ambient/global declaration this Cloudflare
// integration adds to the project: a module specifier no other file
// imports, so there's no realistic name-collision risk the way declaring
// @cloudflare/workers-types' full global surface would have.
declare module "cloudflare:node" {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };
}
