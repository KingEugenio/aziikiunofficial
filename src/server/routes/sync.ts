import { Router, type Request, type Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cached } from "../redis";

const SYNC_CACHE_TTL_SECONDS = 30;

/**
 * One aggregate read for the initial app load - replaces the old single
 * Firestore document fetch (fetchUserDashboardData). Under the hood it's
 * still many relational tables (so there's no 1MB-document ceiling and every
 * table still has real RLS), we just fan the reads out in parallel and cache
 * the assembled result for a short window to avoid re-querying Postgres on
 * every page refresh within that window.
 */
export const syncRouter = Router();

async function loadAll(supabase: SupabaseClient) {
  const [
    businesses,
    partners,
    shareholders,
    roles,
    auditLogs,
    personalAccounts,
    personalBudgets,
    customers,
    transactions,
    invoices,
    invoiceItems,
    receipts,
    quotations,
    quotationItems,
    investments,
    assets,
    goals,
    debts,
    inventory,
  ] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at", { ascending: true }),
    supabase.from("business_partners").select("*"),
    supabase.from("business_shareholders").select("*"),
    supabase.from("business_roles").select("*"),
    supabase.from("business_audit_logs").select("*").order("occurred_at", { ascending: false }).limit(500),
    supabase.from("personal_accounts").select("*"),
    supabase.from("personal_budgets").select("*"),
    // Same invisible-default-limit reasoning as invoices/receipts/
    // quotations below - without an explicit .limit(), this is silently
    // subject to whatever PostgREST's default row cap is. A customer
    // falling out of this list would show as "Direct Buyer" on any of
    // their older invoices/receipts instead of their real name, even if
    // the documents themselves were still visible - just as real a data
    // problem as a document disappearing outright.
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(50000),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(20000),
    // invoices/receipts/quotations previously had NO explicit .limit() at
    // all here, which meant they were silently subject to whatever
    // PostgREST's default per-request row cap is (commonly 1000) - an
    // invisible limit that wasn't even visible in this code, and would
    // silently drop the OLDEST documents (since nothing else orders or
    // pages through the remainder) once a business's history grew past
    // it. Made explicit and generous instead: high enough that a genuinely
    // established SME's full multi-year document history fits comfortably,
    // while still being a real bound so a single request can't be made
    // arbitrarily large. True unlimited scale (tens of thousands of
    // documents and beyond) would need real cursor-based pagination in the
    // Document Center rather than one bulk fetch - flagged as a future
    // improvement, not solved here.
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(50000),
    supabase.from("invoice_items").select("*").limit(200000),
    supabase.from("receipts").select("*").order("created_at", { ascending: false }).limit(50000),
    supabase.from("quotations").select("*").order("created_at", { ascending: false }).limit(50000),
    supabase.from("quotation_items").select("*").limit(200000),
    supabase.from("investments").select("*").order("created_at", { ascending: false }),
    supabase.from("assets").select("*").order("created_at", { ascending: false }),
    supabase.from("goals").select("*").order("created_at", { ascending: false }),
    supabase.from("debts").select("*").order("created_at", { ascending: false }),
    supabase.from("inventory").select("*").order("created_at", { ascending: false }),
  ]);

  const namedResults: Array<[string, { data: unknown; error: unknown }]> = [
    ["businesses", businesses], ["business_partners", partners], ["business_shareholders", shareholders],
    ["business_roles", roles], ["business_audit_logs", auditLogs], ["personal_accounts", personalAccounts],
    ["personal_budgets", personalBudgets], ["customers", customers], ["transactions", transactions],
    ["invoices", invoices], ["invoice_items", invoiceItems], ["receipts", receipts], ["quotations", quotations],
    ["quotation_items", quotationItems], ["investments", investments], ["assets", assets], ["goals", goals],
    ["debts", debts], ["inventory", inventory],
  ];
  for (const [tableName, result] of namedResults) {
    if (result.error) {
      // Attach which table this actually was - the raw Postgres/PostgREST
      // error alone (e.g. "Could not find the table 'public.customers' in
      // the schema cache") doesn't say WHICH of the ~19 tables queried here
      // it came from, which matters a lot when diagnosing "did I forget to
      // run a migration" vs. "is this an RLS problem".
      const err = result.error as { message?: string; code?: string };
      const wrapped = new Error(`[table: ${tableName}] ${err.message ?? "Unknown error"}`);
      (wrapped as any).code = err.code;
      (wrapped as any).table = tableName;
      throw wrapped;
    }
  }

  const itemsByInvoice = new Map<string, any[]>();
  for (const item of invoiceItems.data ?? []) {
    const list = itemsByInvoice.get(item.invoice_id) ?? [];
    list.push(item);
    itemsByInvoice.set(item.invoice_id, list);
  }
  const itemsByQuotation = new Map<string, any[]>();
  for (const item of quotationItems.data ?? []) {
    const list = itemsByQuotation.get(item.quotation_id) ?? [];
    list.push(item);
    itemsByQuotation.set(item.quotation_id, list);
  }

  return {
    businesses: (businesses.data ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      industry: b.industry ?? "",
      logo: b.logo ?? "",
      primaryColor: b.primary_color ?? "",
      taxRate: Number(b.tax_rate),
      currency: b.currency,
      description: b.description ?? "",
      businessType: b.business_type ?? undefined,
      allowFinancialApprovals: b.allow_financial_approvals,
      isPersonal: b.is_personal,
      locked: b.locked,
      partners: (partners.data ?? [])
        .filter((p: any) => p.business_id === b.id)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          ownershipPercentage: Number(p.ownership_percentage),
          capitalContribution: Number(p.capital_contribution),
          withdrawals: Number(p.withdrawals),
        })),
      shareholders: (shareholders.data ?? [])
        .filter((s: any) => s.business_id === b.id)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          sharesCount: s.shares_count,
          equityValue: Number(s.equity_value),
          capitalContribution: Number(s.capital_contribution),
        })),
      roles: (roles.data ?? [])
        .filter((r: any) => r.business_id === b.id)
        .map((r: any) => ({ id: r.id, name: r.name, email: r.email, role: r.role })),
      auditLogs: (auditLogs.data ?? [])
        .filter((a: any) => a.business_id === b.id)
        .map((a: any) => ({ id: a.id, timestamp: a.occurred_at, userName: a.user_name, action: a.action, details: a.details ?? "" })),
      accounts: (personalAccounts.data ?? [])
        .filter((a: any) => a.business_id === b.id)
        .map((a: any) => ({ id: a.id, name: a.name, type: a.type, initialBalance: Number(a.initial_balance), balance: Number(a.balance) })),
      budgets: (personalBudgets.data ?? [])
        .filter((bd: any) => bd.business_id === b.id)
        .map((bd: any) => ({ category: bd.category, limitAmount: Number(bd.limit_amount) })),
    })),
    customers: (customers.data ?? []).map((c: any) => ({
      id: c.id,
      businessId: c.business_id,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
      category: c.category ?? "",
      avatarColor: c.avatar_color ?? "bg-slate-500",
    })),
    transactions: (transactions.data ?? []).map((t: any) => ({
      id: t.id,
      businessId: t.business_id,
      date: t.date,
      type: t.type,
      category: t.category,
      amount: Number(t.amount),
      description: t.description ?? "",
      paymentMethod: t.payment_method,
      customerId: t.customer_id ?? undefined,
      proofUri: t.proof_uri ?? undefined,
    })),
    invoices: (invoices.data ?? []).map((inv: any) => ({
      id: inv.id,
      businessId: inv.business_id,
      invoiceNumber: inv.invoice_number,
      customerId: inv.customer_id ?? undefined,
      customClientName: inv.custom_client_name ?? undefined,
      date: inv.date,
      dueDate: inv.due_date,
      items: (itemsByInvoice.get(inv.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((i: any) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate) })),
      discount: Number(inv.discount),
      taxRate: Number(inv.tax_rate),
      status: inv.status,
      partialPaidAmount: Number(inv.partial_paid_amount),
      sourceQuotationId: inv.source_quotation_id ?? undefined,
    })),
    receipts: (receipts.data ?? []).map((r: any) => ({
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id ?? undefined,
      customClientName: r.custom_client_name ?? undefined,
      invoiceId: r.invoice_id ?? undefined,
      receiptNumber: r.receipt_number,
      date: r.date,
      description: r.description ?? "",
      amountPaid: Number(r.amount_paid),
      paymentMethod: r.payment_method,
    })),
    quotations: (quotations.data ?? []).map((q: any) => ({
      id: q.id,
      businessId: q.business_id,
      quoteNumber: q.quote_number,
      customerId: q.customer_id ?? undefined,
      customClientName: q.custom_client_name ?? undefined,
      date: q.date,
      validUntil: q.valid_until,
      items: (itemsByQuotation.get(q.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((i: any) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate) })),
      discount: Number(q.discount),
      totalAmount: Number(q.total_amount),
      status: q.status,
    })),
    investments: (investments.data ?? []).map((i: any) => ({
      id: i.id,
      businessId: i.business_id ?? undefined,
      type: i.type,
      name: i.name,
      institution: i.institution ?? "",
      value: Number(i.value),
      amountInvested: Number(i.amount_invested),
      maturityDate: i.maturity_date ?? undefined,
      expectedReturnRate: Number(i.expected_return_rate),
      dateAcquired: i.date_acquired,
      notes: i.notes ?? "",
    })),
    assets: (assets.data ?? []).map((a: any) => ({
      id: a.id,
      businessId: a.business_id ?? undefined,
      name: a.name,
      category: a.category,
      purchaseDate: a.purchase_date,
      purchasePrice: Number(a.purchase_price),
      currentValue: Number(a.current_value),
      depreciationMethod: a.depreciation_method ?? undefined,
      usefulLifeYears: a.useful_life_years ?? undefined,
      salvageValue: a.salvage_value !== null ? Number(a.salvage_value) : undefined,
      maintenanceLastDate: a.maintenance_last_date ?? undefined,
      maintenanceNextDate: a.maintenance_next_date ?? undefined,
      maintenanceStatus: a.maintenance_status ?? undefined,
      maintenanceNotes: a.maintenance_notes ?? undefined,
      documentsNotes: a.documents_notes ?? undefined,
      notes: a.notes ?? "",
    })),
    goals: (goals.data ?? []).map((g: any) => ({
      id: g.id,
      businessId: g.business_id,
      type: g.type,
      name: g.name,
      currentAmount: Number(g.current_amount),
      targetAmount: Number(g.target_amount),
      deadline: g.deadline,
    })),
    debts: (debts.data ?? []).map((d: any) => ({
      id: d.id,
      businessId: d.business_id ?? undefined,
      creditor: d.creditor,
      amount: Number(d.amount),
      interestRate: Number(d.interest_rate),
      dueDate: d.due_date,
      type: d.type,
    })),
    inventory: (inventory.data ?? []).map((i: any) => ({
      id: i.id,
      businessId: i.business_id,
      name: i.name,
      sku: i.sku ?? "",
      quantity: Number(i.quantity),
      minStockAlert: Number(i.min_stock_alert),
      unitCost: Number(i.unit_cost),
      unitPrice: Number(i.unit_price),
      supplierName: i.supplier_name ?? "",
      supplierContact: i.supplier_contact ?? "",
    })),
  };
}

syncRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  try {
    const data = await cached(`cache:sync:${userId}`, SYNC_CACHE_TTL_SECONDS, () => loadAll(supabase));
    res.json({ data });
  } catch (err: any) {
    console.error("[sync] failed to load dashboard state:", err);
    // Include which table and the underlying Postgres/PostgREST message in
    // the response itself, not just the server console - this is the
    // person's own database they're debugging, not a stranger's, so this
    // detail is genuinely useful rather than an information-disclosure risk.
    // A generic "please try again shortly" gives zero signal for something
    // like a genuinely missing table, which no amount of retrying fixes.
    const detail = err?.message;
    res.status(500).json({
      error: detail
        ? `Failed to load your data: ${detail}`
        : "Failed to load your data. Please try again shortly.",
    });
  }
});
