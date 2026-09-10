import React, { useEffect, useState } from "react";
import { CaretDown, CaretUp, Plus, Trash as Trash2 } from "@phosphor-icons/react";
import { api } from "../lib/api";

interface FlagRow {
  key: string;
  name: string;
  description: string;
  phase: number;
  enabledDefault: boolean;
  overrideCount: number;
}

interface OverrideRow {
  userId: string;
  email: string;
  enabled: boolean;
}

/** One flag's expandable per-user override list - kept as its own
 * component so each flag manages its own overrides fetch/state
 * independently, only loaded once expanded. */
function OverridesEditor({ flagKey }: { flagKey: string }) {
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.admin.featureFlags
      .listOverrides(flagKey)
      .then(setOverrides)
      .catch(() => setOverrides([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [flagKey]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await api.admin.featureFlags.setOverride(flagKey, email, enabled);
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that override.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    await api.admin.featureFlags.removeOverride(flagKey, userId);
    load();
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          required
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-500"
        />
        <select
          value={enabled ? "on" : "off"}
          onChange={(e) => setEnabled(e.target.value === "on")}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none"
        >
          <option value="on">Force ON</option>
          <option value="off">Force OFF</option>
        </select>
        <button
          type="submit"
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </form>
      {error && <p className="text-[10px] text-rose-600">{error}</p>}

      {loading ? (
        <p className="text-[10px] text-slate-400">Loading overrides...</p>
      ) : overrides.length === 0 ? (
        <p className="text-[10px] text-slate-400">No per-user overrides yet.</p>
      ) : (
        <div className="space-y-1.5">
          {overrides.map((o) => (
            <div key={o.userId} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5 text-[11px]">
              <span className="text-slate-700">{o.email}</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${o.enabled ? "text-emerald-600" : "text-rose-600"}`}>
                  {o.enabled ? "Forced ON" : "Forced OFF"}
                </span>
                <button
                  onClick={() => handleRemove(o.userId)}
                  aria-label={`Remove override for ${o.email}`}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.featureFlags
      .list()
      .then(setFlags)
      .catch(() => setFlags([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleToggle = async (flag: FlagRow) => {
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabledDefault: !f.enabledDefault } : f)));
    try {
      await api.admin.featureFlags.setDefault(flag.key, !flag.enabledDefault);
    } catch {
      load();
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading feature flags...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 leading-relaxed">
        Every feature outside the Phase 1 MVP ships in the code, switched off by default. Flip one on for everyone, or expand it
        to turn it on for specific users first.
      </p>
      {flags.map((flag) => {
        const expanded = expandedKey === flag.key;
        return (
          <div key={flag.key} className="border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-bold text-slate-900">{flag.name}</h3>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    Phase {flag.phase}
                  </span>
                  {flag.overrideCount > 0 && (
                    <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {flag.overrideCount} override{flag.overrideCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{flag.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.enabledDefault}
                  onClick={() => handleToggle(flag)}
                  className={`w-10 h-5.5 rounded-full transition-colors cursor-pointer relative ${
                    flag.enabledDefault ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
                      flag.enabledDefault ? "translate-x-[19px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedKey(expanded ? null : flag.key)}
                  aria-label={expanded ? "Collapse overrides" : "Manage per-user overrides"}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                >
                  {expanded ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {expanded && <OverridesEditor flagKey={flag.key} />}
          </div>
        );
      })}
    </div>
  );
}
