import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Entry = Awaited<ReturnType<typeof api.documentChangeLog.list>>[number];

const ACTION_LABEL: Record<Entry["action"], string> = {
  amended: "Amended",
  deleted: "Deleted",
  status_changed: "Progress recorded",
  amendment_failed: "Amendment did not go through",
};

const FIELD_LABEL: Record<string, string> = {
  customerId: "Customer",
  customClientName: "Client name",
  date: "Issue date",
  dueDate: "Due date",
  discount: "Discount %",
  taxRate: "Tax %",
  status: "Status",
  partialPaidAmount: "Part-payment",
  currency: "Currency",
  exchangeRateToBusinessCurrency: "Exchange rate",
  items: "Line items",
  invoiceId: "Linked invoice",
  description: "Description",
  amountPaid: "Amount paid",
  paymentMethod: "Payment method",
};

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "empty" : String(v));

function summarize(entry: Entry): string[] {
  if (entry.action === "deleted") return ["The whole document was deleted (a full copy is kept in this history)."];
  return Object.entries(entry.changes)
    .filter(([key]) => key !== "error")
    .map(([key, change]) => {
      const label = FIELD_LABEL[key] ?? key;
      if (key === "items") return `${label} changed`;
      return `${label}: ${fmt(change?.from)} → ${fmt(change?.to)}`;
    });
}

/** Read-only change history for one saved invoice or receipt (newest first). */
export default function DocumentHistoryList({ businessId, documentId, refreshKey }: { businessId: string; documentId: string; refreshKey?: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    api.documentChangeLog
      .list(businessId, documentId)
      .then((rows) => !cancelled && setEntries(rows))
      .catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [businessId, documentId, refreshKey]);

  if (entries === null) return <p className="text-[11px] text-slate-400 italic">Loading history...</p>;
  if (entries.length === 0) return <p className="text-[11px] text-slate-400 italic">No changes recorded - this document is exactly as it was first saved.</p>;

  return (
    <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <li key={entry.id} className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10px] leading-relaxed">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-slate-800">{ACTION_LABEL[entry.action]}</strong>
            <span className="font-mono text-slate-400 shrink-0">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
          {entry.reason && <p className="text-slate-700 mt-0.5">Reason: “{entry.reason}”</p>}
          <ul className="text-slate-500 mt-0.5 list-disc pl-4">
            {summarize(entry).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="text-slate-400 mt-0.5">{entry.changedByMe ? "By you" : "By a team member"}</p>
        </li>
      ))}
    </ul>
  );
}
