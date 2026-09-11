import React, { useEffect, useState } from "react";
import { CreditCard, FloppyDisk as Save, UserGear } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminBranding } from "../components/Skeleton";

interface PlanRow {
  tier: string;
  paystackLink: string | null;
  priceMinorUnits: number | null;
  currency: string;
}

const TIER_LABEL: Record<string, string> = { standard: "Standard", pro: "Pro" };

function PlanCard({ plan, onSaved }: { plan: PlanRow; onSaved: (row: PlanRow) => void }) {
  const [link, setLink] = useState(plan.paystackLink ?? "");
  // Priced in the currency's main unit (e.g. GHS, not pesewas) for a human
  // to type - converted to/from minor units at the API boundary, matching
  // how Paystack itself reports amounts.
  const [price, setPrice] = useState(plan.priceMinorUnits != null ? (plan.priceMinorUnits / 100).toString() : "");
  const [currency, setCurrency] = useState(plan.currency);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const priceMinorUnits = price.trim() === "" ? null : Math.round(Number(price) * 100);
      await api.admin.subscriptionPlans.save(plan.tier as "standard" | "pro", {
        paystackLink: link.trim() === "" ? null : link.trim(),
        priceMinorUnits,
        currency: currency.trim().toUpperCase() || "GHS",
      });
      onSaved({ tier: plan.tier, paystackLink: link.trim() || null, priceMinorUnits, currency: currency.trim().toUpperCase() || "GHS" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this plan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="border border-slate-200 rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-800">{TIER_LABEL[plan.tier] ?? plan.tier} plan</h3>
      <div className="space-y-1">
        <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Paystack Payment Page link</label>
        <input
          type="url"
          placeholder="https://paystack.com/pay/your-page-slug"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Create a Payment Page for this exact price in your Paystack dashboard, then paste its link here. Aziiki appends the
          user's email to it automatically so the payment can be matched back to their account.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 49.00"
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
            placeholder="GHS"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs uppercase focus:border-emerald-500"
          />
        </div>
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">
        The price here must match the Payment Page's actual price exactly - it's how an incoming payment gets matched back to
        this tier when Paystack calls the webhook, since a plain Payment Page link carries no reference of its own.
      </p>
      {error && <p className="text-[10px] text-rose-600">{error}</p>}
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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <CreditCard className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Basic accounts get the Phase 1 core loop for free. Standard unlocks everything through Phase 2; Pro unlocks
          everything. A successful payment on either Payment Page below upgrades that account automatically - no manual step
          needed, via the same Paystack webhook already used for invoice payments.
        </p>
      </div>

      <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminBranding />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              onSaved={(row) => setPlans((prev) => prev.map((p) => (p.tier === row.tier ? row : p)))}
            />
          ))}
        </div>
      </LoadingSwap>

      <form onSubmit={handleSetUserTier} className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <UserGear className="w-3.5 h-3.5" /> Manually set an account's plan
        </h3>
        <p className="text-[11px] text-slate-500">For comping an account, or fixing a payment the webhook couldn't match automatically.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
          />
          <select
            value={manualTier}
            onChange={(e) => setManualTier(e.target.value as "basic" | "standard" | "pro")}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs"
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
        {manualError && <p className="text-[10px] text-rose-600">{manualError}</p>}
        {manualSuccess && <p className="text-[10px] text-emerald-600">{manualSuccess}</p>}
      </form>
    </div>
  );
}
