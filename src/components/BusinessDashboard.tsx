import React, { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Coins, Calculator, TrendUp as TrendingUp, Pulse as Activity, Plus, Trash as Trash2, CheckCircle, DeviceMobile as Smartphone, Wallet, Buildings as Building, WarningCircle as AlertCircle, DownloadSimple as Download, UploadSimple as Upload, Database, MagicWand as Sparkles, ShieldWarning as ShieldAlert, Users, Briefcase, ClockCounterClockwise as History, TrendDown as TrendingDown, UserCheck, Lightning, FileCsv as FileSpreadsheetIcon, Info, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { Transaction, Customer, Business, Invoice, Debt, Partner, Shareholder, AuditLog, UserRole } from "../types";

interface BusinessDashboardProps {
  currentBusiness: Business;
  transactions: Transaction[];
  customers: Customer[];
  invoices: Invoice[];
  currencySymbol: string;
  onAddTransaction: (trans: Transaction) => void | Promise<void>;
  onDeleteTransaction: (id: string) => void;
  onRestoreBackup?: (backup: any) => void;
  debts: Debt[];
}

export default function BusinessDashboard({
  currentBusiness,
  transactions,
  customers,
  invoices,
  currencySymbol,
  onAddTransaction,
  onDeleteTransaction,
  onRestoreBackup,
  debts
}: BusinessDashboardProps) {
  // Rapid cashbook toggler
  const [isOpeningLogs, setIsOpeningLogs] = useState<boolean>(true); // default open for convenience
  
  // Ledger forms states
  const [amount, setAmount] = useState<number>(300);
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState<string>("Client Project");
  const [description, setDescription] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Mobile Money" | "Cash" | "Bank Transfer">("Mobile Money");
  const [customerId, setCustomerId] = useState<string>("");

  // SMS Parser States
  const [showSmsInput, setShowSmsInput] = useState<boolean>(false);
  const [rawSmsText, setRawSmsText] = useState<string>("");
  const [smsParserMsg, setSmsParserMsg] = useState<{ status: "success" | "error"; text: string } | null>(null);

  // Database actions notifications
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  // Localized state binders for Business Identity behaviors
  const [localPartners, setLocalPartners] = useState<Partner[]>(currentBusiness.partners || []);
  const [partnerWithdrawalName, setPartnerWithdrawalName] = useState<string>("");
  const [partnerWithdrawalAmount, setPartnerWithdrawalAmount] = useState<number>(0);
  const [withdrawalMsg, setWithdrawalMsg] = useState<string | null>(null);

  // Corporate quarantined approvals ledger
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([
    {
      id: "appr-1",
      date: new Date().toISOString().substring(0, 10),
      type: "expense",
      category: "Operations Cost",
      amount: 1450,
      description: "Bulk studio generator fueling costs",
      paymentMethod: "Bank Transfer",
      staffName: "Kofi Owusu (Accountant)"
    },
    {
      id: "appr-2",
      date: new Date().toISOString().substring(0, 10),
      type: "expense",
      category: "Materials Purchase",
      amount: 620,
      description: "Direct textile purchase from central Ikeja supplier",
      paymentMethod: "Cash",
      staffName: "Abena Mensah (Staff)"
    }
  ]);
  const [approvalAlert, setApprovalAlert] = useState<string | null>(null);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);

  // Keep localPartners state in sync with currentBusiness object
  useEffect(() => {
    const list = currentBusiness.partners || [];
    setLocalPartners(list);
    if (list.length > 0) {
      setPartnerWithdrawalName(list[0].name);
    } else {
      setPartnerWithdrawalName("");
    }
  }, [currentBusiness.id, currentBusiness.partners]);

  const activeTransactions = transactions.filter(t => t.businessId === currentBusiness.id);

  // Math aggregates
  const totalRevenue = activeTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = activeTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalRevenue - totalExpenses;
  const marginPercentage = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const outstandingInvoices = invoices
    .filter(inv => inv.businessId === currentBusiness.id && (inv.status === "Sent" || inv.status === "Overdue"))
    .reduce((sum, inv) => {
      const invTotal = inv.items.reduce((acc, current) => acc + (current.quantity * current.rate), 0);
      const taxAmount = (invTotal * inv.taxRate) / 100;
      const discountAmount = (invTotal * inv.discount) / 100;
      return sum + (invTotal + taxAmount - discountAmount - inv.partialPaidAmount);
    }, 0);

  // Business Health Score Formulation
  const calcHealthScore = () => {
    let score = 55; // baseline rating
    if (marginPercentage > 30) score += 15;
    else if (marginPercentage > 10) score += 8;

    // Outstanding invoices penalty weights
    if (outstandingInvoices === 0) score += 20;
    else if (outstandingInvoices < (totalRevenue * 0.2)) score += 12;
    else score -= 5;

    // Ledger flow logs
    if (activeTransactions.length > 5) score += 10;
    
    return Math.min(100, Math.max(25, score));
  };

  const healthScore = calcHealthScore();
  // Cold-start guard: a brand-new account with almost no ledger history
  // would otherwise get a confident-looking numeric score computed from
  // data that barely exists yet - the same >5 threshold calcHealthScore
  // itself already uses for its "active ledger" bonus. Below that, the
  // dashboard shows a neutral "not enough data" state instead of a score.
  const hasEnoughDataForHealthScore = activeTransactions.length >= 5;

  const handleParseSms = () => {
    if (!rawSmsText.trim()) {
      setSmsParserMsg({ status: "error", text: "Please paste a raw Mobile Money or bank SMS receipt first." });
      return;
    }

    const text = rawSmsText;

    // Matches standard mobile transaction formats (GHS 500.00 / 5,000 NGN / Ksh 2500)
    const amountRegex = /(?:GHS|NGN|KES|USD|UGX|TZS|RWF|ZAR|EUR|Kshs?|GHC|sh\.[^\d]*|₦|₵)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:GHS|NGN|KES|USD|UGX|TZS|RWF|ZAR|Mobile Money|MoMo)/i;
    let extractedAmount = 0;
    const matchAmount = text.match(amountRegex);
    if (matchAmount) {
      const numStr = matchAmount[1] || matchAmount[2];
      if (numStr) {
        extractedAmount = parseFloat(numStr.replace(/,/g, ''));
      }
    } else {
      const fallbackMatch = text.match(/(?:received|sent|paid|of|amount)\s*(?:of\s*)?([\d,]+(?:\.\d{1,2})?)/i);
      if (fallbackMatch && fallbackMatch[1]) {
        extractedAmount = parseFloat(fallbackMatch[1].replace(/,/g, ''));
      }
    }

    if (!extractedAmount || isNaN(extractedAmount)) {
      setSmsParserMsg({ status: "error", text: "Could not find a valid financial amount in the text. Try copying the raw SMS." });
      return;
    }

    let extractedType: "income" | "expense" = "income";
    if (/sent|paid|transfer to|payment to|withdrawn|debited|outflow/i.test(text)) {
      extractedType = "expense";
    }

    let referenceCode = "";
    const refMatch = text.match(/(?:Trans\s*ID|TxID|Ref|Reference|Transaction ID|ID)[:\s]*([A-Z0-9]+)/i);
    if (refMatch && refMatch[1]) {
      referenceCode = refMatch[1];
    }

    const personMatch = text.match(/(?:from|to|paid\s+to|received\s+from)\s+([A-Z][a-zA-Z\s]{2,20})/);
    const partyName = personMatch ? personMatch[1].trim() : "";

    let extractedDesc = "";
    if (partyName) {
      extractedDesc = `${extractedType === "income" ? "M-Money Inflow from" : "M-Money Outflow to"} ${partyName}`;
      if (referenceCode) extractedDesc += ` (Ref: ${referenceCode})`;
    } else if (referenceCode) {
      extractedDesc = `${extractedType === "income" ? "Income Ledger Alert" : "Expense Ledger Alert"} - Ref: ${referenceCode}`;
    } else {
      extractedDesc = `${extractedType === "income" ? "Direct Client Settlement" : "Operational Supplier Cost"}`;
    }

    let matchedCategory = "Client Project";
    if (extractedType === "expense") {
      if (/fabric|material|yarn|cloth|textile/i.test(text)) {
        matchedCategory = "Materials Purchase";
      } else if (/transport|transit|fuel|delivery|logistics|uber/i.test(text)) {
        matchedCategory = "Logistics";
      } else if (/rent|studio|power|generator/i.test(text)) {
        matchedCategory = "Operations Cost";
      } else {
        matchedCategory = "Operations Cost";
      }
    } else {
      if (/sales|order|shop|product|retail|sold/i.test(text)) {
        matchedCategory = "Direct Sales";
      } else if (/consult|advise|audit|coach/i.test(text)) {
        matchedCategory = "Consulting Fee";
      } else {
        matchedCategory = "Client Project";
      }
    }

    setAmount(extractedAmount);
    setType(extractedType);
    setCategory(matchedCategory);
    setPaymentMethod("Mobile Money");
    setDescription(extractedDesc);

    setSmsParserMsg({
      status: "success",
      text: `Auto-filled: ${currentBusiness.currency} ${extractedAmount} applied as ${matchedCategory} (${extractedType === "income" ? "Inflow" : "Outflow"})`
    });

    setRawSmsText("");
    setTimeout(() => setSmsParserMsg(null), 5000);
  };

  const handleExportCSV = () => {
    const escapeCSV = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csvRows = [
      ["Date", "Type", "Category", "Amount", "Description", "Payment Method", "Business Module"].join(",")
    ];

    activeTransactions.forEach(t => {
      const row = [
        t.date,
        t.type,
        t.category,
        t.amount,
        escapeCSV(t.description),
        t.paymentMethod,
        escapeCSV(currentBusiness.name)
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${currentBusiness.name.replace(/\s+/g, '_')}_ledgers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDbStatus("Exported Excel CSV successfully!");
    setTimeout(() => setDbStatus(null), 3000);
  };

  const handleExportJSON = () => {
    const backupObj = {
      transactions: transactions,
      customers: customers,
      invoices: invoices,
      exportDate: new Date().toISOString(),
      sourceBiz: currentBusiness.name
    };

    const str = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Aziiki_Backup_${currentBusiness.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDbStatus("JSON database downloaded!");
    setTimeout(() => setDbStatus(null), 3005);
  };

  const [isImportingSpreadsheet, setIsImportingSpreadsheet] = useState(false);

  const handleImportSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a failed attempt
    if (!file) return;

    setIsImportingSpreadsheet(true);
    try {
      const { parseTransactionsFromSpreadsheet } = await import("../lib/spreadsheetImport");
      const { transactions, totalRows, skippedRows } = await parseTransactionsFromSpreadsheet(file, currentBusiness.id);

      if (transactions.length === 0) {
        setDbStatus(
          totalRows === 0
            ? "That file had no rows to import."
            : "Couldn't find a usable Amount column - check the file has a Date/Amount/Type header row."
        );
      } else {
        transactions.forEach((t) => {
          Promise.resolve(onAddTransaction(t)).catch((err) => console.error("Failed to import a transaction row:", err));
        });
        setDbStatus(
          skippedRows > 0
            ? `Imported ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}, skipped ${skippedRows} row${skippedRows === 1 ? "" : "s"} with no valid amount.`
            : `Imported ${transactions.length} transaction${transactions.length === 1 ? "" : "s"} successfully!`
        );
      }
    } catch (err) {
      console.error("Failed to import spreadsheet:", err);
      setDbStatus("Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv file.");
    } finally {
      setIsImportingSpreadsheet(false);
      setTimeout(() => setDbStatus(null), 6000);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && (parsed.transactions || parsed.customers || parsed.invoices)) {
          if (onRestoreBackup) {
            onRestoreBackup(parsed);
            setDbStatus("Success! Sandbox registers restored.");
          }
        } else {
          setDbStatus("Err: Excel/JSON schema mismatch.");
        }
      } catch (err) {
        setDbStatus("Err: JSON parsing failure.");
      }
      setTimeout(() => setDbStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    const descName = description || `${type === "income" ? "Client billing" : "Supplier cost"} settlement`;

    // INTERCEPT RULES: Company mode dual-approvals
    if (currentBusiness.businessType === "Company" && currentBusiness.allowFinancialApprovals && amount > 500) {
      const pendingTx = {
        id: "appr-" + Math.random().toString(36).substr(2, 5),
        date: new Date().toISOString().split("T")[0],
        type,
        category,
        amount,
        description: descName,
        paymentMethod,
        staffName: "Active Accountant Role"
      };
      setPendingApprovals([pendingTx, ...pendingApprovals]);
      setApprovalAlert(`Dual-signature sign-off alert: High-value transaction for ${currencySymbol}${amount} has been quarantined in the approval queue.`);
      
      // Reset Form values
      setAmount(100);
      setDescription("");
      setCustomerId("");
      
      setTimeout(() => setApprovalAlert(null), 7000);
      return;
    }

    const newTx: Transaction = {
      id: "tx-" + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split("T")[0],
      type,
      category,
      amount,
      description: descName,
      paymentMethod,
      customerId: customerId || undefined,
      businessId: currentBusiness.id
    };

    // Was previously fire-and-forget (no await, no error surfaced beyond a
    // console.log in App.tsx) - the form reset and looked like a success
    // regardless of whether the save actually reached the server. This is
    // the app's single most-used quick-entry form, so it's worth the same
    // "await, disable, show a real error" treatment CRM/Inventory/Brand
    // config already got.
    setIsSavingTransaction(true);
    try {
      await onAddTransaction(newTx);
      setAmount(100);
      setDescription("");
      setCustomerId("");
    } catch (err) {
      setDbStatus(err instanceof Error ? `Err: ${err.message}` : "Err: Couldn't log that transaction. Please try again.");
      setTimeout(() => setDbStatus(null), 6000);
    } finally {
      setIsSavingTransaction(false);
    }
  };

  return (
    <div id="dashboard-tab-root" className="grid grid-cols-1 xl:grid-cols-12 gap-6 font-sans text-slate-800">
      
      {/* LEFT BLOCK: Key metric tiles & Cashflow visualization charts */}
      <div className="xl:col-span-8 flex flex-col gap-6">
        
        {/* Core Metric highlights row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="soft-card p-5 relative overflow-hidden">
            <div className="absolute right-3 top-3 bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-transform duration-300 hover:rotate-12">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
              {currentBusiness.businessType === "Sole Proprietor" ? "My Money Inflows" : "Total Revenue Ledger"}
            </span>
            <strong className="text-2xl font-black font-sans text-slate-900 block mt-2 tracking-tight">
              {currencySymbol}{totalRevenue.toLocaleString()}
            </strong>
            <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1 mt-2.5 font-medium">
              <span className="bg-emerald-50 text-emerald-700 p-0.5 rounded-md flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
              {currentBusiness.businessType === "Sole Proprietor" ? "all logged trade earnings" : "cumulative business inflows"}
            </span>
          </div>

          <div className="soft-card p-5 relative overflow-hidden">
            <div className="absolute right-3 top-3 bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100 shadow-sm transition-transform duration-300 hover:rotate-12">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
              {currentBusiness.businessType === "Sole Proprietor" ? "My Expenses" : currentBusiness.businessType === "Partnership" ? "Joint Expenses" : "Corporate Expenses"}
            </span>
            <strong className="text-2xl font-black font-sans text-slate-900 block mt-2 tracking-tight">
              {currencySymbol}{totalExpenses.toLocaleString()}
            </strong>
            <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1 mt-2.5 font-medium">
              <span className="bg-rose-50 text-rose-700 p-0.5 rounded-md flex items-center justify-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </span>
              {currentBusiness.businessType === "Sole Proprietor" ? "personal pocket outflows" : "operating cash leaks logged"}
            </span>
          </div>

          <div className="soft-card p-5 relative overflow-hidden">
            <div className="absolute right-3 top-3 bg-teal-50 text-teal-600 p-2.5 rounded-xl border border-teal-100 shadow-sm transition-transform duration-300 hover:rotate-12">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
              {currentBusiness.businessType === "Sole Proprietor" ? "My Personal Profit" : "Net Profit / Margin"}
            </span>
            <strong className={`text-2xl font-black font-sans block mt-2 tracking-tight ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {currencySymbol}{netProfit.toLocaleString()}
            </strong>
            <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1 mt-2.5 font-medium">
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold font-mono text-[9px] mr-1">
                {marginPercentage}%
              </span>
              {currentBusiness.businessType === "Sole Proprietor" ? "net surplus margin" : "Profit margin percentage"}
            </span>
          </div>

        </div>

        {/* Real-time cashflow chart visualizer (D3-inspired custom SVG layout) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm shadow-emerald-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Ledger Cash Inflow / Outflow Trends
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Weekly visual cash balance flow chart.
              </p>
            </div>

            <div className="flex gap-4 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 block pb-0"></span>
                Inflows
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 block pb-0"></span>
                Outflows
              </span>
            </div>
          </div>

          {/* SVG canvas renderer */}
          <div className="h-48 w-full bg-slate-50 rounded-xl relative border border-slate-200/60 p-4">
            <svg viewBox="0 0 500 150" className="w-full h-full text-emerald-500">
              {/* Grid Lines */}
              <line x1="10" y1="20" x2="490" y2="20" stroke="#e2e8f0" strokeWidth="0.75" strokeDasharray="3" />
              <line x1="10" y1="75" x2="490" y2="75" stroke="#e2e8f0" strokeWidth="0.75" strokeDasharray="3" />
              <line x1="10" y1="130" x2="490" y2="130" stroke="#e2e8f0" strokeWidth="0.75" strokeDasharray="3" />
              
              {/* Dynamic Path lines */}
              {activeTransactions.length > 1 ? (
                <>
                  {/* Revenue Curve */}
                  <path
                    d="M 10,110 L 120,60 L 230,25 L 340,90 L 490,40"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="opacity-95"
                  />
                  {/* Expense curve */}
                  <path
                    d="M 10,140 L 120,110 L 230,120 L 340,55 L 490,115"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="opacity-80"
                  />
                  
                  {/* Data Anchor dots */}
                  <circle cx="230" cy="25" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="340" cy="55" r="4.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
                </>
              ) : (
                /* Static flat representation if no data points exist */
                <path d="M 10,75 H 490" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="2" />
              )}
            </svg>

            {activeTransactions.length <= 1 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-sans text-xs italic bg-slate-50/95 p-4 rounded-xl text-center border border-dashed border-slate-200">
                Log progressive ledger transactions using the rapid cashbook drawer to render your cashflow curves!
              </div>
            )}
          </div>
        </div>

        {/* Database & Reports Utility - Full Screen Only */}
        <div className="hidden xl:flex bg-white border border-slate-200 rounded-2xl p-5 flex-col gap-4 shadow-sm shadow-emerald-500/5">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                Exports & Database backups
              </h4>
              <span className="text-[10px] text-slate-500 block text-left">Manage spreadsheet reports & backups</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-left">
            <div className="grid grid-cols-2 gap-2">
              {/* CSV Export Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Excel CSV
              </button>

              {/* JSON Export Button */}
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[color:var(--color-brand-teal)]" />
                JSON Backup
              </button>
            </div>

            {/* RESTORE DATABASE BLOCK */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold block text-left">Restore sandbox backup</span>
              <p className="text-[10px] text-slate-550 leading-relaxed text-left">
                Restore previously backed up JSON ledger records instantly into your offline safe space.
              </p>
              
              <label className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg border border-slate-200 cursor-pointer transition-colors text-[10px]">
                <Upload className="w-3 h-3 text-emerald-600" />
                Upload .json file
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>

            {/* IMPORT FROM EXCEL/CSV BLOCK */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold block text-left">Import from Excel / CSV</span>
              <p className="text-[10px] text-slate-550 leading-relaxed text-left">
                Upload a spreadsheet with Date, Type, Category, Amount, Description, and Payment Method columns to add them as transactions.
              </p>

              <label className={`flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg border border-slate-200 transition-colors text-[10px] ${isImportingSpreadsheet ? "opacity-50 cursor-wait" : "cursor-pointer"}`}>
                <FileSpreadsheetIcon className="w-3 h-3 text-emerald-600" />
                {isImportingSpreadsheet ? "Importing..." : "Upload .xlsx, .xls or .csv"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportSpreadsheet}
                  disabled={isImportingSpreadsheet}
                  className="hidden"
                />
              </label>
            </div>

            {/* Status notifications */}
            {dbStatus && (
              <div className="p-2 text-center rounded-lg text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse">
                {dbStatus}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT BLOCK: Business Health score circular visualization and ledger drawer */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        
        {/* Business score dial card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm shadow-emerald-500/5">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">
              Business Health Score
            </h4>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Automated audit evaluation of stability vector thresholds.
            </p>
          </div>

          {hasEnoughDataForHealthScore ? (
            <>
              {/* Dials visual graphics */}
              <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                {/* SVG circle meter */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="50"
                    className="stroke-slate-100"
                    strokeWidth="8.5"
                    fill="transparent"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="50"
                    className="stroke-emerald-600"
                    strokeWidth="8.5"
                    fill="transparent"
                    strokeDasharray={314}
                    strokeDashoffset={314 - (314 * healthScore) / 100}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
                  />
                </svg>

                <div className="absolute text-center">
                  <strong className="text-2xl font-black font-mono text-slate-900 tracking-tighter">
                    {healthScore}
                  </strong>
                  <span className="text-[10px] text-emerald-600 font-mono block tracking-widest">PTS</span>
                </div>
              </div>

              {/* Health feedback text */}
              <div className="pt-2">
                <span className="font-sans font-bold text-xs text-slate-900 flex items-center justify-center gap-1.5">
                  {healthScore >= 75 ? (
                    <><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Pristine Solvency Position</>
                  ) : healthScore >= 50 ? (
                    <><Lightning className="w-3.5 h-3.5 text-amber-500" /> Variable Operational Health</>
                  ) : (
                    <><AlertCircle className="w-3.5 h-3.5 text-rose-600" /> High Liquidity Warnings</>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed mt-1 font-sans">
                  Calculated based on profit margin targets, cash liquidity levels, and collection delays.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Cold-start state: no numeric score at all until there's enough
                  ledger history for it to mean something - a 2-transaction
                  account getting a confident-looking low score is worse than
                  no score. */}
              <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="50" className="stroke-slate-100" strokeWidth="8.5" fill="transparent" />
                </svg>
                <div className="absolute text-center">
                  <History className="w-6 h-6 text-slate-300 mx-auto" />
                </div>
              </div>
              <div className="pt-2">
                <span className="font-sans font-bold text-xs text-slate-900 flex items-center justify-center gap-1.5">
                  Not Enough Data Yet
                </span>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed mt-1 font-sans">
                  Log {5 - activeTransactions.length} more transaction{5 - activeTransactions.length === 1 ? "" : "s"} and your Health Score will appear here.
                </p>
              </div>
            </>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5 text-left">
            <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
            <span>Based entirely on the transactions and figures you've logged in Aziiki - not independently verified or audited.</span>
          </p>
        </div>

        {/* Rapid Ledger Cashbook trigger panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm shadow-emerald-500/5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Calculator className="w-4 h-4 text-emerald-600" />
                Ledger Book Drawer
              </h4>
              <span className="text-[10px] text-slate-500 block">Record fast cash transactions</span>
            </div>

            <button
              id="open-ledger-drawer-btn"
              onClick={() => setIsOpeningLogs(!isOpeningLogs)}
              className="bg-emerald-50 border border-emerald-250 text-emerald-650 hover:bg-emerald-100 p-2 rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Ledger Add form drawer */}
          {isOpeningLogs && (
            <form onSubmit={handleSaveTransaction} className="space-y-3.5 animate-fade-in text-xs leading-relaxed">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
                    type === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Inflow (Revenue)
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
                    type === "expense" ? "bg-rose-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Outflow (Expense)
                </button>
              </div>

              {/* SMS Automatic Parser Sub-Block */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-sans font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    MTN / M-Pesa SMS Auto-Fill
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSmsInput(!showSmsInput)}
                    className="text-emerald-600 shadow-sm hover:underline font-bold"
                  >
                    {showSmsInput ? "Hide paste box" : "Use SMS paste"}
                  </button>
                </div>

                {showSmsInput && (
                  <div className="space-y-2 animate-fade-in text-[10px]">
                    <textarea
                      rows={2}
                      placeholder="Paste e.g., 'You have received GHS 1,500 from...' or M-PESA receipt alert..."
                      value={rawSmsText}
                      onChange={(e) => setRawSmsText(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-sans outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleParseSms}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-1.5 rounded-lg text-[10px] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Quick Parse SMS Alert
                    </button>
                  </div>
                )}

                {smsParserMsg && (
                  <div className={`p-2 rounded-lg text-[10px] font-medium leading-relaxed font-sans ${
                    smsParserMsg.status === "success" 
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                      : "bg-rose-50 text-rose-800 border border-rose-100"
                  }`}>
                    {smsParserMsg.text}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-400">Amount ({currencySymbol})</label>
                  <input
                    id="param-amount"
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-400">Classification</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-200 px-2 py-1.5 rounded-lg mt-1 outline-none font-sans focus:border-emerald-500"
                  >
                    {type === "income" ? (
                      <>
                        <option value="Client Project">Client Project / Contract</option>
                        <option value="Direct Sales">Retail / Wholesale sale</option>
                        <option value="Consulting Fee">Strategy Retainer</option>
                        <option value="Interest Earnings">Treasury Yields</option>
                      </>
                    ) : (
                      <>
                        <option value="Operations Cost">Operations / Studio rent</option>
                        <option value="Materials Purchase">Textiles & Materials</option>
                        <option value="Logistics">Transport & logistics</option>
                        <option value="Outsource Help">Contractor support</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-400">Payment Source</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-white text-slate-800 border border-slate-200 px-2 py-1.5 rounded-lg mt-1 outline-none font-sans focus:border-emerald-500"
                  >
                    <option value="Mobile Money">Mobile Money (MoMo)</option>
                    <option value="Cash">Cash Handover</option>
                    <option value="Bank Transfer">Bank Wire</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-400">Client Match</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-200 px-2 py-1.5 rounded-lg mt-1 outline-none font-sans focus:border-emerald-500"
                  >
                    <option value="">No customer link</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400">Cashbook Statement description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Received partial retainer for project work"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-2 border border-slate-200 mt-1 outline-none font-sans focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingTransaction}
                className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded-lg text-white font-semibold font-sans mt-2 cursor-pointer transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-1.5"
              >
                {isSavingTransaction && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingTransaction ? "Saving..." : "Log Transaction"}
              </button>
            </form>
          )}

          {/* Outflow/Inflow log ledger index */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block font-bold mb-1">Recent Ledger logs</span>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {activeTransactions.slice(0, 5).map((t) => (
                <div key={t.id} className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1 rounded-lg ${
                      t.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}>
                      {t.type === "income" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 font-sans max-w-[140px] truncate">{t.description}</h4>
                      <p className="text-[10px] text-slate-400 font-mono tracking-wider">{t.paymentMethod} — {t.date}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5">
                    <strong className={`font-mono font-bold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "-"}{currencySymbol}{t.amount.toLocaleString()}
                    </strong>
                    <button
                      onClick={() => onDeleteTransaction(t.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {activeTransactions.length === 0 && (
                <div className="text-center py-6 text-slate-450 italic text-[11px] font-sans">
                  No registered active logs exist on this business cashbook. Click the "+" button above to add assets ledger records!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Database & Reports Utility - Mobile/Tablet only */}
        <div className="xl:hidden flex bg-white border border-slate-200 rounded-2xl p-5 flex-col gap-4 shadow-sm shadow-emerald-500/5">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                Exports & Database backups
              </h4>
              <span className="text-[10px] text-slate-500 block text-left">Manage spreadsheet reports & backups</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-left">
            <div className="grid grid-cols-2 gap-2">
              {/* CSV Export Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Excel CSV
              </button>

              {/* JSON Export Button */}
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[color:var(--color-brand-teal)]" />
                JSON Backup
              </button>
            </div>

            {/* RESTORE DATABASE BLOCK */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold block text-left">Restore sandbox backup</span>
              <p className="text-[10px] text-slate-550 leading-relaxed text-left">
                Restore previously backed up JSON ledger records instantly into your offline safe space.
              </p>
              
              <label className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg border border-slate-200 cursor-pointer transition-colors text-[10px]">
                <Upload className="w-3 h-3 text-emerald-600" />
                Upload .json file
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>

            {/* IMPORT FROM EXCEL/CSV BLOCK */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold block text-left">Import from Excel / CSV</span>
              <p className="text-[10px] text-slate-550 leading-relaxed text-left">
                Upload a spreadsheet with Date, Type, Category, Amount, Description, and Payment Method columns to add them as transactions.
              </p>

              <label className={`flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg border border-slate-200 transition-colors text-[10px] ${isImportingSpreadsheet ? "opacity-50 cursor-wait" : "cursor-pointer"}`}>
                <FileSpreadsheetIcon className="w-3 h-3 text-emerald-600" />
                {isImportingSpreadsheet ? "Importing..." : "Upload .xlsx, .xls or .csv"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportSpreadsheet}
                  disabled={isImportingSpreadsheet}
                  className="hidden"
                />
              </label>
            </div>

            {/* Status notifications */}
            {dbStatus && (
              <div className="p-2 text-center rounded-lg text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse">
                {dbStatus}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
