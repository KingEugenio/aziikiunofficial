import React from "react";
import { LockKey, ArrowSquareOut, CheckCircle } from "@phosphor-icons/react";
import { formatFeaturePrice, type FeaturePrice } from "../lib/featurePricing";

interface FeatureLockedNoticeProps {
  /** The feature's own display name (feature_flags.name), e.g. "Net Worth & Investments". */
  featureName: string;
  /** Pricing for this feature, from useFeaturePricing()'s byFlagKey map. Always defined when this renders - see App.tsx's gating. */
  price: FeaturePrice;
}

/**
 * Shown instead of a feature whose flag is off AND has a price attached -
 * a clear "here's what this costs and how to get it" screen, replacing
 * what used to be a silent redirect back to the dashboard with no
 * explanation at all. A feature that's off with NO price attached still
 * gets that old silent-redirect behavior (see App.tsx) - there's nothing
 * to sell, so there's nothing useful to say.
 */
export default function FeatureLockedNotice({ featureName, price }: FeatureLockedNoticeProps) {
  const formatted = formatFeaturePrice(price);

  return (
    <div className="max-w-lg mx-auto text-center py-16 px-4" role="status">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
        <LockKey className="w-7 h-7" weight="fill" />
      </div>
      <h2 className="text-lg font-black text-slate-900 font-sans">{featureName} is a paid feature</h2>
      {formatted && (
        <p className="text-2xl font-black text-slate-900 font-sans mt-2">
          {formatted}
          {price.billingType === "recurring" && <span className="text-xs font-bold text-slate-400 ml-1">billed {price.recurringInterval}</span>}
        </p>
      )}
      <p className="text-xs text-slate-500 font-sans mt-3 leading-relaxed">
        {price.accessMessage || "Unlock this feature to start using it in your workspace."}
      </p>
      {price.paymentLink ? (
        <a
          href={price.paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl mt-6 cursor-pointer transition-colors"
        >
          Get access <ArrowSquareOut className="w-4 h-4" />
        </a>
      ) : (
        <p className="text-[11px] text-slate-400 font-mono mt-6">Payment isn't set up for this yet - contact support to get access.</p>
      )}
      <p className="text-[10px] text-slate-400 font-sans mt-4 flex items-center justify-center gap-1.5">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Access starts automatically once your payment goes through.
      </p>
    </div>
  );
}
