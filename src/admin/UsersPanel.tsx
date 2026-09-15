import React, { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass as Search, UserGear } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface UserRow {
  id: string;
  email: string;
  tier: "basic" | "standard" | "pro";
  isAdmin: boolean;
  createdAt: string;
  businessCount: number;
}

const TIER_STYLES: Record<string, string> = {
  basic: "bg-slate-100 text-slate-500 border-slate-200",
  standard: "bg-indigo-50 text-indigo-700 border-indigo-200",
  pro: "bg-amber-50 text-amber-800 border-amber-200",
};

/**
 * Makes accounts browsable/searchable - before this, the only account-level
 * admin action (PaymentsPanel's "manually set a plan") needed the exact
 * email typed in blind, with no way to see who exists, when they signed
 * up, or how many businesses they've actually created. The tier-change
 * action here calls the same existing endpoint that form already used
 * (api.admin.subscriptionPlans.setUserTier) - this panel is a browsing
 * layer on top, not a second implementation of the tier-change logic.
 */
export default function UsersPanel() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingTierByEmail, setPendingTierByEmail] = useState<Record<string, "basic" | "standard" | "pro">>({});
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.users
      .list()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const handleSaveTier = async (row: UserRow) => {
    const nextTier = pendingTierByEmail[row.email] ?? row.tier;
    if (nextTier === row.tier) return;
    setError(null);
    setSavingEmail(row.email);
    try {
      await api.admin.subscriptionPlans.setUserTier(row.email, nextTier);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, tier: nextTier } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't update ${row.email}'s plan.`);
    } finally {
      setSavingEmail(null);
    }
  };

  return (
    <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 outline-none text-xs focus:border-emerald-500"
          />
        </div>

        <p className="text-[11px] text-slate-400">
          {filtered.length} of {rows.length} account{rows.length === 1 ? "" : "s"}
        </p>

        {error && <p className="text-[10px] text-rose-600">{error}</p>}

        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400">{rows.length === 0 ? "No accounts yet." : "No accounts match that search."}</p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((row) => {
              const pendingTier = pendingTierByEmail[row.email] ?? row.tier;
              const isDirty = pendingTier !== row.tier;
              return (
                <div key={row.id} className="border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[11px] font-bold text-slate-900 truncate">{row.email}</p>
                      {row.isAdmin && (
                        <span className="text-[8px] font-mono uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                      Joined {new Date(row.createdAt).toLocaleDateString()} · {row.businessCount} business{row.businessCount === 1 ? "" : "es"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={pendingTier}
                      onChange={(e) =>
                        setPendingTierByEmail((prev) => ({ ...prev, [row.email]: e.target.value as "basic" | "standard" | "pro" }))
                      }
                      className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border outline-none cursor-pointer ${TIER_STYLES[pendingTier]}`}
                    >
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="pro">Pro</option>
                    </select>
                    {isDirty && (
                      <button
                        type="button"
                        onClick={() => handleSaveTier(row)}
                        disabled={savingEmail === row.email}
                        className="text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <UserGear className="w-3 h-3" /> {savingEmail === row.email ? "Saving..." : "Save"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LoadingSwap>
  );
}
