import React from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import Logo from "./Logo";

interface PrivacyPolicyProps {
  onBack: () => void;
}

export default function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
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
            <Logo size={40} />
            <div>
              <h1 className="text-xl font-black text-slate-900">Privacy Policy</h1>
              <p className="text-xs text-slate-400 font-mono">Last updated: August 2026</p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">What Aziiki is</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Aziiki is a business management platform. This policy explains what information we collect when you use it, why, and what control you have over it.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Information we collect</h2>
            <ul className="text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1.5">
              <li><strong className="text-slate-800">Account information</strong> - your email address, and password (stored securely hashed, never in plain text).</li>
              <li><strong className="text-slate-800">Business records you create</strong> - invoices, receipts, estimates, customer details, transactions, inventory, and any other data you enter to run your business through Aziiki.</li>
              <li><strong className="text-slate-800">Uploaded content</strong> - a business logo, if you choose to upload one.</li>
              <li><strong className="text-slate-800">Usage information</strong> - basic technical data (browser type, general activity) used to keep the service secure and working correctly.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">How your data is protected</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every business's records are isolated from every other business and every other account - access controls are enforced at the database level, not just in the app's interface, so a bug in the interface can't expose another business's data. Passwords are never stored in a form we could read.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">The AI advisor</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              When you use the AI advisor, the figures relevant to your question (from the business you currently have open) are sent to our AI provider to generate a response. Data from other businesses on your account, or from other users, is never included. AI responses are generated on demand and are not used to train any underlying model.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">What we don't do</h2>
            <ul className="text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1.5">
              <li>We don't sell your data to anyone.</li>
              <li>We don't show ads inside the app based on your business data.</li>
              <li>We don't share your business records with other users.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Your control over your data</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              You can edit or delete customers, invoices, receipts, estimates, and inventory records you've created at any time from within the app. If you'd like your account and all associated data permanently deleted, contact support.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Changes to this policy</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              If this policy changes in a way that affects how your data is handled, we'll make that clear within the app rather than updating this page silently.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
