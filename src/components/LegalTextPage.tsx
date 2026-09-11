import React, { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import BrandLogo from "./BrandLogo";
import { api } from "../lib/api";
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
  const [text, setText] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.config
      .siteSettings()
      .then((data) => {
        if (!cancelled) setText(data[settingKey] ?? "");
      })
      .catch(() => {
        // Fail open to an empty body - the page still renders, just with
        // nothing to show yet.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [settingKey]);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-150">
            <BrandLogo size={40} />
            <h1 className="text-xl font-black text-slate-900">{title}</h1>
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
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{text}</p>
            )}
          </LoadingSwap>
        </div>
      </div>
    </div>
  );
}
