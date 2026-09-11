import React, { useEffect, useState } from "react";
import { BookOpen, Question as HelpCircle, Database, SquaresFour as LayoutDashboard, Receipt, Users, Package, Bank as Landmark, ChartLine as LineChart, MagicWand as Sparkles, WarningCircle as AlertCircle, ShoppingBag, Briefcase, FileText, Compass, CaretRight as ChevronRight, TrendUp as TrendingUp, Percent, Stack as Layers, Certificate as Award, BookmarkSimple as BookMarked, Globe, Microphone, Lightbulb, ShieldCheck, Rocket, LinkSimple, Brain, Scales, LockKey, User, Wrench, ClipboardText, UsersThree, CurrencyCircleDollar, Megaphone, Buildings } from "@phosphor-icons/react";
import { useFeatureFlags } from "../lib/featureFlags";

type ChapterId = "overview" | "scorecard" | "billing" | "inventory" | "sovereign" | "ai" | "playbooks" | "personal" | "tools" | "growth";

// Each chapter's `flag` ties it to the same feature flag that gates the
// feature itself (see src/lib/featureFlags.ts) - flip it on in the admin
// portal and this chapter appears here automatically, no separate step.
// `flag: null` means always visible (core Phase 1, not behind any flag).
const CHAPTERS: { id: ChapterId; label: string; desc: string; icon: any; flag: string | null }[] = [
  { id: "overview", label: "Guide Overview", desc: "Philosophies & Setup", icon: Compass, flag: null },
  { id: "scorecard", label: "Cash Scorecards", desc: "Gross Margin & Ledgers", icon: LayoutDashboard, flag: null },
  { id: "billing", label: "Invoices & Receipts", desc: "Billing & Share links", icon: Receipt, flag: null },
  { id: "inventory", label: "Smart Warehouse", desc: "Stocks & Auto-deduction", icon: Package, flag: "inventory_management" },
  { id: "sovereign", label: "Sovereign Reserves", desc: "T-Bill Ladder & Yields", icon: Landmark, flag: "net_worth_investments" },
  { id: "personal", label: "Personal Workspace", desc: "Your Own Money, Separately", icon: User, flag: "personal_workspace" },
  { id: "tools", label: "Advanced Billing Tools", desc: "Purchase Orders, Team, Templates", icon: Wrench, flag: null },
  { id: "growth", label: "Growth & Multi-Business", desc: "Ad Hub & Second Ventures", icon: TrendingUp, flag: null },
  { id: "ai", label: "CFO AI & Advisors", desc: "Advisory & Simulators", icon: Sparkles, flag: null },
  { id: "playbooks", label: "SME Playbooks", desc: "Tactical Retailer & Freelancer", icon: BookMarked, flag: null }
];

