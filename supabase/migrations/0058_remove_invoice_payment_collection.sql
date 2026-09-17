-- Removes invoice payment collection ("Request Payment") entirely - Aziiki
-- is a records/reminders tool (who owes you, nudge them), not a payment
-- collector, and letting a business "request payment" through Aziiki
-- created confusion about who's actually handling the money. This table
-- (migration 0020) only ever backed that one feature - it's unrelated to
-- subscription-tier upgrade payments (migration 0042's
-- subscription_payment_events), which are unaffected and still flow
-- through the same Paystack webhook. Empty at the time of this migration -
-- no real payment history is lost.
drop table if exists public.payment_transactions;
