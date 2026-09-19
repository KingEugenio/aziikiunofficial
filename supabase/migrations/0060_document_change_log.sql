-- Record integrity for saved invoices and receipts.
--
-- Once an invoice has left Draft (or any receipt exists), changing or deleting
-- it is deliberately hard: the API (src/server/documentIntegrity.ts) refuses
-- the change unless the person supplies a reason, and every such change is
-- written here first. The log is append-only - there is no update or delete
-- policy for anyone, so an entry can never be quietly edited or removed
-- afterwards (deleting the whole business/account is the only thing that
-- clears it, via the foreign keys).
--
-- document_id has no foreign key on purpose: the entry for a DELETED document
-- must outlive the document it describes, with a full snapshot in `changes`.
create table public.document_change_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text not null check (document_type in ('invoice', 'receipt')),
  document_id uuid not null,
  document_number text,
  action text not null check (action in ('amended', 'deleted', 'status_changed', 'amendment_failed')),
  reason text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Backstop: even a buggy caller cannot record an amendment or deletion
  -- without a real reason.
  constraint document_change_log_reason_required
    check (action not in ('amended', 'deleted') or char_length(btrim(coalesce(reason, ''))) >= 10)
);

create index document_change_log_document_idx on public.document_change_log (business_id, document_id, created_at desc);

alter table public.document_change_log enable row level security;

create policy "document_change_log_select"
  on public.document_change_log for select
  using (user_id = auth.uid() or public.has_business_access(business_id));

create policy "document_change_log_insert"
  on public.document_change_log for insert
  with check (user_id = auth.uid() and public.has_business_access(business_id));
