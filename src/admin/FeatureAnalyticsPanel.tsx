import React, { useEffect, useState } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface UsageRow {
  eventName: string;
  eventCategory: string;
  count: number;
}

// Human-readable labels for the raw FeatureUsage keys (src/lib/analytics.ts)
// this panel displays - kept here rather than in the shared lib since it's
// purely a display concern.
const EVENT_LABEL: Record<string, string> = {
  invoicesCreated: "Invoices created",
  receiptsCreated: "Receipts created",
  estimatesCreated: "Estimates created",
  documentsUploaded: "Documents uploaded",
  crmProfilesAdded: "Customers added",
  inventoryAdjusted: "Inventory items added",
  aiQueries: "CFO AI Advisor queries",
  reportsGenerated: "Reports viewed",
  netWorthUpdates: "Wealth & Goals updates",
  rolesModified: "Team roles modified",
  automationRuns: "Automations run",
  whatsappShares: "WhatsApp shares",
  emailShares: "Email shares",
  businessSwitches: "Business switches",
  guideViews: "App Guide views",
};

const WINDOW_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

/**
 * Real, cross-user feature usage - not the per-browser localStorage counter
 * on AdMonetizationHub (fake seed data, invisible to the app's operator).
 * Reads analytics_events (migration 0018/0057) via GET
 * /api/admin/analytics/feature-usage, populated by every trackFeatureUsage()
 * call across the app (src/lib/analytics.ts).
 */
export default function FeatureAnalyticsPanel() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.analytics
      .featureUsage(days)
      .then((res) => {
        setRows(res.data);
        setTotalEvents(res.totalEvents);
      })
      .catch(() => {
        setRows([]);
        setTotalEvents(0);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5 max-w-md">
          <ChartBar className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Real usage across every signed-in user, ranked most-used first. Logged automatically as people use each feature - nothing to configure.
        </p>
        <div className="flex gap-1.5">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer border transition-colors ${
                days === opt.days ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">No feature usage logged yet in this window.</p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{totalEvents.toLocaleString()} events total</p>
            {rows.map((row) => (
              <div key={row.eventName} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-xs font-bold text-slate-900">{EVENT_LABEL[row.eventName] ?? row.eventName}</span>
                  <span className="text-xs font-mono font-bold text-emerald-600">{row.count.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(row.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </LoadingSwap>
    </div>
  );
}