export default function AppGuide() {
  const { isEnabled } = useFeatureFlags();
  const [activeChapter, setActiveChapter] = useState<ChapterId>("overview");
  const visibleChapters = CHAPTERS.filter((c) => c.flag === null || isEnabled(c.flag));

  // If a chapter's flag gets turned off from the admin portal while it's the
  // active one (or on first load if it was never visible), fall back to the
  // guide overview instead of showing a blank/stale pane.
  useEffect(() => {
    if (!visibleChapters.some((c) => c.id === activeChapter)) {
      setActiveChapter("overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter, visibleChapters.map((c) => c.id).join(",")]);

  // State for interactive widgets
  const [ladderCapital, setLadderCapital] = useState<number>(20000);
  const [ladderStages, setLadderStages] = useState<number>(4);
  const [ladderYield, setLadderYield] = useState<number>(18.5);

  const [marginCost, setMarginCost] = useState<number>(60);
  const [marginPrice, setMarginPrice] = useState<number>(100);

  // Computed Values for Sovereign Ladder Widget
  const stageCapital = ladderCapital / ladderStages;
  const stageMaturityDays = Math.round(91 / ladderStages);
  const annualInterestPerStage = stageCapital * (ladderYield / 100);
  const cycleInterestPerStage = annualInterestPerStage * (91 / 365);

  // Computed Values for Margin Widget
  const productProfit = marginPrice - marginCost;
  const grossMarginPercent = marginPrice > 0 ? (productProfit / marginPrice) * 100 : 0;
  const markupPercent = marginCost > 0 ? (productProfit / marginCost) * 100 : 0;

  return (
    <div id="app-guide-academy" className="space-y-8 text-slate-800 font-sans pb-12 select-none animate-fade-in text-left">
      
      {/* Top Hero Banner */}
      <div className="bg-brand-teal text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="max-w-3xl space-y-3">
          <span className="bg-white/20 text-white border border-white/30 text-[10px] font-mono tracking-widest uppercase font-black px-3 py-1 rounded-full inline-block">
            Aziiki Academy & Manual
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-white">
            Master the Art of SME Financial Engineering
          </h2>
          <p className="text-xs sm:text-sm text-white leading-relaxed font-light max-w-2xl">
            Welcome to the Academy. Move beyond simple data entry. Here, you will learn how to organize your cash channels, protect your trading margins, and get the most out of your CFO AI Advisor.
          </p>
        </div>
      </div>

      {/* Interactive Navigation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Chapter Navigation Sidebar */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-4.5 space-y-2 shadow-sm shrink-0">
          <span className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block px-2.5 pb-2 border-b border-slate-100">
            Academy Syllabus
          </span>
          
          <nav className="space-y-1 pt-2">
            {visibleChapters.map((chapter) => {
              const active = activeChapter === chapter.id;
              const ChapterIcon = chapter.icon;
              return (
                <button
                  key={chapter.id}
                  onClick={() => setActiveChapter(chapter.id as any)}
                  className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex flex-col gap-0.5 select-none ${
 active
 ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10 font-bold"
 : "hover:bg-slate-50 text-slate-650"
 }`}
                >
                  <span className="text-xs flex items-center gap-1.5">
                    <ChapterIcon className="w-3.5 h-3.5 shrink-0" />
                    {chapter.label}
                  </span>
                  <span className={`text-[10px] font-light ${active ? "text-emerald-105 text-emerald-200" : "text-slate-450"}`}>
                    {chapter.desc}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Active Chapter Screen */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* CHAPTER 1: OVERVIEW */}
          {activeChapter === "overview" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter I
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-emerald-600" />
                  Introduction to the Aziiki Philosophy
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Understanding the heritage, design principles, and your non-custodial security.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                <div className="space-y-3.5">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono text-indigo-600 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 shrink-0" /> Cultural Origin & Meaning
                  </h4>
                  <p className="text-slate-650 font-light">
                    <strong className="font-semibold text-slate-900">Aziiki</strong> is inspired by the <strong className="font-semibold text-slate-950">Hausa word "arziki"</strong>, spoken across West Africa and widely understood well beyond it.
                  </p>

                  {/* Pronunciation & Phonetic Breakdown Card */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 space-y-2">
                    <span className="text-[9px] font-mono font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Microphone className="w-3 h-3 shrink-0" /> How to Pronounce It
                    </span>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-extrabold text-slate-900">/ah-ZEE-kee/</span>
                      <span className="text-xs font-medium text-emerald-600 font-mono">"ah-ZEE-kee"</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-light leading-normal">
                      Open with a relaxed <strong className="font-semibold text-slate-700">"ah"</strong> (like in "father"), land firmly on the stressed middle syllable <strong className="font-medium text-slate-850">"ZEE"</strong>, then close softly with <strong className="font-medium text-slate-850">"kee."</strong>
                    </p>
                  </div>

                  <p className="text-slate-650 font-light">
                    "Arziki" means <strong className="font-semibold text-slate-900">wealth, riches, and prosperity</strong>. It reflects our vision of helping entrepreneurs not only manage their businesses, but understand, protect, and grow the wealth they create.
                  </p>
                  <p className="text-slate-650 font-light">
                    Aziiki is not just about recording money moving in and out. It's about understanding what you earn, what you're owed, what you own, and how all of it adds up - your business, and your wealth, taken together.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono text-indigo-600 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0" /> Why Aziiki Exists
                  </h4>
                  <p className="text-slate-650 font-light">
                    Traditional accounting is heavy, filled with double-entry terminology, and hardwired into credit structures that do not support localized cash drawers, Mobile Money, and asset preservation.
                  </p>
                  <p className="text-slate-650 font-light">
                    Aziiki gathers split operational channels—cash drawers, mobile accounts, warehouse units, customer debts, and billing PDFs—into a single high-performance workspace.
                  </p>
                  <p className="text-slate-650 font-light">
                    We replace intimidating words like <em>"accounts receivable"</em> with direct phrases like <em>"money customers owe you"</em> so you can focus on building cash velocity, not studying accounting books.
                  </p>
                </div>
              </div>

              {/* Security Banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
                <Database className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-emerald-800 uppercase text-[9px] tracking-wider flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Passive Non-Custodial Integrity
                  </span>
                  <p className="text-slate-650 font-light text-[11px]">
                    Aziiki is a <strong className="font-semibold text-slate-900">pure bookkeeping ledger</strong>. We do NOT hold custody of your capital, link directly to your central bank reserves, or execute financial transactions on your behalf. All data is backed up safely to your local browser storage and secure synced cloud profiles. You are always in absolute sovereign control.
                  </p>
                </div>
              </div>

              {/* Startup Steps */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                  Quick Getting Started Sequence
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
                  <div className="p-3.5 border border-slate-150 rounded-2xl space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black flex items-center justify-center">1</span>
                    <strong className="text-slate-900 block pt-1">Settings Profile</strong>
                    <p className="text-slate-500 text-[11px] font-light">Click Edit in the sidebar to define your home currency, business legal structure, and custom brand logo.</p>
                  </div>
                  <div className="p-3.5 border border-slate-150 rounded-2xl space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black flex items-center justify-center">2</span>
                    <strong className="text-slate-900 block pt-1">Fill the Warehouse</strong>
                    <p className="text-slate-500 text-[11px] font-light">Log your product stocks, cost pricing, and safety stock levels inside the Warehouse module.</p>
                  </div>
                  <div className="p-3.5 border border-slate-150 rounded-2xl space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black flex items-center justify-center">3</span>
                    <strong className="text-slate-900 block pt-1">Seed Your Ledger</strong>
                    <p className="text-slate-500 text-[11px] font-light">Enter 2-3 recent sale records or expense items to see your dynamic cash flow metrics update.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 2: SCORECARDS & LEDGERS */}
          {activeChapter === "scorecard" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter II
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-emerald-600" />
                  SME Cash Scorecards & Ledgers
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Track the velocity of cash flow, monitor expenses, and maximize net operating profit margins.
                </p>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <p className="text-slate-650 font-light">
                  The <strong className="font-semibold text-slate-900">Cash Scorecard</strong> is the financial dashboard of your enterprise. It acts as the ultimate digital cash drawer, representing how capital rolls through your daily operations.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Dynamic Cash Flow Ledgers
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Every transaction represents an exchange of value. By logging transactions, you tell the ledger whether cash is trapped inside a physical bank account, floating in mobile wallets (like MTN MoMo or Orange), or resting inside physical safes.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Percent className="w-4 h-4 text-indigo-600" />
                      Operating Profit Margins
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Profit margins show what percentage of your revenue actually belongs to you as retained earnings. Standard enterprise targets represent a healthy gross margin of at least 40% to absorb rising regional utility and raw material overheads.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono text-indigo-600 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0" /> How to Get Maximum Value from Your Ledgers
                  </h4>
                  <ul className="space-y-2.5 list-disc pl-5 text-slate-650 font-light">
                    <li>
                      <strong>Real-Time Audits:</strong> Enter your transactions immediately at point of sale. Allowing receipts to accumulate results in ledger drift and hidden capital leaks.
                    </li>
                    <li>
                      <strong>Categorize Wisely:</strong> Tag expenses into explicit structural codes (e.g. <em>Rent, Utilities, Logistics, Fuel, Inventory Sourcing</em>). This allows the CFO AI to precisely pinpoint which channel is draining your liquidity.
                    </li>
                    <li>
                      <strong>Separate Private Accounts:</strong> Never mix household personal cash-outs with registered trading operations. Use standard salary logs to maintain independent business structures.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 3: INVOICES & RECEIPTS */}
          {activeChapter === "billing" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter III
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  Billing & WhatsApp Direct Dispatch
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Craft beautiful invoices, send estimates to secure deals, and print professional payment receipts.
                </p>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <p className="text-slate-650 font-light">
                  A professional client experience accelerates invoice payment turnaround. The <strong className="font-semibold text-slate-900">Billing Desk</strong> replaces expensive billing systems, compiling standard-compliant billing files that render beautifully on mobile screens.
                </p>

                <div className="border border-slate-150 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 p-3 font-mono text-[9px] uppercase tracking-wider font-bold text-slate-450 border-b border-slate-150">
                    Document Flow Lifecycle
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center font-sans">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-900 block">1. Draft Estimate</span>
                      <p className="text-[11px] text-slate-500 font-light">Issue an itemized bid with a defined expiry date. Great for securing initial customer agreements before purchasing inventory.</p>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-150 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-xs font-bold text-slate-900 block">2. Official Invoice</span>
                      <p className="text-[11px] text-slate-500 font-light">Confirm the transaction with itemized VAT or custom regional tax settings. Triggers active receivables tracking inside the CRM.</p>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-150 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-xs font-bold text-emerald-600 block">3. Payment Slip</span>
                      <p className="text-[11px] text-slate-500 font-light">Mark as paid to generate a print-ready receipt. This automatically reduces linked safety stock counts in your inventory database.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono text-indigo-600 flex items-center gap-1.5">
                    <Rocket className="w-3.5 h-3.5 shrink-0" /> WhatsApp Direct Link Sharing
                  </h4>
                  <p className="text-slate-650 font-light">
                    African trading runs on message threads. Instead of emailing heavy attachments that get ignored, tap the <strong className="font-semibold text-emerald-600">"WhatsApp Share"</strong> button. Aziiki automatically copies a professional invitation template and a direct-sharing link. Your customer can click this link on any phone to instantly review their document!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 4: SMART WAREHOUSE */}
          {activeChapter === "inventory" && isEnabled("inventory_management") && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter IV
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Smart Warehouse Stock Room
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Track physical units, audit pricing structures, and prevent stockouts with automated thresholds.
                </p>
              </div>

              <div className="space-y-5 text-xs leading-relaxed">
                <p className="text-slate-650 font-light">
                  Capital can become locked up inside physical shelves in the form of sitting inventory. The <strong className="font-semibold text-slate-900">Smart Warehouse</strong> helps you monitor stock values and alerts you when critical items are running dry.
                </p>

                {/* INTERACTIVE COMPONENT: SME PRODUCT MARGIN CALCULATOR */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-indigo-600" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      Interactive Product Margin Calculator
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Test your pricing structures. Input your wholesale acquisition cost and retail price below to evaluate your gross profit margins and necessary product markups.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Unit Wholesale Cost</label>
                      <input
                        type="number"
                        value={marginCost}
                        onChange={(e) => setMarginCost(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Unit Retail Price</label>
                      <input
                        type="number"
                        value={marginPrice}
                        onChange={(e) => setMarginPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-slate-150 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">Net Profit Margin</span>
                      <strong className="text-emerald-600 font-mono text-sm block mt-1">
                        +{productProfit >= 0 ? "" : "-"}${Math.abs(productProfit).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">Gross Margin %</span>
                      <strong className="text-indigo-600 font-mono text-sm block mt-1">
                        {grossMarginPercent.toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">Product Markup %</span>
                      <strong className="text-[color:var(--color-brand-teal)] font-mono text-sm block mt-1">
                        {markupPercent.toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  {grossMarginPercent < 35 && (
                    <p className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 font-sans font-light italic leading-snug flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>Margin Alert: Your profit margin sits below the recommended 35%. Inflationary pressures or shipping hikes may easily wipe out your profitability. Consider optimized purchasing or repricing.</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3.5">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono text-indigo-600 flex items-center gap-1.5">
                    <LinkSimple className="w-3.5 h-3.5 shrink-0" /> Automated Stock Auto-Reduction
                  </h4>
                  <p className="text-slate-650 font-light">
                    You do not need to manually log inventory subtractions after every deal. In Aziiki, when you create an invoice and list your items with identical names as those logged in your Smart Warehouse, marking that Invoice as <strong className="font-semibold text-emerald-600">"Paid"</strong> automatically reduces the inventory matching those listed quantities! This keeps your warehouse synchronized with your physical cash drawer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 5: SOVEREIGN RESERVES & T-BILLS */}
          {activeChapter === "sovereign" && isEnabled("net_worth_investments") && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter V
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-600" />
                  Sovereign reserves & High-Yield Preservation
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Understand non-custodial capital preservation and build rolling T-Bill ladders to beat inflation.
                </p>
              </div>

              <div className="space-y-5 text-xs leading-relaxed">
                <p className="text-slate-650 font-light">
                  Inflation can erode your static cash reserves. To protect your company's working runway, you should deploy surplus capital into highly secure, liquid sovereign paper (like Treasury Bills) instead of letting money sit dormant in basic checking accounts.
                </p>

                {/* INTERACTIVE COMPONENT: T-BILL LADDERING SIMULATOR */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4.5 h-4.5 text-emerald-600" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">
                      Interactive Sovereign T-Bill Laddering Simulator
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Sovereign laddering spreads your money across multiple rolling investments. When one T-Bill matures, you roll it over or spend it. Use this simulator to split your reserves across rolling cycles:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block">Total Reserve Capital</label>
                      <input
                        type="number"
                        step="1000"
                        value={ladderCapital}
                        onChange={(e) => setLadderCapital(Math.max(1000, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block">Number of Ladder Stages</label>
                      <select
                        value={ladderStages}
                        onChange={(e) => setLadderStages(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-xs text-slate-900"
                      >
                        <option value={3}>3 Stages (Every ~30 days)</option>
                        <option value={4}>4 Stages (Every ~22 days)</option>
                        <option value={6}>6 Stages (Every ~15 days)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block">Expected Yield (% APY)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={ladderYield}
                        onChange={(e) => setLadderYield(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-mono text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-slate-150 space-y-3.5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                      <div className="border-r border-slate-150">
                        <span className="text-[8px] font-mono text-slate-400 block uppercase">Capital per Stage</span>
                        <strong className="text-slate-900 font-mono text-xs block mt-0.5">${stageCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                      </div>
                      <div className="border-r border-slate-150">
                        <span className="text-[8px] font-mono text-slate-400 block uppercase">Maturity Cycles</span>
                        <strong className="text-slate-900 font-mono text-xs block mt-0.5">Every {stageMaturityDays} Days</strong>
                      </div>
                      <div className="border-r border-slate-150">
                        <span className="text-[8px] font-mono text-slate-400 block uppercase">Stage Cycle Profit</span>
                        <strong className="text-emerald-600 font-mono text-xs block mt-0.5">+${cycleInterestPerStage.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span className="text-[8px] font-mono text-slate-400 block uppercase">Annual Net Profit</span>
                        <strong className="text-emerald-600 font-mono text-xs block mt-0.5">+${(annualInterestPerStage).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-150">
                      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block mb-1.5">Visualizing Your Ladder Stages (91-Day Sovereign Cycle)</span>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {Array.from({ length: ladderStages }).map((_, idx) => {
                          const delayDays = (idx * stageMaturityDays);
                          return (
                            <div key={idx} className="bg-slate-50 p-2 border border-slate-200 rounded-lg text-center font-sans space-y-0.5">
                              <span className="text-[8px] font-mono font-bold text-indigo-600 block uppercase">T-Bill {idx + 1}</span>
                              <strong className="text-[10px] text-slate-900 block font-mono">${stageCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                              <span className="text-[8px] text-slate-450 block">Matures Day: {delayDays}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono text-indigo-600 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 shrink-0" /> Sourcing Real-Time Global Market Indices
                  </h4>
                  <p className="text-slate-650 font-light">
                    Inside the SME Investment Desk, use the **Live Sourcing Desk** to search for real-time central bank policy rates, sovereign bond yields, and regional consumer inflation metrics from online databases. By comparing these live figures against your business's average yields, you can identify if your hard-earned profits are gaining or losing ground against inflation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 6: PERSONAL WORKSPACE */}
          {activeChapter === "personal" && isEnabled("personal_workspace") && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter VI
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  Personal Workspace: Your Own Money, Separately
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  A private ledger for household income and spending, kept entirely apart from your business books.
                </p>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <p className="text-slate-650 font-light">
                  Mixing personal and business cash is one of the fastest ways an SME loses track of its real profitability. The <strong className="font-semibold text-slate-900">Personal Workspace</strong> gives you a second, fully separate ledger — your salary, rent, groceries, and personal savings — that never touches your business Scorecard.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Buildings className="w-4 h-4 text-emerald-600" />
                      One-Tap Switching
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Toggle between your business view and your personal workspace from the sidebar switcher. Each keeps its own transactions, categories, and totals.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <CurrencyCircleDollar className="w-4 h-4 text-indigo-600" />
                      Clean Owner Salary Draws
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Log an owner's draw as a business expense, then record the same amount as personal income — so both ledgers stay honest about where the money actually went.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 7: ADVANCED BILLING TOOLS */}
          {activeChapter === "tools" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter VII
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-emerald-600" />
                  Advanced Billing Tools
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Purchase orders, team access, and live exchange rates, each on its own screen — for SMEs outgrowing the basics.
                </p>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <ClipboardText className="w-4 h-4 text-emerald-600" />
                      Purchase Orders
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Raise a formal purchase order to a supplier before stock arrives, then reconcile it against the delivered items and its final bill. Find it in the sidebar / More menu.
                    </p>
                  </div>
                  <div className="p-4 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <UsersThree className="w-4 h-4 text-indigo-600" />
                      Team & Roles
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Invite staff with scoped roles — cashier, bookkeeper, manager — so your team can help run the books without seeing everything you see.
                    </p>
                  </div>
                  <div className="p-4 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      Live Exchange Rates
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Bill in a foreign currency and let Aziiki convert it at a live rate, so multi-currency deals reconcile correctly against your home-currency ledger.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 8: GROWTH & MULTI-BUSINESS */}
          {activeChapter === "growth" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter VIII
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Growth & Multi-Business
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Running a second venture, or turning your customer base into an audience worth reaching.
                </p>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Buildings className="w-4 h-4 text-emerald-600" />
                      Multiple Businesses, One Login
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Add a second business from the "+New" switcher in the sidebar. Each business keeps its own ledger, customers, and inventory — fully isolated from the others.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Megaphone className="w-4 h-4 text-indigo-600" />
                      Ad Monetization Hub
                    </h5>
                    <p className="text-slate-500 text-[11px] font-light">
                      Once you have a healthy customer list, the Ad Hub helps you package it into simple promotional campaigns and offers you can send to your own audience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 9: AI CFO ADVISORS */}
          {activeChapter === "ai" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter IX
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  CFO AI Advisor & Financial Simulators
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Co-pilot your SME with conversational audits, tax classifications, and yield comparison engines.
                </p>
              </div>

              <div className="space-y-5 text-xs leading-relaxed">
                <p className="text-slate-650 font-light">
                  Having bookkeeping records is only half the battle. Interpreting them is where true business maturity happens. Aziiki provides advanced tools to guide your decision-making.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-150 rounded-2xl space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 shrink-0" /> CFO AI Conversational Assistant
                    </span>
                    <p className="text-[11px] text-slate-500 font-light leading-relaxed">
                      Powered by advanced Gemini AI, the advisor acts as a private, highly educated financial controller. It reads your ledger aggregates to help you identify capital opportunities. Ask it: <em>"Analyze my high-yield portfolio allocations"</em> or <em>"Suggest three expense adjustments based on my current logs."</em>
                    </p>
                  </div>

                  <div className="p-4 border border-slate-150 rounded-2xl space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                      <Scales className="w-3.5 h-3.5 shrink-0" /> Yield Comparison Simulator
                    </span>
                    <p className="text-[11px] text-slate-500 font-light leading-relaxed">
                      Before committing your cash reserves into static commercial accounts, use the yield comparison tools to simulate Sovereign Papers, High-Yield Mutual Funds, and Standard Bank Accounts side-by-side. This helps you calculate opportunity costs clearly.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-slate-600">
                  <span className="font-bold text-amber-700 uppercase text-[9px] font-mono tracking-wider flex items-center gap-1.5 mb-1">
                    <LockKey className="w-3.5 h-3.5 shrink-0" /> Server-Side Privacy Guarantee
                  </span>
                  <p className="text-[11px] font-light leading-relaxed">
                    Any analysis sent to the CFO AI runs strictly via encrypted, server-side requests. Your proprietary customer invoice values, warehouse logs, and contact credentials remain entirely private—never exposed to browser trackers or used to train public models.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CHAPTER 10: PLAYBOOKS */}
          {activeChapter === "playbooks" && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                  Chapter X
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-emerald-600" />
                  SME Operational Playbooks
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Step-by-step strategies designed for distinct business models.
                </p>
              </div>

              <div className="space-y-6 text-xs leading-relaxed">
                
                {/* Playbook A */}
                <div className="space-y-2.5 p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                  <h5 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    Playbook A: The High-Volume Retailer / Boutique Shop
                  </h5>
                  <p className="text-slate-500 text-[11px] font-light">
                    Goal: Track fast stock rotations, prevent shelf stockouts, and protect cash drawer margins.
                  </p>
                  <ol className="space-y-1.5 list-decimal pl-5 text-[11px] text-slate-650 font-light">
                    <li>Log your items in the <strong>Warehouse Stock</strong> room. Input exact unit acquisition cost, target retail price, and safety stock levels (e.g., set to 15 units).</li>
                    <li>When a customer purchases a lot, navigate to <strong>Billing & PDFs</strong> and create an Official Invoice. Add the items, and click save.</li>
                    <li>Mark the Invoice as <strong>"Paid"</strong>. The system automatically reduces the stock inside your Warehouse, and creates an income transaction on your Scorecard.</li>
                    <li>If you receive warnings about a low stock item, immediately review re-ordering margins inside the interactive <strong>Product Margin Calculator</strong>.</li>
                  </ol>
                </div>

                {/* Playbook B */}
                <div className="space-y-2.5 p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                  <h5 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                    Playbook B: The Digital Freelancer / Agency Consultant
                  </h5>
                  <p className="text-slate-500 text-[11px] font-light">
                    Goal: Draft clear project bids, track client payment terms, and reinvest surplus earnings.
                  </p>
                  <ol className="space-y-1.5 list-decimal pl-5 text-[11px] text-slate-650 font-light">
                    <li>Create a profile in the <strong>Customer CRM</strong>. Tag them as <em>VIP Client</em> or <em>Regular Partner</em>.</li>
                    <li>Create a <strong>Draft Estimate</strong> summarizing the creative scope. Use the **WhatsApp Share** button to dispatch it directly to their message box.</li>
                    <li>Once approved, open the document and toggle it to an active <strong>Official Invoice</strong>. This records the project value as outstanding receivables.</li>
                    <li>When the bank transfer lands, mark the invoice as paid and immediately log a portion (e.g. 25%) to your <strong>Sovereign Reserves T-Bills</strong> tracker to build your private cash runway.</li>
                  </ol>
                </div>

                {/* Playbook C */}
                <div className="space-y-2.5 p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                  <h5 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                    <TrendingUp className="w-4 h-4 text-[color:var(--color-brand-teal)]" />
                    Playbook C: The Agri-business / Seasonal Farm Manager
                  </h5>
                  <p className="text-slate-500 text-[11px] font-light">
                    Goal: Navigate seasonal capital lock-ups, track fuel inputs, and secure yields.
                  </p>
                  <ol className="space-y-1.5 list-decimal pl-5 text-[11px] text-slate-650 font-light">
                    <li>Log physical agricultural inputs (fertilizer, feeds) as active safety stocks inside the <strong>Warehouse Stock</strong>.</li>
                    <li>Register seasonal raw operational expenses (tractor fuels, wages) directly under specific categories on your scorecard ledger.</li>
                    <li>In bumper seasons, when bulk client checks arrive, avoid holding all capital in immediate cash accounts. Spread the surplus across a <strong>rolling 91-day T-Bill ladder</strong> to earn passive yield during off-season sowing months.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer support block */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-left space-y-1">
          <strong className="text-slate-900 block font-sans">Have questions about bookkeeping or investments?</strong>
          <p className="text-slate-500 font-light leading-relaxed">
            Our CFO AI is always on hand. Open the <strong>CFO AI Advisor</strong> in the navigation rail to converse directly with an AI financial expert.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-indigo-600 font-black shrink-0">
          <Award className="w-4 h-4" /> Aziiki Academy Certification
        </div>
      </div>

    </div>
  );
}
