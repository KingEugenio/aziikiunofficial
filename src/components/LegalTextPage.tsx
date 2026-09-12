import React, { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import BrandLogo from "./BrandLogo";
import { api } from "../lib/api";
import { useSiteSettings } from "../lib/siteSettings";
import { LoadingSwap } from "./LoadingSwap";
import { Skeleton } from "./Skeleton";

interface LegalTextPageProps {
  title: string;
  /** Which src/server/routes/config.ts -> /site-settings key holds this page's body text (migration 0047) - editable from /admin -> Site Content, no code change needed. */
  settingKey: string;
  onBack: () => void;
}

/**
 * Renders admin-editable plain-text legal content (Terms of Service,
 * Refund Policy) in the same visual shell as PrivacyPolicy.tsx, whose own
 * content stays hardcoded/component-authored rather than moved into this
 * system.
 */
export default function LegalTextPage({ title, settingKey, onBack }: LegalTextPageProps) {
  const { settings, loaded } = useSiteSettings();
  const text = settings[settingKey] ?? "";
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.config
      .siteSettingsUpdatedAt()
      .then((data) => {
        if (!cancelled && data[settingKey]) {
          setLastUpdated(
            new Date(data[settingKey]).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          );
        }
      })
      .catch(() => {
        // Fail open to no date shown - not worth blocking the page for.
      });
    return () => {
      cancelled = true;
    };
  }, [settingKey]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 hover:dark:text-slate-200 mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-700">
            <BrandLogo size={40} />
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">{title}</h1>
              {lastUpdated && <p className="text-xs text-slate-400 font-mono">Last updated: {lastUpdated}</p>}
            </div>
          </div>

          <LoadingSwap
            isLoading={!loaded}
            skeleton={
              <div className="space-y-3">
                <Skeleton width="100%" height="1rem" />
                <Skeleton width="90%" height="1rem" />
                <Skeleton width="95%" height="1rem" />
                <Skeleton width="70%" height="1rem" />
              </div>
            }
          >
            {text.trim() === "" ? (
              <p className="text-sm text-slate-400 italic">This page hasn't been written yet.</p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>
            )}
          </LoadingSwap>
        </div>
      </div>
    </div>
  );
}
