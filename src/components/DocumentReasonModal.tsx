import React, { useState } from "react";
import { Lock } from "@phosphor-icons/react";

// Mirrors server/documentIntegrity.ts REASON_MIN_LENGTH.
export const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;

interface DocumentReasonModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  isWorking?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Asks for the written reason that changing or deleting a saved invoice or
 * receipt requires (see server/documentIntegrity.ts). The reason is kept
 * permanently in the document's change history, so the prompt says so.
 */
export default function DocumentReasonModal({ title, message, confirmLabel, danger = false, isWorking = false, onConfirm, onCancel }: DocumentReasonModalProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const ready = trimmed.length >= REASON_MIN_LENGTH;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="doc-reason-title">
      <div className="absolute inset-0 bg-slate-900/50" onClick={isWorking ? undefined : onCancel} />
      <form
        className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !isWorking) onConfirm(trimmed);
        }}
      >
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${danger ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h3 id="doc-reason-title" className="text-sm font-black text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div>
          <label htmlFor="doc-reason-input" className="text-[10px] font-mono text-slate-450 uppercase tracking-widest font-bold block mb-1.5">
            Reason for the change
          </label>
          <textarea
            id="doc-reason-input"
            autoFocus
            rows={3}
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer asked for a corrected quantity"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 text-xs font-sans resize-none"
          />
          <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
            <span className={ready ? "text-emerald-600" : "text-slate-400"}>
              {ready ? "Ready" : `At least ${REASON_MIN_LENGTH} characters (${Math.max(0, REASON_MIN_LENGTH - trimmed.length)} more)`}
            </span>
            <span className="text-slate-400">{trimmed.length}/{REASON_MAX_LENGTH}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">Your reason is saved permanently in this document's change history and can't be edited or removed.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isWorking}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready || isWorking}
            className={`flex-1 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isWorking ? "Working..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
