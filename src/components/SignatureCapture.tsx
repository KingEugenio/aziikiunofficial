import React, { useEffect, useState } from "react";
import { FloppyDisk, X } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";

interface SignatureCaptureProps {
  businessId: string;
  documentType: "invoice" | "receipt" | "quotation";
  documentId: string;
  onSaved: (signature: any) => void;
  onClose: () => void;
}

/**
 * Captures the signing business representative's full name against one
 * specific document, saved via POST /api/signatures. Deliberately just a
 * typed full name, not a free-hand drawing or an arbitrary short signature -
 * this represents a specific person at the business certifying the
 * document, so it's validated as a real first-and-last name rather than
 * accepting a scribble, initials, or a single word. Scoped to the business
 * owner capturing it in person (see the migration's comment) - there's no
 * public unauthenticated signing link here.
 */
export default function SignatureCapture({
  businessId,
  documentType,
  documentId,
  onSaved,
  onClose,
}: SignatureCaptureProps) {
  const [fullName, setFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // At least a first and last name - "strictly" the representative's full
  // name, not initials or a single word.
  const isFullName = fullName.trim().split(/\s+/).filter(Boolean).length >= 2;

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("Please enter the business representative's full name.");
      return;
    }
    if (!isFullName) {
      setError("Please enter a full name (first and last), not just one word.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const signature = await api.signatures.create({
        businessId,
        documentType,
        documentId,
        signerName: fullName.trim(),
        signatureKind: "typed",
        signatureData: fullName.trim(),
      });
      onSaved(signature);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this signature.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign document" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-left">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Sign Document</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-700 rounded-full flex items-center justify-center cursor-pointer">
            <X className="w-3.5 h-3.5" weight="bold" />
          </button>
        </div>

        {error && <div className="bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-400 p-2.5 rounded-xl text-xs">{error}</div>}

        <div className="space-y-1">
          <label htmlFor="signer-name" className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">
            Business Representative Full Name
          </label>
          <p className="text-[10px] text-slate-400">The full name of the person at your business signing this document.</p>
          <input
            id="signer-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Yaw Mensah"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-4 text-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500"
            style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          <FloppyDisk className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Signature"}
        </button>
      </div>
    </div>
  );
}
