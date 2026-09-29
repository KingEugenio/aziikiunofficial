-- Fixes a real regression introduced by migration 0071: the lock-enforcement
-- triggers on invoices/receipts/invoice_items/receipt_items correctly refuse
-- an unlogged DELETE of a single document, but they also fired - and
-- wrongly refused - when a WHOLE BUSINESS or ACCOUNT is deleted and its
-- invoices/receipts cascade-delete along with it (DELETE /api/auth/account,
-- "deleting your account permanently removes it" per the Terms of Service).
-- There is no integrity value in demanding a reason to delete a receipt
-- that is disappearing along with its entire business anyway - the rule
-- exists to stop a SPECIFIC document being quietly removed while
-- everything else stays intact, not to make an account permanently
-- undeletable the moment it has any invoice/receipt history.
--
-- The fix: on the DELETE path, first check whether the parent row this
-- document depends on already stopped existing (which is exactly what
-- ON DELETE CASCADE means, by the time the child row's own trigger fires -
-- the referenced row's own deletion is what triggered the cascade action in
-- the first place, so it is already gone within this same transaction). If
-- so, this is a whole-business/whole-account removal in progress, not a
-- standalone delete - let it through with no reason required.

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
    if not exists (select 1 from public.businesses where id = OLD.business_id) then
      return OLD;
    end if;
    if not public.has_recent_valid_change_log('invoice', OLD.id, array['deleted']) then
      raise exception 'This invoice is locked. Deleting it needs a logged reason.'
        using errcode = '23514';
    end if;
    return OLD;
  end if;

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
    if not exists (select 1 from public.businesses where id = OLD.business_id) then
      return OLD;
    end if;
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

create or replace function public.enforce_invoice_items_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_status text;
begin
  -- The parent invoice already being gone means this is a cascade from a
  -- whole invoice/business/account deletion, not a standalone items edit.
  select status into invoice_status from public.invoices where id = OLD.invoice_id;
  if invoice_status is null then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  if invoice_status <> 'Draft' then
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

create or replace function public.enforce_receipt_items_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The parent receipt already being gone means this is a cascade from a
  -- whole receipt/business/account deletion, not a standalone items delete.
  if not exists (select 1 from public.receipts where id = OLD.receipt_id) then
    return OLD;
  end if;

  if not public.has_recent_valid_change_log('receipt', OLD.receipt_id, array['deleted']) then
    raise exception 'This receipt is locked. Removing its items needs a logged reason - delete the whole receipt instead.'
      using errcode = '23514';
  end if;
  return OLD;
end;
$$;
