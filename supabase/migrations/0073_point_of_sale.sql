-- Point of Sale: a fast, itemized checkout for a shop selling physical
-- stock over a counter (barcode/SKU lookup, a running cart, instant
-- receipt) - distinct from the existing Invoice/Receipt/Estimate builder,
-- which is built around typing out a formal document by hand.
--
-- receipt_items mirrors invoice_items (migration 0007), with one addition:
-- inventory_id, so a sale can decrement the EXACT inventory row that was
-- rung up (by SKU/barcode) instead of invoices.ts's existing fuzzy
-- description-vs-name text matching. `on delete set null` so a receipt's
-- own sale history survives even if the inventory item is later deleted;
-- `sku` is a snapshot at time of sale for the same reason (the item's SKU
-- may change or the row may vanish, the receipt itself must not).
create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  inventory_id uuid references public.inventory (id) on delete set null,
  sku text,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  rate numeric(14, 2) not null default 0 check (rate >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index receipt_items_receipt_id_idx on public.receipt_items (receipt_id);
create index receipt_items_user_id_idx on public.receipt_items (user_id);
create index receipt_items_inventory_id_idx on public.receipt_items (inventory_id);

alter table public.receipt_items enable row level security;

create policy "receipt_items_select_own" on public.receipt_items for select using (user_id = auth.uid());
create policy "receipt_items_insert_own" on public.receipt_items for insert with check (user_id = auth.uid());
-- No update policy on purpose: a rung-up sale's line items are immutable -
-- v1 of Point of Sale amends a mistaken sale the same way any other locked
-- receipt is amended (delete the whole receipt with a reason, ring it up
-- again), not by editing individual items after the fact.
create policy "receipt_items_delete_own" on public.receipt_items for delete using (user_id = auth.uid());

-- No enforce_business_ownership trigger here, same as invoice_items
-- (migration 0007): this table has no business_id column of its own - it
-- reaches a business only via receipt_id, so there is nothing for that
-- trigger to check.

-- Same gap as migration 0071 closed for invoice_items, for the same reason:
-- receipt_items rows are only ever meant to be removed as a whole, by
-- deleting the parent receipt with a logged reason (which cascades here
-- automatically) - a bypasser calling Supabase directly could otherwise
-- delete individual sold items straight out of a locked receipt's history
-- with RLS alone doing nothing to stop it. Reuses the same
-- has_recent_valid_change_log helper 0071 already defined; a cascaded
-- delete from a receipt's own (already-logged, already-checked) deletion
-- still fires this trigger and passes, since that log entry already exists.
create or replace function public.enforce_receipt_items_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_recent_valid_change_log('receipt', OLD.receipt_id, array['deleted']) then
    raise exception 'This receipt is locked. Removing its items needs a logged reason - delete the whole receipt instead.'
      using errcode = '23514';
  end if;
  return OLD;
end;
$$;

create trigger receipt_items_enforce_lock
  before delete on public.receipt_items
  for each row execute function public.enforce_receipt_items_lock();

-- Phase 3 (Pro-tier ceiling by default) and NOT enabled_default - this is
-- meant to be sold as its own priced add-on via /admin -> Feature Pricing
-- (built earlier this session), independent of the Basic/Standard/Pro
-- whole-tier prices, since it targets a different kind of customer (a shop
-- with a physical counter and real inventory volume) than the base product.
insert into public.feature_flags (key, name, description, phase, enabled_default) values
  ('retail_pos', 'Point of Sale', 'A fast, itemized checkout for a shop selling physical stock over a counter - scan or look up items by SKU, build a cart, and complete the sale as an itemized receipt with exact inventory decrement.', 3, false)
on conflict (key) do nothing;
