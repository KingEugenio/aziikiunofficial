import { useEffect, useState } from "react";
import { FloppyDisk as Save, ChartBar } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminBranding } from "../components/Skeleton";

/**
 * Turns PostHog product analytics on/off and sets its project key and host,
 * live, from the admin portal - the same admin-editable site_settings store
 * Site Content already uses (via its own dedicated "posthog" permission
 * section, so granting this panel doesn't also grant editing contact info,
 * social links, legal text, or FAQ), so it takes effect on the next page
 * load with no rebuild or redeploy. See lib/posthog.ts for how the client
 * reads these.
 */
export default function PostHogSettingsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState("");
  const [host, setHost] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.postHogSettings
      .list()
      .then((rows) => {
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        setEnabled(byKey.posthog_enabled === "true");
        setKey(byKey.posthog_key ?? "");
        setHost(byKey.posthog_host || "https://us.i.posthog.com");
      })
      .catch(() => setError("Couldn't load the current settings."))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await api.admin.postHogSettings.set("posthog_enabled", next ? "true" : "false");
    } catch {
      setEnabled(!next);
      setError("Couldn't save that change - try again.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.admin.postHogSettings.set("posthog_key", key.trim());
      await api.admin.postHogSettings.set("posthog_host", host.trim() || "https://us.i.posthog.com");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Couldn't save that change - try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminBranding />}>
      <div className="space-y-6">
        <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ChartBar className="w-3.5 h-3.5" /> PostHog Analytics
          </h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tracks product usage (page views, feature clicks) - no session recordings, no autocapture. Paste your
            project's key below from PostHog &rarr; Project Settings, then turn it on. Changes reach every open tab
            and the desktop app on their next page load, no redeploy needed.
          </p>

          <div className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2.5">
            <span className="text-xs font-bold text-slate-800">Analytics enabled</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={handleToggle}
              className={`w-10 h-5.5 rounded-full transition-colors cursor-pointer relative ${enabled ? "bg-emerald-600" : "bg-slate-300"}`}
            >
              <span
                className="absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-[left] duration-150"
                style={{ left: enabled ? 20 : 2 }}
              />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Project API key</label>
            <input
              type="text"
              placeholder="phc_..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs font-mono focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Host</label>
            <input
              type="text"
              placeholder="https://us.i.posthog.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs font-mono focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-400">Use https://eu.i.posthog.com if your PostHog project is on the EU cloud.</p>
          </div>

          {error && <p className="text-[10px] text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "..." : saved ? "Saved" : "Save key & host"}
          </button>
        </div>
      </div>
    </LoadingSwap>
  );
}
