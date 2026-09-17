-- Replaces Upstash Redis as the rate-limiting backend with plain Postgres,
-- on this same Supabase project - no new service, no new signup, no new
-- API key. Same fixed-window counter semantics as the Redis version
-- (src/server/rateLimitStore.ts): a key's count increments on every hit
-- within its window; the window itself is only (re)started when the key
-- is brand new or its previous window has already expired.
--
-- RLS is enabled with no policies at all - this table is never read or
-- written by an end user's own request, only by the server's service-role
-- client (see src/server/rateLimitStorePostgres.ts), the same narrow
-- pattern already used for security_events. There is nothing here an RLS
-- policy needs to allow.
create table public.rate_limit_counters (
  key text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);

create index rate_limit_counters_expires_at_idx on public.rate_limit_counters (expires_at);

alter table public.rate_limit_counters enable row level security;

-- Atomic increment-or-reset in one round trip, so two concurrent requests
-- hitting the same key can never both read a stale count and both "win" a
-- race past the limit - the ON CONFLICT clause is a single atomic
-- Postgres operation, same guarantee Redis's INCR gave.
create or replace function public.rate_limit_increment(p_key text, p_window_ms bigint)
returns table(total_hits integer, reset_time timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := (p_window_ms || ' milliseconds')::interval;
begin
  return query
  insert into public.rate_limit_counters as c (key, count, expires_at)
  values (p_key, 1, v_now + v_window)
  on conflict (key) do update
    set count = case when c.expires_at <= v_now then 1 else c.count + 1 end,
        expires_at = case when c.expires_at <= v_now then v_now + v_window else c.expires_at end
  returning c.count, c.expires_at;
end;
$$;

-- Mirrors UpstashRateLimitStore.decrement: express-rate-limit calls this to
-- give back a count when a request should not have counted after all
-- (e.g. skipSuccessfulRequests-style logic). Deletes the row once it hits
-- zero rather than leaving a zero-count row around forever.
create or replace function public.rate_limit_decrement(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rate_limit_counters set count = greatest(count - 1, 0) where key = p_key;
  delete from public.rate_limit_counters where key = p_key and count <= 0;
end;
$$;

-- Unlike Redis's PEXPIRE, an expired Postgres row doesn't disappear on its
-- own - it just stops mattering (rate_limit_increment treats an expired
-- row as a fresh window). Without periodic cleanup, a table with one row
-- per unique key (IP+email combos, etc.) would grow forever. Called from
-- a daily cron (api/cron/rate-limit-cleanup.ts), same pattern as the
-- existing overdue-invoice sweep.
create or replace function public.rate_limit_cleanup_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_counters where expires_at < clock_timestamp() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
