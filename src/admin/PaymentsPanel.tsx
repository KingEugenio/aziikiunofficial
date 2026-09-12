import React, { useEffect, useState } from "react";
import { CreditCard, FloppyDisk as Save, UserGear, Plus, Trash as Trash2 } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminBranding } from "../components/Skeleton";

interface PlanRow {
  tier: string;
  currency: string;
  paystackLink: string | null;
  priceMinorUnits: number | null;
  provider: "paystack" | "stripe";
}

const TIER_LABEL: Record<string, string> = { standard: "Standard", pro: "Pro" };

function CurrencyRow({
  plan,
  onSaved,
  onRemoved,
  removable,
}: {
  plan: PlanRow;
  onSaved: (row: PlanRow) => void;
  onRemoved: () => void;
  removable: boolean;
}) {
  const [link, setLink] = useState(plan.paystackLink ?? "");
  // Priced in the currency's main unit (e.g. GHS, not pesewas) for a human
  // to type - converted to/from minor units at the API boundary, matching
  // how Paystack/Stripe themselves report amounts.
  const [price, setPrice] = useState(plan.priceMinorUnits != null ? (plan.priceMinorUnits / 100).toString() : "");
  const [provider, setProvider] = useState<"paystack" | "stripe">(plan.provider);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const priceMinorUnits = price.trim() === "" ? null : Math.round(Number(price) * 100);
      await api.admin.subscriptionPlans.save(plan.tier as "standard" | "pro", plan.currency, {
        paystackLink: link.trim() === "" ? null : link.trim(),
        priceMinorUnits,
        provider,
      });
      onSaved({ ...plan, paystackLink: link.trim() || null, priceMinorUnits, provider });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await api.admin.subscriptionPlans.remove(plan.tier as "standard" | "pro", plan.currency);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove this currency.");
      setIsRemoving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">{plan.currency}</h4>
        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="text-slate-400 hover:text-rose-600 hover:dark:text-rose-400 cursor-pointer disabled:opacity-50"
            aria-label={`Remove ${plan.currency}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
          {provider === "stripe" ? "Stripe Payment Link" : "Paystack Payment Page link"}
        </label>
        <input
          type="url"
          placeholder={provider === "stripe" ? "https://buy.stripe.com/..." : "https://paystack.com/pay/your-page-slug"}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Create a payment link for this exact price with your provider, then paste it here. Aziiki appends the user's email
          to it automatically so the payment can be matched back to their account.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Price ({plan.currency})</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 49.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "paystack" | "stripe")}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs"
          >
            <option value="paystack">Paystack</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">
        The price here must match the payment link's actual price exactly - it's how an incoming Paystack payment gets
        matched back to this tier (Stripe links aren't auto-matched by webhook yet; upgrade those accounts manually below
        until that's wired up).
      </p>
      {error && <p className="text-[10px] text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={isSaving}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
      >
        <Save className="w-3.5 h-3.5" /> {isSaving ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}

function TierGroup({ tier, rows, onChange }: { tier: string; rows: PlanRow[]; onChange: (rows: PlanRow[]) => void }) {
  const [newCurrency, setNewCurrency] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const addCurrency = () => {
    const code = newCurrency.trim().toUpperCase();
    setAddError(null);
    if (!/^[A-Z]{3}$/.test(code)) {
      setAddError("Enter a 3-letter currency code, e.g. USD.");
      return;
    }
    if (rows.some((r) => r.currency === code)) {
      setAddError(`${code} is already configured for this tier.`);
      return;
    }
    onChange([...rows, { tier, currency: code, paystackLink: null, priceMinorUnits: null, provider: code === "USD" ? "stripe" : "paystack" }]);
    setNewCurrency("");
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">{TIER_LABEL[tier] ?? tier} plan</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((row) => (
          <CurrencyRow
            key={row.currency}
            plan={row}
            removable={rows.length > 1}
            onSaved={(updated) => onChange(rows.map((r) => (r.currency === updated.currency ? updated : r)))}
            onRemoved={() => onChange(rows.filter((r) => r.currency !== row.currency))}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          type="text"
          maxLength={3}
          placeholder="Add currency, e.g. USD"
          value={newCurrency}
          onChange={(e) => setNewCurrency(e.target.value)}
          className="w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs uppercase focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={addCurrency}
          className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add currency
        </button>
        {addError && <p className="text-[10px] text-rose-600 dark:text-rose-400">{addError}</p>}
      </div>
    </div>
  );
}

export default function PaymentsPanel() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [manualTier, setManualTier] = useState<"basic" | "standard" | "pro">("standard");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [isSettingTier, setIsSettingTier] = useState(false);

  useEffect(() => {
    api.admin.subscriptionPlans
      .list()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSetUserTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualSuccess(null);
    setIsSettingTier(true);
    try {
      await api.admin.subscriptionPlans.setUserTier(email, manualTier);
      setManualSuccess(`${email} is now on the ${manualTier} plan.`);
      setEmail("");
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Couldn't update that account's plan.");
    } finally {
      setIsSettingTier(false);
    }
  };

  const byTier: Record<string, PlanRow[]> = { standard: [], pro: [] };
  for (const row of plans) {
    if (byTier[row.tier]) byTier[row.tier].push(row);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <CreditCard className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Basic accounts get the Phase 1 core loop for free. Standard unlocks everything through Phase 2; Pro unlocks
          everything. Price each tier per currency - a visitor sees the row matching their business's currency, falling back
          to USD if theirs isn't configured. A successful Paystack payment upgrades the account automatically via webhook;
          Stripe payments need a manual "Set plan" below until that's wired up too.
        </p>
      </div>

      <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminBranding />}>
        <div className="space-y-4">
          {(["standard", "pro"] as const).map((tier) => (
            <TierGroup key={tier} tier={tier} rows={byTier[tier]} onChange={(rows) => setPlans((prev) => [...prev.filter((p) => p.tier !== tier), ...rows])} />
          ))}
        </div>
      </LoadingSwap>

      <form onSubmit={handleSetUserTier} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <UserGear className="w-3.5 h-3.5" /> Manually set an account's plan
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">For comping an account, a Stripe payment, or fixing a payment the webhook couldn't match automatically.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
          />
          <select
            value={manualTier}
            onChange={(e) => setManualTier(e.target.value as "basic" | "standard" | "pro")}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs"
          >
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </select>
          <button
            type="submit"
            disabled={isSettingTier}
            className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {isSettingTier ? "Setting..." : "Set plan"}
          </button>
        </div>
        {manualError && <p className="text-[10px] text-rose-600 dark:text-rose-400">{manualError}</p>}
        {manualSuccess && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{manualSuccess}</p>}
      </form>
    </div>
  );
}
