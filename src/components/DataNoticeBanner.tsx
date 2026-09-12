import React, { useState } from "react";
import { Info, X } from "@phosphor-icons/react";

interface DataNoticeBannerProps {
  onShowPrivacyPolicy?: () => void;
}

const DISMISSED_KEY = "aziiki_data_notice_dismissed";

/**
 * A lightweight, one-time notice (not a full cookie-consent banner, since
 * Aziiki has no third-party tracking/ad cookies today) telling a visitor
 * their data is used only to run their own account, with a link to the
 * full Privacy Policy. Dismissed permanently per-browser once closed.
 */
export default function DataNoticeBanner({ onShowPrivacyPolicy }: DataNoticeBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Private mode / storage blocked - it'll just show again next visit.
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[150] bg-slate-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3 animate-fade-in">
      <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      <div className="flex-1 text-xs leading-relaxed">
        <p>
          We only use your data to run your Aziiki account - no third-party tracking or ad cookies.{" "}
          {onShowPrivacyPolicy && (
            <button type="button" onClick={onShowPrivacyPolicy} className="underline font-bold hover:text-emerald-400 cursor-pointer">
              Privacy Policy
            </button>
          )}
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-slate-400 hover:text-white cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
