import React, { useEffect, useState } from "react";
import { UserPlus, Trash as Trash2, ShieldStar } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface AdminRow {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  sections: string[];
}

const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "flags", label: "Feature Flags" },
  { value: "announcements", label: "Announcements" },
  { value: "surveys", label: "Surveys" },
  { value: "payments", label: "Payments" },
  { value: "branding", label: "Branding & Files" },
  { value: "content", label: "Site Content" },
  { value: "guides", label: "Guides" },
];

function SectionCheckboxes({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const toggle = (section: string) => {
    onChange(selected.includes(section) ? selected.filter((s) => s !== section) : [...selected, section]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {SECTION_OPTIONS.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
              active ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700" : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Superadmin-only screen (hidden from the nav entirely for a regular admin -
 * see AdminApp.tsx) for granting/revoking admin access and choosing exactly
 * which sections each admin can reach. A brand-new admin starts with no
 * sections checked - genuinely no access - until deliberately granted some.
 */
export default function AdminsPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [newSections, setNewSections] = useState<string[]>([]);
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.admins
      .list()
      .then(setAdmins)
      .catch(() => setAdmins([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGranting(true);
    try {
      await api.admin.admins.grant(email, newSections);
      setEmail("");
      setNewSections([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't grant admin access.");
    } finally {
      setIsGranting(false);
    }
  };

  const handleUpdateSections = async (row: AdminRow, sections: string[]) => {
    setAdmins((prev) => prev.map((a) => (a.id === row.id ? { ...a, sections } : a)));
    try {
      await api.admin.admins.setSections(row.id, sections);
    } catch {
      load();
    }
  };

  const handleRevoke = async (row: AdminRow) => {
    setAdmins((prev) => prev.filter((a) => a.id !== row.id));
    try {
      await api.admin.admins.revoke(row.id);
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        As superadmin, you can grant admin access to any existing Aziiki account and choose exactly which parts of this
        portal they can reach. A new admin starts with nothing checked below - pick their sections deliberately.
      </p>

      <form onSubmit={handleGrant} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> Add an admin
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">The person must already have an Aziiki account (this doesn't create one).</p>
        <input
          type="email"
          required
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Sections they can access</label>
          <SectionCheckboxes selected={newSections} onChange={setNewSections} />
        </div>
        {error && <p className="text-[10px] text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={isGranting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {isGranting ? "Adding..." : "Grant admin access"}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Current admins</h3>
        <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
          {admins.length === 0 ? (
            <p className="text-xs text-slate-400">No admins found.</p>
          ) : (
            admins.map((row) => (
              <div key={row.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{row.email}</p>
                    {row.isSuperAdmin && (
                      <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <ShieldStar className="w-3 h-3" weight="fill" /> Superadmin
                      </span>
                    )}
                  </div>
                  {!row.isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(row)}
                      aria-label="Revoke admin access"
                      className="text-slate-300 hover:text-rose-600 hover:dark:text-rose-400 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {row.isSuperAdmin ? (
                  <p className="text-[11px] text-slate-400">Full access to every section, always.</p>
                ) : (
                  <SectionCheckboxes selected={row.sections} onChange={(next) => handleUpdateSections(row, next)} />
                )}
              </div>
            ))
          )}
        </LoadingSwap>
      </div>
    </div>
  );
}
