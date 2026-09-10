import React, { useState } from "react";
import { Brain as BrainCircuit, MagicWand as Sparkles, Warning as AlertTriangle, TrendUp as TrendingUp, CurrencyDollar as DollarSign, Calendar, TrendDown as TrendingDown, ArrowUpRight, PaperPlaneTilt as Send, CircleNotch as Loader, ChatCircle as MessageSquare, Sparkle, Target } from "@phosphor-icons/react";
import { Transaction, Invoice, Goal, Business } from "../types";

interface AIFieldAssistantProps {
  currentBusiness: Business;
  transactions: Transaction[];
  invoices: Invoice[];
  goals: Goal[];
  currencySymbol: string;
}

interface Message {
  sender: "user" | "cfo";
  text: string;
}

export default function AIFieldAssistant({
  currentBusiness,
  transactions,
  invoices,
  goals,
  currencySymbol
}: AIFieldAssistantProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [diagnosed, setDiagnosed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Custom chat messaging states
  const [userQuery, setUserQuery] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { sender: "cfo", text: "Hello! I am your Aziiki field assistant. I have cross-examined your mobile money ledger entries, capital target milestones, and VAT invoicing files. What strategic assistance or growth scenario planning shall we evaluate today?" }
  ]);

  // Aggregate insights for query payloads
  const [insights, setInsights] = useState<{
    growthDiagnosis: string;
    actionSteps: string[];
    riskRating: "Low" | "Medium" | "High";
    hedgingTactics: string;
  } | null>(null);

  const totalRevenue = transactions
    .filter(t => t.type === "income" && t.businessId === currentBusiness.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense" && t.businessId === currentBusiness.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalRevenue - totalExpenses;

  const outstandingInvoices = invoices
    .filter(inv => inv.businessId === currentBusiness.id && (inv.status === "Sent" || inv.status === "Overdue"))
    .reduce((sum, inv) => {
      const invTotal = inv.items.reduce((acc, current) => acc + (current.quantity * current.rate), 0);
      const taxAmount = (invTotal * inv.taxRate) / 100;
      const discountAmount = (invTotal * inv.discount) / 100;
      return sum + (invTotal + taxAmount - discountAmount - inv.partialPaidAmount);
    }, 0);

  const triggerDiagnosis = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          currency: currentBusiness.currency,
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingInvoices,
          recentTransactions: transactions.filter(t => t.businessId === currentBusiness.id).slice(0, 10),
          userQuery: userQuery
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to parse CFO predictions.");
      }

      setInsights(data);
      setDiagnosed(true);
      
      if (data.aiReply) {
        setChatMessages(prev => [
          ...prev,
          { sender: "cfo", text: data.aiReply }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Something took an unexpected turn with the AI processor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const messageText = userQuery;
    setChatMessages(prev => [...prev, { sender: "user", text: messageText }]);
    setUserQuery("");

    setLoading(true);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          currency: currentBusiness.currency,
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingInvoices,
          recentTransactions: transactions.filter(t => t.businessId === currentBusiness.id).slice(0, 10),
          userQuery: messageText
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI took an wrong detour.");
      
      if (data.aiReply) {
        setChatMessages(prev => [
          ...prev,
          { sender: "cfo", text: data.aiReply }
        ]);
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: "cfo", text: "Apologies, my system connection timed out. Please double-check your Gemini API Key in the settings panel." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const appGuides = [
    { title: "🎨 How to customize Brand?", query: "How do I edit and customize my Company logo, name, and currency? Where does this info sync on my PDF receipts? Also what database is used?" },
    { title: "📥 How does the SMS Parser work?", query: "Can you explain step-by-step how to use the Mobile Money SMS receipt auto-filler?" },
    { title: "📄 How to print PDF invoices?", query: "How do I customize and create brand invoices and quote estimates? How do WhatsApp pay links work?" },
    { title: "📈 What are sovereign yields?", query: "How can I track the live T-bill interest rates using the search grounding tool on Bank of Ghana and Central Bank of Nigeria?" }
  ];

  const handleQuickQuestion = async (queryText: string) => {
    setChatMessages(prev => [...prev, { sender: "user", text: `Guide: ${queryText}` }]);
    setLoading(true);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          currency: currentBusiness.currency,
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingInvoices,
          recentTransactions: transactions.filter(t => t.businessId === currentBusiness.id).slice(0, 10),
          userQuery: queryText
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI took an wrong detour.");
      
      if (data.aiReply) {
        setChatMessages(prev => [
          ...prev,
          { sender: "cfo", text: data.aiReply }
        ]);
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: "cfo", text: "Apologies, my system connection timed out. Please double-check your Gemini API Key in the settings panel." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-assistant-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-800">
      
      {/* LEFT: Business Diagnostic Cockpit Card */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm shadow-emerald-500/5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-1.5">
            <BrainCircuit className="w-5 h-5 text-emerald-600" />
            CFO Diagnostic Desk
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            AI-driven audit telemetry based on active GHS ledger balances.
          </p>
        </div>

        {/* Dynamic Diagnostics visual boxes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-[9px] font-mono text-slate-400 block tracking-widest uppercase">Current Liquidity</span>
            <strong className="text-sm font-extrabold text-emerald-600 font-mono mt-1 block">
              {currencySymbol}{netProfit.toLocaleString()}
            </strong>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-[9px] font-mono text-slate-400 block tracking-widest uppercase">Overdue Collections</span>
            <strong className="text-sm font-extrabold text-amber-600 font-mono mt-1 block">
              {currencySymbol}{outstandingInvoices.toLocaleString()}
            </strong>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-start gap-2 animate-fade-in font-sans">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Execution Warning</p>
              <p className="text-[11px] text-rose-700/90 leading-relaxed mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <button
          onClick={triggerDiagnosis}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-sans text-xs"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin text-white" />
              Scanning Company Ledgers...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Calibrate Growth Diagnosis
            </>
          )}
        </button>

        {/* Diagnostic Results Card / Skeleton Loader */}
        {loading && !insights ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 animate-pulse">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-4 bg-slate-200 rounded w-1/5"></div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-200 rounded w-1/2"></div>
                <div className="h-3 bg-slate-150 rounded w-full"></div>
                <div className="h-3 bg-slate-150 rounded w-11/12"></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-200 rounded w-2/5"></div>
                <div className="h-3 bg-slate-150 rounded w-5/6"></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-3 bg-slate-150 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ) : diagnosed && insights ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-xs leading-relaxed animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="font-sans font-bold text-slate-900 block flex items-center gap-1">
                <Sparkle className="w-4 h-4 text-emerald-600" /> Executive Scenarios
              </span>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
 insights.riskRating === "High" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-250 text-emerald-700"
 }`}>
                RISK: {insights.riskRating || "Medium"}
              </span>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <strong className="text-slate-900 block mb-0.5">Stability Vector Index:</strong>
                <p className="text-slate-650">{insights.growthDiagnosis}</p>
              </div>
              
              <div>
                <strong className="text-slate-900 block mb-0.5">Mitigation Guardrails:</strong>
                <p className="text-slate-650">{insights.hedgingTactics}</p>
              </div>

              <div>
                <strong className="text-slate-900 block mb-1">Immediate Prioritized Objectives:</strong>
                <ul className="space-y-1 list-disc list-inside text-slate-650">
                  {insights.actionSteps?.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
          The CFO intelligent advisor executes real-time simulations over GHS interest rate positions, supplier debt schedules, inflation projections, and customer receivables.
        </p>
      </div>

      {/* RIGHT: Chat Room Interactive Canvas */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between h-[480px] shadow-sm shadow-emerald-500/5">
        
        {/* Chat Room header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl text-emerald-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 font-sans text-xs">Simulate Inflation Scenarios</h4>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide mt-0.5">AI Engine Level Active</p>
            </div>
          </div>
        </div>

        {/* Message Logs Area scrollable */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar text-xs leading-relaxed font-sans">
          {chatMessages.map((msg, idx) => {
            const isCfo = msg.sender === "cfo";

            return (
              <div 
                key={idx} 
                className={`flex ${isCfo ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[85%] rounded-xl p-3.5 border font-sans ${
 isCfo 
 ? "bg-white border-slate-200 text-slate-800 shadow-sm" 
 : "bg-emerald-50 border-emerald-250 text-emerald-900 font-semibold"
 }`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start w-full max-w-[85%] animate-pulse">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 w-full space-y-2">
                <div className="flex items-center gap-1.5 mb-1 text-slate-400 font-medium">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                  <span className="text-[10px] font-mono uppercase tracking-wider">Aziiki AI Computing...</span>
                </div>
                <div className="h-3 bg-slate-200 rounded w-full"></div>
                <div className="h-3 bg-slate-200 rounded w-11/12"></div>
                <div className="h-3 bg-slate-200 rounded w-4/5"></div>
              </div>
            </div>
          )}
        </div>

        {/* Quick App Guide Presets */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 shrink-0">
          <span className="text-[9px] font-mono text-slate-400 block mb-1.5 uppercase font-bold tracking-wider text-left">💡 Tap to ask how Aziiki works (Gemini AI Guide):</span>
          <div className="flex flex-wrap gap-1.5 max-h-[70px] overflow-y-auto">
            {appGuides.map((g, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => handleQuickQuestion(g.query)}
                className="px-2.5 py-1 text-[10px] bg-slate-50 hover:bg-emerald-50/70 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all cursor-pointer font-medium active:scale-95"
              >
                {g.title}
              </button>
            ))}
          </div>
        </div>

        {/* Direct typing send bar */}
        <form onSubmit={handleSendMessage} className="pt-2 flex items-center gap-2 shrink-0">
          <input
            type="text"
            required
            placeholder="Ask about Mobile Money integration, inflation, or tax compliance..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="flex-1 bg-slate-50 text-slate-850 rounded-xl px-4 py-2.5 border border-slate-200 text-xs outline-none focus:border-emerald-500 font-sans transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-2.5 transition-all cursor-pointer shadow-sm shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>

      </div>

    </div>
  );
}
