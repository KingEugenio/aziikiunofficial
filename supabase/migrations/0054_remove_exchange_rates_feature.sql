-- Removes the standalone "Exchange Rates" feature entirely, per explicit
-- product decision: the settings screen (ExchangeRateSettings.tsx), its
-- dedicated CRUD route (/api/exchange-rates), the "auto-fill from a saved
-- rate" convenience in the invoice/receipt/quotation/PO builders, the
-- custom-display-currency report mode, and the feature flag that gated
-- all of it (exchange_rate_live_switching).
--
-- Deliberately NOT touched: the exchange_rate_to_business_currency column
-- on invoices/receipts/quotations/purchase_orders/transactions - that's a
-- plain per-document number the user types in manually, used in the
-- business-currency total calculation on that one document. It has
-- nothing to do with this table and stays exactly as it was.
drop table if exists public.business_exchange_rates;

delete from public.feature_flags where key = 'exchange_rate_live_switching';
