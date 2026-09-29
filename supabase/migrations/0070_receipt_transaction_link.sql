-- Closes the "amending a receipt doesn't touch the matching ledger entry"
-- gap from the September 24 project audit. Creating a receipt already logs
-- a companion income transaction (receipts.ts POST), but nothing linked the
-- two rows together, so an amendment (or deletion) of the receipt had no way
-- to find "the" transaction to keep in sync - it just went stale. This adds
-- that link; the server (receipts.ts) is updated separately to populate it
-- on create and use it on amend/delete.
alter table public.receipts add column transaction_id uuid references public.transactions (id) on delete set null;

create index receipts_transaction_id_idx on public.receipts (transaction_id);
