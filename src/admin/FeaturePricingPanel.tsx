import React, { useEffect, useState } from "react";
import { Tag, FloppyDisk as Save, LockKey, UserGear } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminBranding } from "../components/Skeleton";

interface FeatureRow {
  flagKey: string;
  name: string;
  description: string;
  phase: number;
  isPaid: boolean;
  price: number | null;
  currency: string | null;
  billingType: "one_time" | "recurring";
  recurringInterval: "monthly" | "yearly" | null;
  provider: "paystack" | "stripe";
  paymentLink: string | null;
  accessMessage: string | null;
  updatedAt: string | null;
}

function FeatureRowForm({ row, onSaved }: { row: FeatureRow; onSaved: (row: FeatureRow) => void }) {
  const [isPaid, setIsPaid] = useState(row.isPaid);
  const [price, setPrice] = useState(row.price != null ? String(row.price) : "");
  const [currency, setCurrency] = useState(row.currency ?? "GHS");
  const [billingType, setBillingType] = useState<"one_time" | "recurring">(row.billingType);
  const [recurringInterval, setRecurringInterval] = useState<"monthly" | "yearly">(row.recurringInterval ?? "monthly");
  const [provider, setProvider] = useState<"paystack" | "stripe">(row.provider);
  const [paymentLink, setPaymentLink] = useState(row.paymentLink ?? "");
  const [accessMessage, setAccessMessage] = useState(row.accessMessage ?? "");
  const [expanded, setExpanded] = useState(row.isPaid);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const numericPrice = price.trim() === "" ? null : Number(price);
      const updated = await api.admin.featurePricing.save(row.flagKey, {
        isPaid,
        price: numericPrice,
        currency: isPaid ? currency : null,
        billingType,
        recurringInterval: isPaid && billingType === "recurring" ? recurringInterval : null,
        provider,
        paymentLink: paymentLink.trim() || null,
        accessMessage: accessMessage.trim() || null,
      });
      onSaved({ ...row, ...(updated as object) } as FeatureRow);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this feature's pricing.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMakeFree = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await api.admin.featurePricing.remove(row.flagKey);
      setIsPaid(false);
      setPrice("");
      setPaymentLink("");
      setAccessMessage("");
      onSaved({ ...row, isPaid: false, price: null, currency: null, paymentLink: null, accessMessage: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make this feature free again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-900">{row.name}</h4>
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Phase {row.phase}</span>
            {isPaid && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                <LockKey className="w-2.5 h-2.5" /> Paid
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{row.description}</p>
        </div>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">{expanded ? "Hide" : "Edit"}</span>
      </button>

      {expanded && (
        <form onSubmit={handleSave} className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer" />
            This feature requires payment
          </label>

          {isPaid && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Price ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required={isPaid}
                    placeholder="e.g. 25.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Currency</label>
                  <input
                    type="text"
                    maxLength={3}
                    required={isPaid}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs uppercase focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Billing</label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as "one_time" | "recurring")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs"
                  >
                    <option value="one_time">One-time</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>
                {billingType === "recurring" && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Every</label>
                    <select
                      value={recurringInterval}
                      onChange={(e) => setRecurringInterval(e.target.value as "monthly" | "yearly")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs"
                    >
                      <option value="monthly">Month</option>
                      <option value="yearly">Year</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
                  {provider === "stripe" ? "Stripe payment link" : "Paystack Payment Page link"}
                </label>
                <input
                  type="url"
                  placeholder="https://paystack.com/pay/your-page-slug"
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  The price above must match this link's real price exactly - a Paystack payment for this exact
                  amount+currency is matched back to this feature automatically and grants the buyer access right
                  away (see Feature Flags -&gt; per-user overrides). {provider === "stripe" && "Stripe payments aren't matched automatically yet - grant those accounts access manually from Feature Flags."}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Message shown to users</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="What they get for paying, e.g. Includes live investment indices and treasury-bill tracking."
                  value={accessMessage}
                  onChange={(e) => setAccessMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs resize-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "paystack" | "stripe")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs"
                >
                  <option value="paystack">Paystack</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
            </>
          )}

          {error && <p className="text-[10px] text-rose-600">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> {isSaving ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
            {row.isPaid && (
              <button
                type="button"
                onClick={handleMakeFree}
                disabled={isSaving}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer disabled:opacity-50"
              >
                Make free again
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function FeaturePricingPanel() {
  const [rows, setRows] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [grantEmail, setGrantEmail] = useState("");
  const [grantFlagKey, setGrantFlagKey] = useState("");
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [isGranting, setIsGranting] = useState(false);

  const load = () => {
    setLoading(true);
    api.admin.featurePricing
      .list()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    setGrantSuccess(null);
    setIsGranting(true);
    try {
      // Writes the same kind of row a successful Paystack payment does (a
      // user_feature_overrides entry) - a manual grant, a paid one, and a
      // comped one all end up identical and equally real.
      await api.admin.featurePricing.grantAccess(grantFlagKey, grantEmail, true);
      setGrantSuccess(`${grantEmail} now has access to ${rows.find((r) => r.flagKey === grantFlagKey)?.name ?? grantFlagKey}.`);
      setGrantEmail("");
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Couldn't grant access.");
    } finally {
      setIsGranting(false);
    }
  };

  const paidFeatures = rows.filter((r) => r.isPaid);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Tag className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Mark any individual feature as paid, separate from the whole-tier plans in the Payments tab. A paid feature is
          still governed by the usual flag rules (phase/tier, or a per-user override in Feature Flags) - this just adds a
          price and a payment link to it. Changes here take effect immediately for everyone, no redeploy needed. A
          successful Paystack payment for the exact price shown grants that user access automatically.
        </p>
      </div>

      <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminBranding />}>
        <div className="space-y-2.5">
          {rows.map((row) => (
            <FeatureRowForm key={row.flagKey} row={row} onSaved={(updated) => setRows((prev) => prev.map((r) => (r.flagKey === updated.flagKey ? updated : r)))} />
          ))}
        </div>
      </LoadingSwap>

      <form onSubmit={handleGrant} className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <UserGear className="w-3.5 h-3.5" /> Manually grant a user access
        </h3>
        <p className="text-[11px] text-slate-500">For comping an account, a Stripe payment, or fixing a payment the webhook couldn't match automatically.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            placeholder="user@example.com"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
          />
          <select
            required
            value={grantFlagKey}
            onChange={(e) => setGrantFlagKey(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs"
          >
            <option value="">Choose a feature…</option>
            {(paidFeatures.length > 0 ? paidFeatures : rows).map((r) => (
              <option key={r.flagKey} value={r.flagKey}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isGranting}
            className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {isGranting ? "Granting..." : "Grant access"}
          </button>
        </div>
        {grantError && <p className="text-[10px] text-rose-600">{grantError}</p>}
        {grantSuccess && <p className="text-[10px] text-emerald-600">{grantSuccess}</p>}
      </form>
    </div>
  );
}
