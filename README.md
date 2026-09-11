# Aziiki

The free Business Operating System for African entrepreneurs — income and
expense tracking, invoices/receipts/quotations, customer CRM, and an AI CFO
Advisor, built offline-first for low-connectivity use.

## Run locally

**Prerequisites:** Node.js, a Supabase project, an Upstash Redis instance.

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in every value (Supabase project
   keys and Upstash Redis are required; Gemini/Resend/Paystack are optional
   feature-by-feature - see the comments in `.env.example`).
3. Apply the database migrations in `supabase/migrations/` to your Supabase
   project (via the Supabase CLI, or paste each file into the SQL Editor in
   order).
4. Run the app:
   ```
   npm run dev
   ```

## Admin portal

Visit `/admin` and sign in with an account that has `is_admin = true` set
on its `profiles` row (see the comment on migration `0031_admin_role.sql`
for how to set the first one). From there: toggle features on/off globally
or for specific users, send in-app announcements, run surveys, and manage
the site logo/favicon/shared documents.

## Production deployment notes

- **Content-Security-Policy** is only enabled when `NODE_ENV=production`
  (see `server.ts`) - the dev server needs a much looser policy for Vite's
  HMR/eval-based module transform, which the production build never uses.
  The policy is generated from `SUPABASE_URL` at server startup, so it
  automatically covers whichever Supabase project you deploy against.
- **`VITE_*` environment variables are baked in at build time**, not read
  at runtime - `npm run build` must be run with `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` already set in the shell/CI environment, or the
  built app will fail immediately with a "Missing VITE_SUPABASE_URL" error
  in the browser. Setting them only in the server's runtime environment
  (e.g. a platform's dashboard env vars, added after the build step) is not
  enough.
