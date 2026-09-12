import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export type CommitStep = 0 | 1;

interface Phase3CommitProps {
  step: CommitStep;
  /** Called once they've typed a valid-looking email on step 0 and hit
   * Continue - just advances to step 1, no account is created yet. */
  onEmailContinue: (email: string) => void;
  /** Called from step 1's Continue button. Ends the onboarding flow and
   * hands off to the real account-creation screen (AuthPortal's Create
   * Account tab), with the email from step 0 pre-filled so they never have
   * to type it twice. */
  onFinishToCreateAccount: () => void;
}

/**
 * Phase 3 - Commit. Screen 1 captures just the email address ("saving
 * progress" refers to the personalized preview they just saw in Phase 2);
 * screen 2 is a plain confirmation - no trial, no plan choice, no pricing.
 * Aziiki is 100% free during Launch Edition (see AdMonetizationHub), so
 * presenting a "start your trial" paywall here would be actively
 * misleading. Actual account creation (password, workspace name, currency)
 * happens on AuthPortal's Create Account tab right after this, not here -
 * this screen's only job is capturing the email and getting out of the way.
 */
export default function Phase3Commit({ step, onEmailContinue, onFinishToCreateAccount }: Phase3CommitProps) {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Enter a valid email address.");
      return;
    }
    onEmailContinue(email);
  };

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="commit-email"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] mb-2 font-mono">
              Save your progress
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 dark:text-slate-100 mb-2">
              Don't lose what you just saw
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Enter your email and we'll take you straight to setting up your account so everything you add is saved to the cloud.
            </p>

            {errorMsg && (
              <div className="bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-xl p-3 mb-4 text-left">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
              <input
                type="email"
                required
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-[color:var(--color-onboard-teal)] transition-colors font-sans"
              />
              <button
                type="submit"
                className="w-full bg-[color:var(--color-onboard-teal)] hover:opacity-90 text-white font-heading font-bold py-3.5 rounded-2xl shadow-lg shadow-[color:var(--color-onboard-teal)]/20 transition-opacity cursor-pointer"
              >
                Continue
              </button>
            </form>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="commit-confirm"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] mb-2 font-mono">
              Launch Edition
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 dark:text-slate-100 mb-3 leading-tight">
              You're all set
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Aziiki is completely free to use right now. We'll let you know here in the app, well ahead of time, whenever paid plans are introduced down the line — nothing changes for you today.
            </p>

            <button
              type="button"
              onClick={onFinishToCreateAccount}
              className="w-full bg-[color:var(--color-onboard-teal)] hover:opacity-90 text-white font-heading font-bold py-3.5 rounded-2xl shadow-lg shadow-[color:var(--color-onboard-teal)]/20 transition-opacity cursor-pointer"
            >
              Continue
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
