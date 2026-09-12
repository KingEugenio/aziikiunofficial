import React from "react";
import { WarningCircle as AlertCircle } from "@phosphor-icons/react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces both the jarring native window.confirm() and the total absence
 * of any confirmation on some destructive actions - a consistent, on-brand
 * modal for "are you sure" moments across the app.
 */
export default function ConfirmModal({ title, message, confirmLabel = "Delete", danger = true, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${danger ? "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" : "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"}`}>
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 id="confirm-modal-title" className="text-sm font-black text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
