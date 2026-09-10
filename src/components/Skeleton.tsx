import React from "react";

interface SkeletonProps {
  key?: React.Key;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  animate?: "shimmer" | "pulse" | "none";
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width,
  height,
  circle = false,
  className = "",
  animate = "shimmer",
  borderRadius,
  style
}: SkeletonProps) {
  const animationClass =
    animate === "shimmer"
      ? "shimmer-bg"
      : animate === "pulse"
      ? "skeleton-pulse animate-pulse"
      : "bg-slate-200";

  const customStyle: React.CSSProperties = {
    width: width !== undefined ? width : "100%",
    height: height !== undefined ? height : "1rem",
    borderRadius: circle ? "50%" : borderRadius || "8px",
    ...style
  };

  return (
    <div
      role="status"
      aria-label="Loading content"
      aria-busy="true"
      className={`inline-block ${animationClass} ${className}`}
      style={customStyle}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Composite Skeleton 1: Standard Dashboard Stats Cards
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-dashboard">
      {/* Welcome Message Skeleton */}
      <div className="space-y-2">
        <Skeleton width="40%" height="2rem" />
        <Skeleton width="60%" height="1rem" />
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton width="50%" height="0.875rem" />
              <Skeleton width="1.5rem" height="1.5rem" circle />
            </div>
            <Skeleton width="75%" height="1.75rem" />
            <div className="flex items-center gap-1">
              <Skeleton width="20%" height="0.75rem" />
              <Skeleton width="40%" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout: Main Chart & Side Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton width="120px" height="1rem" />
              <Skeleton width="200px" height="0.75rem" />
            </div>
            <Skeleton width="80px" height="2rem" className="rounded-xl" />
          </div>
          <Skeleton height="250px" className="rounded-xl" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <Skeleton width="100px" height="1rem" />
          <div className="space-y-3.5">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1">
                  <Skeleton width="2rem" height="2rem" circle />
                  <div className="space-y-1 flex-1">
                    <Skeleton width="60%" height="0.875rem" />
                    <Skeleton width="40%" height="0.75rem" />
                  </div>
                </div>
                <Skeleton width="50px" height="0.875rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 2: Table / Spreadsheet Grid Loader
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden p-4 space-y-4 w-full text-left" id="skeleton-table">
      {/* Top Filter and Search Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Skeleton width="250px" height="2.25rem" className="rounded-xl" />
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton width="100px" height="2.25rem" className="rounded-xl" />
          <Skeleton width="120px" height="2.25rem" className="rounded-xl" />
        </div>
      </div>

      {/* Spreadsheet / Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-12 bg-slate-50 p-3.5 border-b border-slate-200">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className={`${
 colIdx === 0
 ? "col-span-4"
 : colIdx === cols - 1
 ? "col-span-3 text-right"
 : "col-span-2 text-center"
 }`}
            >
              <Skeleton width="60%" height="0.75rem" className="mx-auto inline-block align-middle" />
            </div>
          ))}
        </div>

        {/* Data Rows */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid grid-cols-12 p-4 items-center"
              style={{ animationDelay: `${rowIdx * 50}ms` }}
            >
              {Array.from({ length: cols }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className={`${
 colIdx === 0
 ? "col-span-4"
 : colIdx === cols - 1
 ? "col-span-3 text-right"
 : "col-span-2 text-center"
 }`}
                >
                  {colIdx === 0 ? (
                    <div className="flex items-center gap-3">
                      <Skeleton width="1.75rem" height="1.75rem" circle />
                      <div className="space-y-1 flex-1">
                        <Skeleton width="80%" height="0.875rem" />
                        <Skeleton width="50%" height="0.75rem" />
                      </div>
                    </div>
                  ) : colIdx === cols - 1 ? (
                    <div className="inline-flex gap-2 items-center justify-end">
                      <Skeleton width="60px" height="0.875rem" />
                      <Skeleton width="1.5rem" height="1.5rem" className="rounded" />
                    </div>
                  ) : (
                    <Skeleton width="45%" height="0.875rem" className="mx-auto" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton width="150px" height="0.875rem" />
        <div className="flex gap-1.5">
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 3: Product / Portfolio Card Grid
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left" id="skeleton-grid">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-200 rounded-3xl overflow-hidden p-5 space-y-4 shadow-sm"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          {/* Main Visual Box */}
          <Skeleton height="180px" className="rounded-2xl" />

          {/* Details */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton width="30%" height="0.75rem" />
              <Skeleton width="20%" height="0.75rem" />
            </div>
            <Skeleton width="90%" height="1.125rem" />
            <div className="space-y-1.5 pt-1">
              <Skeleton width="100%" height="0.75rem" />
              <Skeleton width="65%" height="0.75rem" />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <Skeleton width="40%" height="1.25rem" />
            <Skeleton width="80px" height="2rem" className="rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Composite Skeleton 4: Detail Specs Page / Content View
export function SkeletonDetail() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-detail">
      {/* Top Breadcrumb & Actions */}
      <div className="flex justify-between items-center">
        <Skeleton width="180px" height="0.875rem" />
        <Skeleton width="100px" height="2rem" className="rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Heavy images or documents */}
        <div className="lg:col-span-5 space-y-4">
          <Skeleton height="350px" className="rounded-3xl" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((idx) => (
              <Skeleton key={idx} height="70px" className="rounded-xl" />
            ))}
          </div>
        </div>

        {/* Right column: Form details, specs */}
        <div className="lg:col-span-7 space-y-5">
          <div className="space-y-2">
            <Skeleton width="25%" height="0.75rem" />
            <Skeleton width="85%" height="2rem" />
            <Skeleton width="55%" height="1rem" />
          </div>

          <div className="border-t border-b border-slate-150 py-4.5 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton width="40%" height="0.75rem" />
                <Skeleton width="80%" height="1.125rem" />
              </div>
              <div className="space-y-1.5">
                <Skeleton width="30%" height="0.75rem" />
                <Skeleton width="70%" height="1.125rem" />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Skeleton width="100%" height="0.75rem" />
            <Skeleton width="100%" height="0.75rem" />
            <Skeleton width="85%" height="0.75rem" />
            <Skeleton width="40%" height="0.75rem" />
          </div>

          <div className="flex gap-3 pt-4">
            <Skeleton width="140px" height="2.5rem" className="rounded-xl" />
            <Skeleton width="100px" height="2.5rem" className="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 5: Form Elements
export function SkeletonForm() {
  return (
    <div className="space-y-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 w-full text-left" id="skeleton-form">
      <div className="space-y-2 pb-2 border-b border-slate-100">
        <Skeleton width="40%" height="1.5rem" />
        <Skeleton width="65%" height="0.875rem" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="space-y-1.5">
            <Skeleton width="35%" height="0.75rem" />
            <Skeleton height="2.5rem" className="rounded-xl" />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Skeleton width="20%" height="0.75rem" />
        <Skeleton height="6rem" className="rounded-xl" />
      </div>

      <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
        <Skeleton width="90px" height="2.5rem" className="rounded-xl" />
        <Skeleton width="120px" height="2.5rem" className="rounded-xl" />
      </div>
    </div>
  );
}

// Composite Skeleton 6: Customer CRM - mirrors the real two-panel layout
// (search + registered-clients list on the left, a detail/empty-state panel
// on the right), NOT a generic table or card grid, since that's not what
// this screen actually looks like.
export function SkeletonCRM() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 w-full text-left" id="skeleton-crm">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton width="55%" height="1.25rem" />
          <Skeleton width="70px" height="2rem" className="rounded-xl" />
        </div>
        <Skeleton height="2.25rem" className="rounded-xl" />
        <div className="space-y-2 pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ animationDelay: `${i * 60}ms` }}>
              <Skeleton width="2.25rem" height="2.25rem" circle />
              <div className="flex-1 space-y-1.5">
                <Skeleton width="70%" height="0.8rem" />
                <Skeleton width="45%" height="0.7rem" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Skeleton width="3.5rem" height="3.5rem" circle />
          <div className="space-y-1.5 flex-1">
            <Skeleton width="45%" height="1.1rem" />
            <Skeleton width="30%" height="0.8rem" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="4.5rem" className="rounded-xl" />
          ))}
        </div>
        <div className="space-y-2.5">
          <Skeleton width="30%" height="0.875rem" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="2.75rem" className="rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 7: Warehouse Stock - product cards with a stock-level
// bar, matching InventoryManager's real card grid rather than a plain table.
export function SkeletonInventory() {
  return (
    <div className="space-y-4 w-full text-left" id="skeleton-inventory">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Skeleton width="240px" height="2.25rem" className="rounded-xl" />
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton width="110px" height="2.25rem" className="rounded-xl" />
          <Skeleton width="110px" height="2.25rem" className="rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <Skeleton width="75%" height="0.95rem" />
                <Skeleton width="40%" height="0.7rem" />
              </div>
              <Skeleton width="1.75rem" height="1.75rem" className="rounded-lg" />
            </div>
            <Skeleton height="0.5rem" className="rounded-full" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton width="35%" height="0.8rem" />
              <Skeleton width="25%" height="0.8rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Composite Skeleton 8: Invoice/Receipt/Estimate Builder - the real layout
// is a form on the left and a live A4-shaped document preview on the
// right, nothing like a plain data table.
export function SkeletonBillingBuilder() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full text-left" id="skeleton-billing">
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex gap-2">
          <Skeleton width="33%" height="2.25rem" className="rounded-xl" />
          <Skeleton width="33%" height="2.25rem" className="rounded-xl" />
          <Skeleton width="33%" height="2.25rem" className="rounded-xl" />
        </div>
        <Skeleton height="2.75rem" className="rounded-xl" />
        <Skeleton height="2.75rem" className="rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton height="2.5rem" className="rounded-xl" />
          <Skeleton height="2.5rem" className="rounded-xl" />
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <Skeleton width="40%" height="0.8rem" />
          <Skeleton height="3.5rem" className="rounded-xl" />
          <Skeleton height="3.5rem" className="rounded-xl" />
        </div>
      </div>
      {/* Live preview panel - kept at roughly A4 proportions (1:1.414) to
          match the real #mockup-document-view sizing, see index.css. */}
      <div
        className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
        style={{ aspectRatio: "210 / 297", maxHeight: "820px" }}
      >
        <div className="flex justify-between items-start">
          <Skeleton width="2.75rem" height="2.75rem" className="rounded-xl" />
          <Skeleton width="30%" height="1rem" />
        </div>
        <Skeleton width="55%" height="0.875rem" />
        <div className="space-y-2 pt-3 border-t border-slate-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="2.25rem" />
          ))}
        </div>
        <div className="pt-4 flex justify-end">
          <Skeleton width="40%" height="2.5rem" className="rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 9: Reports & Wisdom - stat cards plus chart-shaped
// (not generic-rectangle) placeholders, matching FinancialReports' actual
// heavy use of charts.
export function SkeletonReportsCharts() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-reports">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <Skeleton width="60%" height="0.75rem" />
            <Skeleton width="80%" height="1.5rem" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <Skeleton width="35%" height="1.1rem" />
        {/* Chart-shaped, not a plain rectangle: a baseline plus staggered
            bars reads immediately as "a chart is coming", which a flat
            block doesn't. */}
        <div className="flex items-end gap-2 h-40 pt-4">
          {[55, 80, 45, 70, 90, 60, 75].map((h, i) => (
            <Skeleton key={i} width="100%" height={`${h}%`} className="rounded-t-md" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
        <Skeleton width="30%" height="1rem" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="1rem" width={`${85 - i * 12}%`} />
        ))}
      </div>
    </div>
  );
}

// Composite Skeleton 10: Full app shell, used only for session
// restore/initial sync (see App.tsx's showAuthLoadingScreen) - the
// previous version of this was a centered spinner + "Syncing..." text,
// which is exactly the generic pattern to avoid: it gave no sense of the
// page about to appear. This reproduces the sidebar + top banner + content
// grid shape instead.
export function SkeletonAppShell() {
  return (
    <div className="min-h-screen bg-slate-50 flex" id="skeleton-app-shell" role="status" aria-busy="true">
      <span className="sr-only">Loading your workspace...</span>
      <div className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200 p-5 flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <Skeleton width="2.25rem" height="2.25rem" className="rounded-xl" />
          <Skeleton width="60%" height="1rem" />
        </div>
        <Skeleton height="2.5rem" className="rounded-xl" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="2.25rem" className="rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-6">
        <Skeleton height="4.5rem" className="rounded-2xl" />
        <SkeletonDashboard />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin portal skeletons (src/admin/*.tsx). Same "matches the real shape"
// rule as everything above - the admin screens previously just showed plain
// "Loading..." text with nothing to do with what was about to render.
// ---------------------------------------------------------------------------

// Mirrors AdminDashboardHome: 5 colored stat cards + the "what each screen
// does" info card. Cards stay neutral gray here rather than mimicking each
// card's real color - a skeleton in someone else's brand colors reads as a
// rendering bug, not a loading state.
export function SkeletonAdminDashboard() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-admin-dashboard">
      <div className="space-y-2">
        <Skeleton width="30%" height="1.1rem" />
        <Skeleton width="50%" height="0.8rem" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-slate-100 rounded-2xl p-5 space-y-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between">
              <Skeleton width="60%" height="0.7rem" className="bg-slate-200" />
              <Skeleton width="2.25rem" height="2.25rem" className="rounded-xl bg-slate-200" />
            </div>
            <Skeleton width="35%" height="1.5rem" className="bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="border border-slate-200 rounded-2xl p-5 space-y-2.5">
        <Skeleton width="35%" height="0.9rem" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height="0.75rem" width={`${90 - i * 8}%`} />
        ))}
      </div>
    </div>
  );
}

// Mirrors FeatureFlagsPanel: an intro line, then a stack of flag cards each
// with a name + phase badge, a description line, and a toggle switch shape.
export function SkeletonAdminFlags() {
  return (
    <div className="space-y-3 w-full text-left" id="skeleton-admin-flags">
      <Skeleton width="80%" height="0.8rem" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton width="35%" height="0.85rem" />
              <Skeleton width="15%" height="0.6rem" className="rounded" />
            </div>
            <Skeleton width="70%" height="0.7rem" />
          </div>
          <Skeleton width="2.5rem" height="1.375rem" className="rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Mirrors AnnouncementsPanel / SurveysPanel: a composer card (title input,
// message/description area, submit button) followed by a short list of
// already-sent items - both screens share this same "compose then list"
// shape, just with different field counts.
export function SkeletonAdminComposer() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-admin-composer">
      <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <Skeleton width="45%" height="0.9rem" />
        <Skeleton width="70%" height="0.75rem" />
        <Skeleton height="2.25rem" className="rounded-xl" />
        <Skeleton height="4.5rem" className="rounded-xl" />
        <Skeleton width="140px" height="2.25rem" className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton width="30%" height="0.85rem" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-slate-200 rounded-2xl p-4 space-y-1.5" style={{ animationDelay: `${i * 60}ms` }}>
            <Skeleton width="40%" height="0.85rem" />
            <Skeleton width="80%" height="0.7rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

// A shorter list-only version of SkeletonAdminComposer's bottom half - for
// AnnouncementsPanel/SurveysPanel, whose composer form renders immediately
// (it needs no data fetch) and only the "already sent" list below it is
// actually loading.
export function SkeletonAdminItemList({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2 w-full text-left" id="skeleton-admin-item-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-4" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="space-y-1.5 flex-1">
            <Skeleton width="40%" height="0.85rem" />
            <Skeleton width="80%" height="0.7rem" />
          </div>
          <Skeleton width="70px" height="1.75rem" className="rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Mirrors BrandingPanel: two side-by-side upload slots (logo/favicon) plus
// a documents list with an upload link.
export function SkeletonAdminBranding() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-admin-branding">
      <Skeleton width="90%" height="0.8rem" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-slate-200 rounded-2xl p-4 space-y-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2">
              <Skeleton width="2rem" height="2rem" className="rounded-lg" />
              <Skeleton width="50%" height="0.8rem" />
            </div>
            <Skeleton height="2.25rem" className="rounded-xl" />
          </div>
        ))}
      </div>
      <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
        <Skeleton width="25%" height="0.85rem" />
        <Skeleton width="60%" height="0.7rem" />
      </div>
    </div>
  );
}
