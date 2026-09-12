import React, { useEffect, useState } from "react";
import { ShieldCheck, X } from "@phosphor-icons/react";
import { api } from "../lib/api";

interface MfaOnboardingNudgeProps {
  userId: string;
  onGoToSettings: () => void;
}

const dismissedKey = (userId: string) => `aziiki_mfa_nudge_dismissed_${userId}`;

/**
 * A one-time, dismissible nudge encouraging a new account to turn on
 * two-factor authentication from Settings. Gated by the admin-controlled
 * mfa_onboarding_prompt flag (see AppGuide/App.tsx callers) - never shown
 * to an account that already has an active authenticator factor, and
 * dismissed permanently per-account once closed or once MFA is enabled.
 */
export default function MfaOnboardingNudge({ userId, onGoToSettings }: MfaOnboardingNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem(dismissedKey(userId)) === "true") return;
    } catch {
      // Private mode / storage blocked - fall through and still check MFA status.
    }
    api.auth
      .mfaFactors()
      .then((res) => {
        if (cancelled) return;
        const hasVerifiedFactor = (res.factors?.totp ?? []).some((f: { status: string }) => f.status === "verified");
        if (!hasVerifiedFactor) setVisible(true);
      })
      .catch(() => {
        // Fail closed - don't nudge if we can't confirm MFA status either way.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(dismissedKey(userId), "true");
    } catch {
      // It'll just show again next visit - not worth blocking on.
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[150] bg-slate-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3 animate-fade-in">
      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      <div className="flex-1 text-xs leading-relaxed">
        <p className="font-bold mb-1">Add an extra layer of protection</p>
        <p className="text-slate-300">
          Turn on two-factor authentication so your account needs a code from your phone to sign in, not just a password.
        </p>
        <button
          type="button"
          onClick={() => {
            dismiss();
            onGoToSettings();
          }}
          className="underline font-bold hover:text-emerald-400 cursor-pointer mt-2 inline-block"
        >
          Enable in Settings
        </button>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-slate-400 hover:text-white cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
