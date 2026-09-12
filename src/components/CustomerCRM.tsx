import React, { useState } from "react";
import { User, Phone, Envelope as Mail, Plus, Trash as Trash2, CaretRight as ChevronRight, MagnifyingGlass as Search, ChatCircle as MessageSquare, CheckCircle, WarningCircle as AlertCircle, FileCsv as FileSpreadsheet, Buildings as Building, CurrencyDollar as DollarSign, X } from "@phosphor-icons/react";
import { Customer, Invoice, Transaction, Business } from "../types";
import { SUPPORTED_CURRENCY_CODES } from "../lib/currency";
import ConfirmModal from "./ConfirmModal";

interface CustomerCRMProps {
  currentBusiness: Business;
  customers: Customer[];
  invoices: Invoice[];
  transactions: Transaction[];
  currencySymbol: string;
  onAddCustomer: (customer: Customer) => Promise<Customer>;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer>;
  onDeleteCustomer: (id: string) => Promise<void>;
}

export default function CustomerCRM({
  currentBusiness,
  customers,
  invoices,
  transactions,
  currencySymbol,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer
}: CustomerCRMProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);
  // Set when the form is open to EDIT an existing customer rather than
  // create a new one - the same form is reused for both, this just changes
  // what handleSaveCustomer does with it and which server call fires.
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [notif, setNotif] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk CSV States
  const [showBulkImport, setShowBulkImport] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Form value states
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [category, setCategory] = useState<"Creative Client" | "Enterprise" | "Retainer Account">("Creative Client");
  const [preferredCurrency, setPreferredCurrency] = useState<string>("");

  const businessCustomers = customers.filter(c => c.businessId === currentBusiness.id);

  const handleParseCustomerCSV = (text: string) => {
    try {
      const lines = text.split("\n");
      if (lines.length < 2) {
        setCsvError("CSV error: Must contain a header row and at least one contact row.");
        return;
      }

      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"(.*)"$/, '$1').trim());
        const custName = cols[0];
        if (!custName) continue;

        const custEmail = cols[1] || "info@client-enterprise.com";
        const custPhone = cols[2] || "+233 24...";
        const custNotes = cols[3] || "Auto-registered bulk CRM partner.";
        const custCategory = (cols[4] as any) || "Creative Client";

        onAddCustomer({
          id: "cust-csv-" + Math.random().toString(36).substr(2, 9),
          name: custName,
          email: custEmail,
          phone: custPhone,
          notes: custNotes,
          category: custCategory,
          businessId: currentBusiness.id,
          avatarColor: "blue"
        }).catch((err) => {
          // Bulk import intentionally doesn't stop the whole CSV over one
          // bad row, but a row that failed to save server-side must not be
          // silently swallowed either - same "looks saved, isn't" issue as
          // the single-add form above.
          console.error(`Failed to import row for ${custName}:`, err);
          setCsvError(`Some contacts failed to save (e.g. "${custName}") - check your connection and try again.`);
        });
        count++;
      }

      setCsvError(null);
      setNotif(`Loaded ${count} bulk contacts successfully!`);
      setShowBulkImport(false);
      setTimeout(() => setNotif(null), 4000);
    } catch (e: any) {
      setCsvError(`Errors during load: ${e.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleParseCustomerCSV(text);
      };
      reader.readAsText(file);
    } else {
      setCsvError("Error: Dropped file must be a valid .csv format!");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const filteredCustomers = businessCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCategory("Creative Client");
    setPreferredCurrency("");
    setIsAddingCustomer(false);
    setEditingCustomerId(null);
    setSaveError(null);
  };

  const openEditForm = (cust: Customer) => {
    setEditingCustomerId(cust.id);
    setName(cust.name);
    setEmail(cust.email === "info@client-enterprise.com" ? "" : cust.email);
    setPhone(cust.phone === "+233 24..." ? "" : cust.phone);
    setCategory(cust.category as "Creative Client" | "Enterprise" | "Retainer Account");
    setPreferredCurrency(cust.preferredCurrency || "");
    setSaveError(null);
    setIsAddingCustomer(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingCustomerId) {
        const updated = await onUpdateCustomer(editingCustomerId, {
          name,
          email: email || "info@client-enterprise.com",
          phone: phone || "+233 24...",
          category,
          preferredCurrency: preferredCurrency || undefined,
        });
        setSelectedCustomerId(updated.id);
        setNotif(`Profile for ${updated.name} updated successfully.`);
      } else {
        const newCust: Customer = {
          id: "cust-" + Math.random().toString(36).substr(2, 9),
          name,
          email: email || "info@client-enterprise.com",
          phone: phone || "+233 24...",
          notes: "Auto-registered SME partner profile.",
          category,
          businessId: currentBusiness.id,
          avatarColor: "blue",
          preferredCurrency: preferredCurrency || undefined,
        };
        // Awaited on purpose: the form only clears and shows "saved" once
        // the server has confirmed the customer actually exists, and we
        // select whatever ID the server actually issued - not the
        // temporary local one generated above - so the customer that was
        // "just saved" is guaranteed to be the same one now visible in the
        // list right below.
        const created = await onAddCustomer(newCust);
        setSelectedCustomerId(created.id);
        setNotif(`Profile for ${created.name} added successfully.`);
      }
      resetForm();
      setTimeout(() => setNotif(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this customer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteSelected = async () => {
    if (!selectedCustomer) return;
    setConfirmingDelete(false);
    setIsDeleting(true);
    try {
      await onDeleteCustomer(selectedCustomer.id);
      setNotif(`${selectedCustomer.name} was deleted.`);
      setTimeout(() => setNotif(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't delete this customer. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamic customer health metrics calculation
  const getCustomerMetrics = (cId: string) => {
    const custInvoices = invoices.filter(i => i.customerId === cId && i.businessId === currentBusiness.id);
    const completedTransactions = transactions.filter(t => t.customerId === cId && t.businessId === currentBusiness.id);

    const totalBilled = custInvoices.reduce((sum, inv) => {
      const subtotal = inv.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const tax = (subtotal * inv.taxRate) / 100;
      const disc = (subtotal * inv.discount) / 100;
      return sum + (subtotal + tax - disc);
    }, 0);

    const totalSettled = completedTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const outstandingBalance = Math.max(0, totalBilled - totalSettled);

    return {
      billed: totalBilled,
      settled: totalSettled,
      balance: outstandingBalance,
      invoiceCount: custInvoices.length
    };
  };

  // WhatsApp reminder generator
  const triggerReminder = (cust: Customer, bal: number) => {
    const textMsg = `Hello ${cust.name},\n\nThis is a friendly statement update from ${currentBusiness.name}. Our files show an outstanding ledger statement balance of ${currencySymbol}${bal.toLocaleString()}.\n\nThank you for working with local SME partners!`;
    const shareUrl = `https://wa.me/${cust.phone.replace(/[+\s]/g, "")}?text=${encodeURIComponent(textMsg)}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div id="customer-crm-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-800">
      
      {/* LEFT: Customer List Panel Column */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm shadow-emerald-500/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-1.5">
              <Building className="w-4 h-4 text-emerald-600" />
              SME Accounts Directory
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Clients registered under {currentBusiness.name}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              id="crm-add-client-btn"
              onClick={() => {
                if (isAddingCustomer) {
                  resetForm();
                } else {
                  setEditingCustomerId(null);
                  setName("");
                  setEmail("");
                  setPhone("");
                  setCategory("Creative Client");
                  setPreferredCurrency("");
                  setIsAddingCustomer(true);
                }
                setShowBulkImport(false);
              }}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-750 font-sans flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Register
            </button>
            <button
              onClick={() => {
                setShowBulkImport(!showBulkImport);
                setIsAddingCustomer(false);
              }}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-750 font-sans flex items-center gap-1 cursor-pointer bg-indigo-50 border border-indigo-120 hover:border-indigo-300 px-2 py-1 rounded-xl"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Bulk CSV
            </button>
          </div>
        </div>

        {/* Search Input bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            id="crm-search-input"
            type="text"
            placeholder="Search accounts directory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 outline-none text-xs focus:border-emerald-500 font-sans shadow-inner"
          />
        </div>

        {notif && (
          <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 text-[11px] p-2.5 rounded-xl font-sans flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {notif}
          </div>
        )}

        {/* Bulk CSV Importer */}
        {showBulkImport && (
          <div className="bg-indigo-50/40 border border-indigo-150 rounded-xl p-4 space-y-4 text-xs animate-fade-in leading-relaxed">
            <div className="flex justify-between items-center border-b border-indigo-200/30 pb-2">
              <h4 className="font-bold text-indigo-950 font-sans flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Bulk Import CSV Contacts
              </h4>
              <button
                onClick={() => setShowBulkImport(false)}
                aria-label="Close"
                className="text-slate-450 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" weight="bold" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight font-sans">
              Expected column order (or comma-separated):<br/>
              <code className="bg-white/80 px-1 border rounded text-[9.5px] font-mono">name, email, phone, notes, category</code>
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragOver 
                  ? "border-emerald-600 bg-emerald-50/50" 
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-[11px] font-medium text-slate-750">
                Drag and drop your contacts.csv file here
              </p>
              <p className="text-[9px] text-slate-450 mt-1 font-sans">
                Or click browse below to select a local file
              </p>
              
              <label className="mt-3 inline-block bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1 font-sans text-[10px] font-bold cursor-pointer">
                Browse File
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        handleParseCustomerCSV(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {csvError && (
              <p className="text-[10px] text-rose-600 font-semibold font-mono bg-rose-50 p-2 rounded-lg border border-rose-150">
                {csvError}
              </p>
            )}
          </div>
        )}

        {/* Add customer form */}
        {isAddingCustomer && (
          <form onSubmit={handleSaveCustomer} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-xs animate-fade-in leading-relaxed">
            <h4 className="font-bold text-slate-900 font-sans border-b border-slate-150 pb-2">
              {editingCustomerId ? "Edit Account Record" : "New Account Record"}
            </h4>

            {saveError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold rounded-lg p-2.5 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}
            
            <div>
              <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Company / Customer Name</label>
              <input
                id="param-customer-name"
                type="text"
                required
                placeholder="e.g. Alaba Fabrics Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Mobile Carrier Phone</label>
                <input
                  type="text"
                  placeholder="+233 24 123..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Email Statement Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Account Class Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-white text-slate-850 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-xs cursor-pointer"
              >
                <option value="Creative Client">Creative Services Client</option>
                <option value="Enterprise">SME / Corporate Account</option>
                <option value="Retainer Account">Retainer Contract Client</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Preferred Currency (optional)
              </label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className="w-full bg-white text-slate-850 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-xs cursor-pointer"
              >
                <option value="">Use this business's default currency</option>
                {SUPPORTED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg text-white font-semibold font-sans tracking-wide cursor-pointer text-xs transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {isSaving ? "Saving..." : editingCustomerId ? "Save Changes" : "Verify & Log Account"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="px-4 bg-white border border-slate-200 hover:bg-slate-100 py-2.5 rounded-lg text-slate-600 font-semibold font-sans tracking-wide cursor-pointer text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Customer Accounts directory listings */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
          {filteredCustomers.map((cust) => {
            const m = getCustomerMetrics(cust.id);
            const isSelected = cust.id === selectedCustomerId;

            return (
              <button
                key={cust.id}
                onClick={() => setSelectedCustomerId(cust.id)}
                className={`w-full p-3 text-left rounded-xl flex items-center justify-between border transition-all cursor-pointer font-sans text-xs ${
                  isSelected 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold" 
                    : "bg-white border-transparent hover:bg-slate-50 text-slate-700 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${isSelected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold block truncate max-w-[150px]">{cust.name}</h4>
                    <span className="text-[10px] text-slate-400 block font-normal mt-0.5">{cust.category}</span>
                  </div>
                </div>

                <div className="text-right">
                  <strong className={`font-mono text-xs block ${m.balance > 0 ? "text-amber-600 font-black" : "text-emerald-600"}`}>
                    {currencySymbol}{m.balance.toLocaleString()}
                  </strong>
                  <span className="text-[9px] text-slate-450 block font-normal mt-0.5">Bal Due</span>
                </div>
              </button>
            );
          })}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-slate-500 italic text-xs font-sans">
              No matching business accounts registered yet.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Selected Customer Detail Panel */}
      <div className="lg:col-span-8">
        {selectedCustomer ? (
          (() => {
            const metrics = getCustomerMetrics(selectedCustomer.id);

            return (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm shadow-emerald-500/5">
                
                {/* Profile Header card summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-lg font-bold flex items-center justify-center font-mono">
                      {selectedCustomer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-sans">{selectedCustomer.name}</h3>
                      <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded uppercase font-bold tracking-widest mt-1 inline-block">
                        {selectedCustomer.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerReminder(selectedCustomer, metrics.balance)}
                      disabled={metrics.balance <= 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Prompt Statement Ledger
                    </button>

                    <button
                      onClick={() => openEditForm(selectedCustomer)}
                      className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold text-[11px] px-3 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setConfirmingDelete(true)}
                      disabled={isDeleting}
                      className="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Grid info contact fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div className="bg-slate-50 border border-slate-250/60 p-3 rounded-xl flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">WhatsApp Carrier Channel</span>
                      <strong className="text-slate-800">{selectedCustomer.phone}</strong>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-250/60 p-3 rounded-xl flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Email Statement Target</span>
                      <strong className="text-slate-800">{selectedCustomer.email}</strong>
                    </div>
                  </div>
                </div>

                {/* Consolidated Balance summaries widgets */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-inner text-center">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Invoice billing</span>
                    <strong className="text-slate-900 font-mono text-sm leading-relaxed">{currencySymbol}{metrics.billed.toLocaleString()}</strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-inner text-center">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Settled payments</span>
                    <strong className="text-emerald-600 font-mono text-sm leading-relaxed">{currencySymbol}{metrics.settled.toLocaleString()}</strong>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl shadow-inner text-center">
                    <span className="text-[9px] font-mono text-amber-700 uppercase tracking-widest block mb-1">Remaining Balance</span>
                    <strong className="text-amber-600 font-mono text-sm leading-relaxed">{currencySymbol}{metrics.balance.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Customer specific recent activity transactions ledger */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">
                    Customer Ledger Statements Activity
                  </h4>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {transactions
                      .filter(t => t.customerId === selectedCustomer.id && t.businessId === currentBusiness.id)
                      .map(t => (
                        <div key={t.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 p-1 rounded font-bold">{t.paymentMethod}</span>
                            <div>
                              <p className="font-semibold text-slate-850 font-sans">{t.description}</p>
                              <span className="text-[9px] text-slate-400 block mt-0.5">{t.date}</span>
                            </div>
                          </div>
                          <strong className="text-emerald-600 font-semibold font-mono">
                            +{currencySymbol}{t.amount.toLocaleString()}
                          </strong>
                        </div>
                      ))}
                    {transactions.filter(t => t.customerId === selectedCustomer.id && t.businessId === currentBusiness.id).length === 0 && (
                      <div className="text-center py-6 text-slate-450 italic text-[11px] font-sans border border-dashed border-slate-200 rounded-xl">
                        No settled mobile money logs mapped under this specific client. Get invoices settled to fill historical logs!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })()
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center italic text-slate-450 text-xs font-sans shadow-sm shadow-emerald-500/5">
            Select or register a client account profile from the sidebar to inspect consolidated ledger activities.
          </div>
        )}
      </div>

      {confirmingDelete && selectedCustomer && (
        <ConfirmModal
          title="Delete this customer?"
          message={`Delete ${selectedCustomer.name}? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteSelected}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
