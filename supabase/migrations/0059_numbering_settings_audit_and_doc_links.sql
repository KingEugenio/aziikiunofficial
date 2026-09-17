-- Phase D (Document Center follow-ups, flagged as "not done this pass" back
-- in v1.11.0's CHANGELOG entry): a numbering-format settings screen,
-- numbering audit-trail log, and document-relationship display. This
-- migration adds the three pieces of schema those need.

-- 1. Yearly-reset support for document_numbering_sequences (migration
--    0017) - the table already had prefix/padding, just never a reset
--    mechanism. last_reset_year tracks the year next_document_number()
--    last reset this sequence to 1, so it only resets once per year even
--    if called many times within that year.
alter table public.document_numbering_sequences
  add column reset_period text not null default 'never' check (reset_period in ('never', 'yearly')),
  add column last_reset_year integer;

-- 2. Numbering audit-trail log - every reservation (via
--    next_document_number(), redefined below) and every settings change
--    (prefix/padding/reset_period edit, logged from the settings route -
--    see src/server/routes/documentNumbering.ts) gets one row here.
create table public.document_numbering_audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_type text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('reserved', 'settings_changed')),
  formatted_number text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index document_numbering_audit_log_business_type_idx on public.document_numbering_audit_log (business_id, document_type, created_at desc);

alter table public.document_numbering_audit_log enable row level security;

create policy "document_numbering_audit_log_select_own"
  on public.document_numbering_audit_log for select
  using (user_id = auth.uid());

-- Only next_document_number() (below) and the settings route write here -
-- both run as the calling user via req.supabase, so an insert policy is
-- needed (unlike a service-role-only table), scoped the same way every
-- other insert-own table in this schema is.
create policy "document_numbering_audit_log_insert_own"
  on public.document_numbering_audit_log for insert
  with check (user_id = auth.uid());

create or replace function public.next_document_number(
  p_business_id uuid,
  p_document_type text,
  p_default_prefix text default null
)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_number integer;
  v_padding integer;
  v_current_year integer := extract(year from now())::integer;
begin
  insert into public.document_numbering_sequences (user_id, business_id, document_type, prefix, last_reset_year)
  values (auth.uid(), p_business_id, p_document_type, coalesce(p_default_prefix, upper(left(p_document_type, 3))), v_current_year)
  on conflict (business_id, document_type) do nothing;

  -- Yearly reset: only when reset_period = 'yearly' and this sequence
  -- hasn't already been reset this calendar year - a plain "if current
  -- year != last_reset_year" check, evaluated fresh on every call so it
  -- self-corrects the first time a sequence is used in a new year,
  -- without needing a cron job to flip every sequence at midnight Jan 1.
  update public.document_numbering_sequences
  set next_number = 1, last_reset_year = v_current_year
  where business_id = p_business_id
    and document_type = p_document_type
    and reset_period = 'yearly'
    and (last_reset_year is null or last_reset_year <> v_current_year);

  update public.document_numbering_sequences
  set next_number = next_number + 1
  where business_id = p_business_id
    and document_type = p_document_type
  returning next_number - 1, prefix, padding into v_number, v_prefix, v_padding;

  insert into public.document_numbering_audit_log (business_id, document_type, user_id, action, formatted_number)
  values (p_business_id, p_document_type, auth.uid(), 'reserved', v_prefix || '-' || lpad(v_number::text, v_padding, '0'));

  return v_prefix || '-' || lpad(v_number::text, v_padding, '0');
end;
$$;

-- 3. Document-relationship: which quotation an invoice was converted
--    from, if any - lets an invoice show "Created from Estimate EST-0012"
--    instead of appearing to have come from nowhere.
alter table public.invoices
  add column source_quotation_id uuid references public.quotations (id) on delete set null;
