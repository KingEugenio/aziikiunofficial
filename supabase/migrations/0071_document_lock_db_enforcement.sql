-- Closes the "locked invoices/receipts are enforced by the API only" gap
-- from the September 24 project audit: someone technical, signed in, could
-- call Supabase directly with their own login token and skip the Express
-- rules in src/server/documentIntegrity.ts entirely (no reason required, no
-- change_change_log entry, even the invoice number could be rewritten).
-- This mirrors that same logic as database triggers, so the rule holds no
-- matter which door someone comes through.
--
-- How the correlation works: the app already writes a document_change_log
-- row (with a real, length-checked reason) BEFORE it changes the document
-- (see documentIntegrity.ts's logDocumentChange, called first in every
-- PATCH/DELETE handler). These triggers just require that a matching,
-- genuine log entry was written in the last 30 seconds before allowing the
-- write to go through - closing the "no logging at all" bypass without
-- needing the two separate PostgREST requests (log insert, then document
-- update) to share a database transaction, which they don't.
--
-- Known remaining gap, on purpose: inserting brand-new invoice_items rows
-- into a locked invoice without deleting the existing ones first is not
-- blocked here (only UPDATE/DELETE on invoice_items is). Every real
-- amendment path always deletes-then-reinserts (invoices.ts), so this still
-- closes the way anyone can silently ALTER an existing line's price or
-- quantity; it does not stop someone from ADDING extra junk rows. Blocking
-- INSERT too would also have to allow the very first insert of items for a
-- brand-new invoice created directly with a non-Draft status, which happens
-- before any document_change_log entry could exist - distinguishing those
-- two cases reliably needs more machinery than this pass is scoped for.

create or replace function public.has_recent_valid_change_log(
  p_document_type text,
  p_document_id uuid,
  p_actions text[]
) returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.document_change_log
    where document_type = p_document_type
      and document_id = p_document_id
      and action = any(p_actions)
      and char_length(btrim(coalesce(reason, ''))) >= 10
      and created_at > now() - interval '30 seconds'
  );
$$;

create or replace function public.enforce_invoice_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  locked boolean;
  workflow_only boolean;
  allowed_next text[];
begin
  locked := OLD.status <> 'Draft';

  if not locked then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'UPDATE' and NEW.invoice_number is distinct from OLD.invoice_number then
    raise exception 'A saved invoice''s number can''t be changed - it identifies the record.'
      using errcode = '23514';
  end if;

  if TG_OP = 'DELETE' then
    if not public.has_recent_valid_change_log('invoice', OLD.id, array['deleted']) then
      raise exception 'This invoice is locked. Deleting it needs a logged reason.'
        using errcode = '23514';
    end if;
    return OLD;
  end if;

  -- Pure forward workflow (status progressing, or a part-payment only going
  -- up) is allowed without a reason, same as documentIntegrity.ts's
  -- evaluateInvoiceChange - anything else on a locked invoice needs one.
  workflow_only :=
    NEW.customer_id is not distinct from OLD.customer_id
    and NEW.custom_client_name is not distinct from OLD.custom_client_name
    and NEW.date is not distinct from OLD.date
    and NEW.due_date is not distinct from OLD.due_date
    and NEW.discount is not distinct from OLD.discount
    and NEW.tax_rate is not distinct from OLD.tax_rate
    and NEW.currency is not distinct from OLD.currency
    and NEW.exchange_rate_to_business_currency is not distinct from OLD.exchange_rate_to_business_currency;

  if workflow_only and NEW.status is distinct from OLD.status then
    allowed_next := case OLD.status
      when 'Draft' then array['Sent', 'Paid', 'Overdue']
      when 'Sent' then array['Paid', 'Overdue']
      when 'Overdue' then array['Paid']
      else array[]::text[]
    end;
    if not (NEW.status = any(allowed_next)) then
      workflow_only := false;
    end if;
  end if;

  if workflow_only and NEW.partial_paid_amount is distinct from OLD.partial_paid_amount then
    if NEW.partial_paid_amount < OLD.partial_paid_amount then
      workflow_only := false;
    end if;
  end if;

  if not workflow_only and not public.has_recent_valid_change_log('invoice', OLD.id, array['amended']) then
    raise exception 'This invoice is locked. Changing it needs a logged reason.'
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

create trigger invoices_enforce_lock
  before update or delete on public.invoices
  for each row execute function public.enforce_invoice_lock();

-- Receipts have no Draft state - they are locked from the moment they
-- exist, and unlike invoices there is no workflow-only exception (see
-- receipts.ts: every change needs a reason, unconditionally).
create or replace function public.enforce_receipt_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and NEW.receipt_number is distinct from OLD.receipt_number then
    raise exception 'A saved receipt''s number can''t be changed - it identifies the record.'
      using errcode = '23514';
  end if;

  if TG_OP = 'DELETE' then
    if not public.has_recent_valid_change_log('receipt', OLD.id, array['deleted']) then
      raise exception 'This receipt is locked. Deleting it needs a logged reason.'
        using errcode = '23514';
    end if;
    return OLD;
  end if;

  if not public.has_recent_valid_change_log('receipt', OLD.id, array['amended']) then
    raise exception 'This receipt is locked. Changing it needs a logged reason.'
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

create trigger receipts_enforce_lock
  before update or delete on public.receipts
  for each row execute function public.enforce_receipt_lock();

-- Closes the same gap one level down: an invoice's line items live in their
-- own table, updated via delete-then-reinsert (never a plain UPDATE) by the
-- real app - so guarding the invoices row alone still leaves a bypasser free
-- to rewrite a locked invoice's item quantities/rates directly. See the
-- INSERT note above for why only UPDATE/DELETE are covered here.
create or replace function public.enforce_invoice_items_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_status text;
begin
  select status into invoice_status from public.invoices where id = OLD.invoice_id;

  if invoice_status is not null and invoice_status <> 'Draft' then
    if not public.has_recent_valid_change_log('invoice', OLD.invoice_id, array['amended']) then
      raise exception 'This invoice is locked. Changing its items needs a logged reason.'
        using errcode = '23514';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger invoice_items_enforce_lock
  before update or delete on public.invoice_items
  for each row execute function public.enforce_invoice_items_lock();
