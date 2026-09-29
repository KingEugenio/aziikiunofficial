// Cloudflare-Workers-only replacement for iconv-lite (aliased in
// wrangler.jsonc, applies to the Cloudflare build only - Vercel and local
// dev keep using the real package unmodified).
//
// Why this exists: body-parser (a dependency of Express's express.json())
// requires iconv-lite at module load time, and iconv-lite's own top-level
// code calls a `require_streams()` helper that isn't available under
// Workers' node:stream compatibility shim - a real, currently-unresolved
// gap (cloudflare/workers-sdk#9309), not a bug in this app. It crashes the
// whole Worker before it can handle a single request.
//
// The real iconv-lite exists to decode a request body in whatever charset
// its Content-Type header names (ISO-8859-1, Shift-JIS, dozens of legacy
// encodings). Aziiki's API only ever sends/receives JSON, which is always
// UTF-8 - it has never needed anything else. This stub implements just the
// UTF-8 path body-parser/raw-body actually call (see node_modules/raw-body/
// index.js and node_modules/body-parser/lib/read.js), using Node's own
// built-in StringDecoder - not iconv-lite's - so it sidesteps the broken
// stream shim entirely.
import { StringDecoder } from "node:string_decoder";

function assertUtf8(encoding: unknown): void {
  const normalized = String(encoding ?? "utf-8")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (normalized !== "utf8" && normalized !== "utf" && normalized !== "u8") {
    throw new Error(
      `This Cloudflare Worker build only supports utf-8 request bodies (got "${String(encoding)}") - see src/cloudflare/iconvLiteStub.ts.`
    );
  }
}

export function encodingExists(encoding: unknown): boolean {
  try {
    assertUtf8(encoding);
    return true;
  } catch {
    return false;
  }
}

export function decode(buffer: Buffer | Uint8Array, encoding: unknown): string {
  assertUtf8(encoding);
  return Buffer.isBuffer(buffer) ? buffer.toString("utf8") : Buffer.from(buffer).toString("utf8");
}

export function getDecoder(encoding: unknown): StringDecoder {
  assertUtf8(encoding);
  return new StringDecoder("utf8");
}

export default { encodingExists, decode, getDecoder };
