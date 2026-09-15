import React, { useState } from "react";
import {
  Stack as Layers2,
  Coins,
  Users,
  UsersThree,
  DotsThreeOutline as MoreIcon,
  ChartLine as LineChart,
  Brain as BrainCircuit,
  BookOpen,
  Target,
  Warehouse,
  Package,
  CurrencyCircleDollar,
  MagicWand as Sparkles,
  Question as HelpCircle,
  GearSix,
  SignOut as LogOut,
  X,
} from "@phosphor-icons/react";

interface MobileNavBarProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  isEnabled: (key: string) => boolean;
  /** Current account's plan (basic/standard/pro) - undefined when signed
   * out/guest, in which case neither the plan row nor sign-out show. */
  tier?: string;
  upgradeUrl?: string | null;
  nextTier?: string | null;
  onLogout?: () => void;
}

const PRIMARY_TABS = [
  { id: "dashboard", label: "Scorecard", icon: Layers2, flag: "core_dashboard" },
  { id: "billing", label: "Billing", icon: Coins, flag: "core_billing" },
  { id: "crm", label: "Customers", icon: Users, flag: "core_customers" },
  { id: "ai", label: "AI Advisor", icon: BrainCircuit, flag: "core_ai_advisor" },
];

/**
 * Replaces the horizontal-scrolling pill row (the desktop sidebar's <nav>,
 * still used as-is on md+ screens) on small screens. That row had no visual
 * hint it was scrollable at all - on a phone it just looked like the nav
 * stopped after 2-3 items, which is exactly the "there's no nav bar" bug
 * report this fixes. A fixed bottom tab bar is always fully visible with
 * no scrolling required, and is the standard mobile nav pattern.
 */
export default function MobileNavBar({ activeTab, onChangeTab, isEnabled, tier, upgradeUrl, nextTier, onLogout }: MobileNavBarProps) {
  const [showMore, setShowMore] = useState(false);

  const visiblePrimaryTabs = PRIMARY_TABS.filter((tab) => isEnabled(tab.flag));

  const moreItems = [
    { id: "reports", label: "Reports & Wisdom", icon: LineChart, show: isEnabled("core_reports") },
    { id: "guide", label: "App Guide & Academy", icon: BookOpen, show: isEnabled("core_app_guide") },
    { id: "wealth", label: "Wealth & Goals", icon: Target, show: isEnabled("net_worth_investments") },
    { id: "stock", label: "Warehouse Stock", icon: Warehouse, show: isEnabled("inventory_management") },
    { id: "purchaseOrders", label: "Purchase Orders", icon: Package, show: isEnabled("purchase_orders") },
    { id: "team", label: "Team", icon: UsersThree, show: isEnabled("team_memberships_invite_ui") },
    { id: "exchangeRates", label: "Exchange Rates", icon: CurrencyCircleDollar, show: isEnabled("exchange_rate_live_switching") },
    { id: "monetize", label: "Updates & Growth", icon: Sparkles, show: isEnabled("ad_monetization_hub") },
    { id: "helpSupport", label: "Help & Support", icon: HelpCircle, show: isEnabled("core_help_support") },
    { id: "settings", label: "Settings", icon: GearSix, show: isEnabled("core_settings") },
  ].filter((item) => item.show);

  const isMoreActive = moreItems.some((item) => item.id === activeTab);

  const handleSelect = (tab: string) => {
    onChangeTab(tab);
    setShowMore(false);
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {visiblePrimaryTabs.map((tab) => {
          const TabIcon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
                active ? "text-brand-navy" : "text-slate-400"
              }`}
            >
              <TabIcon className="w-5 h-5" weight={active ? "fill" : "regular"} />
              <span className={`text-[9px] font-bold ${active ? "font-black" : ""}`}>{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
            isMoreActive ? "text-brand-navy" : "text-slate-400"
          }`}
        >
          <MoreIcon className="w-5 h-5" weight={isMoreActive ? "fill" : "regular"} />
          <span className={`text-[9px] font-bold ${isMoreActive ? "font-black" : ""}`}>More</span>
        </button>
      </nav>

      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="More navigation">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowMore(false)} />
          <div
            className="relative w-full bg-white rounded-t-3xl p-4 pb-6 space-y-1.5 animate-fade-in"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">More</span>
              <button onClick={() => setShowMore(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {moreItems.map((item) => {
              const ItemIcon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm cursor-pointer transition-colors ${
                    active ? "bg-brand-navy text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <ItemIcon className="w-4.5 h-4.5 shrink-0" /> {item.label}
                </button>
              );
            })}

            {/* Plan + sign out: last, and only here on mobile/tablet - the
                desktop sidebar shows both directly instead (always
                visible there, so no need to bury them in a sheet). */}
            {tier && (
              <div className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 mt-2">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-slate-450 uppercase tracking-widest">Plan</span>
                  <span className="text-sm font-bold text-slate-800 capitalize">{tier}</span>
                </div>
                {upgradeUrl && (
                  <a
                    href={upgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 capitalize"
                  >
                    Upgrade to {nextTier}
                  </a>
                )}
              </div>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm cursor-pointer text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="w-4.5 h-4.5 shrink-0" /> Log out
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
