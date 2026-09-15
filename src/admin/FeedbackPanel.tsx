import React, { useEffect, useState } from "react";
import { ChatText as MessageSquare } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface FeedbackRow {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

// Read-only: feedback_submissions is written to by the "Share Feedback"
// form in AdMonetizationHub.tsx (and any future form pointed at
// api.feedback.submit) - there's nothing to create/edit here, just a way
// to actually read what's been submitted, which didn't exist before this.
export default function FeedbackPanel() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.feedback
      .list()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Every submission from the app's "Share Feedback" forms, newest first.
        </p>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing submitted yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs font-bold text-slate-900">{row.name}</p>
                <span className="text-[9px] font-mono text-slate-400">{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              <a href={`mailto:${row.email}`} className="text-[11px] text-emerald-600 hover:underline">
                {row.email}
              </a>
              <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{row.message}</p>
            </div>
          ))
        )}
      </div>
    </LoadingSwap>
  );
}
