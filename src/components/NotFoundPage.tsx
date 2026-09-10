import React from "react";
import { House } from "@phosphor-icons/react";
import Logo from "./Logo";

interface NotFoundPageProps {
  onGoHome: () => void;
}

export default function NotFoundPage({ onGoHome }: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm max-w-md w-full text-center space-y-5">
        <Logo size={44} className="mx-auto" />
        <div>
          <p className="text-5xl font-black text-slate-200 tracking-tight leading-none mb-2">404</p>
          <h1 className="text-lg font-black text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            This link doesn't lead anywhere in Aziiki. It may be outdated, or the address might have been typed incorrectly.
          </p>
        </div>
        <button
          onClick={onGoHome}
          className="inline-flex items-center gap-2 bg-brand-teal hover:opacity-90 text-white text-sm font-bold px-5 py-3 rounded-xl transition-opacity cursor-pointer"
        >
          <House className="w-4 h-4" /> Back to Aziiki
        </button>
      </div>
    </div>
  );
}
