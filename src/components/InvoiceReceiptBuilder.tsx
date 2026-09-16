import React, { useState, useEffect } from "react";
import { FileText, Receipt as ReceiptIcon, Plus, Trash as Trash2, ShareNetwork as Share2, Printer, ArrowsClockwise as RefreshCw, Check, Palette, CheckCircle, WarningCircle as AlertCircle, UploadSimple as Upload, FileArrowUp as FileUp, FileArrowDown, Sliders, TextT as Type, FileCsv as FileSpreadsheet, Certificate as Award, Image as ImageIcon, Percent as BadgePercent, Barcode, MagnifyingGlass as Search, CheckSquare, MagicWand as Sparkles, Envelope as Mail, CircleNotch as Loader2, CreditCard, PencilSimple, Tag, Buildings, Lock, User, Wrench, ClockCounterClockwise as History, Warning, XCircle, ArrowBendUpRight, Signature } from "@phosphor-icons/react";
import { Invoice, Receipt, Quotation, Customer, Business, InvoiceItem } from "../types";
import { calculateInvoiceTotals, subtractMoney } from "../lib/money";
import { compressImageForStorage } from "../lib/imageCompress";
import { SUPPORTED_CURRENCY_CODES, formatMoneyIntl } from "../lib/currency";
import { api, ApiError } from "../lib/api";
import { renderDocumentToPdf, sharePdfToWhatsApp, downloadFile } from "../lib/documentPdf";
import BrandKitSettings from "./BrandKitSettings";
import DocumentBlockRenderer from "./DocumentBlockRenderer";
import SignatureCapture from "./SignatureCapture";
import { CustomBlockLayout } from "../lib/documentBlocks";
import { useFeatureFlags } from "../lib/featureFlags";
import { useCachedResource } from "../lib/sessionCache";
import { getInitials } from "../lib/businessLogo";

// Spells out a monetary amount for the "Amount in Words" line on the
// Diagonal Ribbon receipt design (market-trader receipt books traditionally
// write this out so it can't be altered after the fact) - only needs to
// handle amounts up to the billions, which comfortably covers any real
// invoice/receipt total.
function numberToWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function chunkToWords(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? " " + chunkToWords(n % 100) : ""}`;
  }

  const whole = Math.floor(Math.abs(amount));
  if (whole === 0) return "Zero";

  const scales = ["", "Thousand", "Million", "Billion"];
  const chunks: number[] = [];
  let remaining = whole;
  while (remaining > 0) {
    chunks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words = chunks
    .map((chunk, idx) => (chunk ? `${chunkToWords(chunk)}${scales[idx] ? " " + scales[idx] : ""}` : ""))
    .filter(Boolean)
    .reverse()
    .join(" ");

  return words;
}

interface InvoiceReceiptBuilderProps {
  currentBusiness: Business;
  customers: Customer[];
  invoices: Invoice[];
  receipts: Receipt[];
  quotations: Quotation[];
  currencySymbol: string;
  onAddInvoice: (invoice: Invoice) => Promise<Invoice>;
  onAddReceipt: (receipt: Receipt) => Promise<Receipt>;
  onAddQuotation: (quotation: Quotation) => Promise<Quotation>;
  onConvertQuote: (quoteId: string) => Promise<void>;
  onUpdateInvoiceStatus?: (id: string, nextStatus: string) => void;
}

// 10 distinct, beautifully designed templates
// Each template's visual identity comes from FOUR real, wired-up levers -
// tableBorder/tableShadow (the line-items grid), totalsStyle (the Grand
// Total block - the single most-looked-at element on any invoice), badgeBg
// (the document-type pill), and tableHeaderBg - rather than color-tint
// alone, so the 10 designs read as genuinely different documents.
// ─────────────────────────────────────────────────────────────────────────
// AZIIKI BASIC VERSION 1.0 — MVP mode switch (kept in sync with the flag of
// the same name in App.tsx). MVP_TEMPLATE_IDS controls which of the 10
// designs below are surfaced in the picker; it currently includes all 10
// per the v1.0 document design system spec (all 10 premium, named designs
// available across Invoice/Receipt/Estimate). Trim this array any time to
// curate a smaller set again — the underlying DESIGN_TEMPLATES data and
// every template's rendering logic stay untouched either way.
// ─────────────────────────────────────────────────────────────────────────
const MVP_TEMPLATE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// How many of the 10 designs above a tier can actually use - Basic gets the
// one chosen at signup (defaults to the first design until that onboarding
// choice exists), Standard gets 3, Pro gets every design. Unlock order
// follows MVP_TEMPLATE_IDS itself (design #1, #2, #3, ...), the same
// ordinal-ceiling pattern TIER_MAX_PHASE uses for feature flags.
const TIER_MAX_TEMPLATES: Record<string, number> = { basic: 1, standard: 3, pro: Infinity };

const DESIGN_TEMPLATES = [
  {
    id: 0,
    name: "Corporate Style",
    description: "Formal corporate structure: bordered ledger table, boxed total, strict metadata columns.",
    category: "Corporate",
    layout: "ledger" as const,
    badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    tableHeaderBg: "bg-slate-50 border-b border-slate-200 text-slate-500",
    tableBorder: "border border-slate-200",
    tableShadow: "shadow-sm shadow-slate-200/5",
    totalsStyle: "boxed" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 1,
    name: "Minimal Professional",
    description: "Scandinavian white space: no table at all, hairline-ruled line list, quiet right-aligned total.",
    category: "Minimal",
    layout: "minimalList" as const,
    badgeBg: "bg-slate-100 text-slate-800 border border-slate-200",
    tableHeaderBg: "bg-transparent border-b border-slate-200 text-slate-400",
    tableBorder: "border-0",
    tableShadow: "shadow-none",
    totalsStyle: "underline" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 2,
    name: "Creative Agency",
    description: "Full-bleed colored header panel, business identity stacked large on the left, doc meta pinned right.",
    category: "Agency",
    layout: "split" as const,
    badgeBg: "bg-emerald-100 text-emerald-900 border border-emerald-300",
    tableHeaderBg: "bg-emerald-50/40 border-b border-emerald-150 text-emerald-800",
    tableBorder: "border-l-4 border-r border-t border-b border-slate-200",
    tableShadow: "shadow-md shadow-emerald-500/5",
    totalsStyle: "dark" as const,
    hasLeftStrip: true,
    logoAlign: "left" as const,
  },
  {
    id: 3,
    name: "Elegant Classic",
    description: "Serif high-society heading over a bordered ledger table, warm ivory shading, large underlined total.",
    category: "Classic",
    layout: "ledger" as const,
    badgeBg: "bg-stone-105 text-stone-800 border border-stone-300",
    tableHeaderBg: "bg-stone-50 border-b border-stone-200 text-stone-600",
    tableBorder: "border border-stone-200/80",
    tableShadow: "shadow-sm",
    totalsStyle: "underline" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 4,
    name: "Luxury Dark",
    description: "Full-bleed near-black header panel, gold rule accents, gold-on-navy total block.",
    category: "Luxury",
    layout: "split" as const,
    badgeBg: "bg-amber-50 text-amber-800 border border-amber-200",
    tableHeaderBg: "bg-slate-900 text-white",
    tableBorder: "border-4 border-double border-amber-250",
    tableShadow: "shadow-md",
    totalsStyle: "dark" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 5,
    name: "Photography Style",
    description: "Full-bleed color header panel with a large circular logo mark, playful bright rounded total badge.",
    category: "Photography",
    layout: "split" as const,
    badgeBg: "bg-sky-50 text-sky-800 border border-sky-200",
    tableHeaderBg: "bg-sky-50 text-sky-900 border-b border-sky-100",
    tableBorder: "border-0",
    tableShadow: "shadow-sm shadow-sky-400/10",
    totalsStyle: "badge" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 6,
    name: "Terminal Ledger",
    description: "Monospace terminal-ticket line list, dashed rules, boxed total in a code-block frame - a clean technical/startup register look.",
    category: "Startup",
    layout: "minimalList" as const,
    monospace: true,
    badgeBg: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    tableHeaderBg: "bg-indigo-50/60 border-t border-b border-dashed border-indigo-200 text-indigo-700",
    tableBorder: "border border-dashed border-indigo-200",
    tableShadow: "shadow-none",
    totalsStyle: "boxed" as const,
    hasLeftStrip: false,
    logoAlign: "right" as const,
  },
  {
    id: 7,
    name: "Diagonal Ribbon",
    description: "A compact black-and-green diagonal ribbon badge, a gray customer/phone/date info bar, fill-in-the-blank Name/Address lines, and an Amount-in-Words + Terms & Signature footer - a bold market-trader receipt book.",
    category: "Retail",
    layout: "ledger" as const,
    miniRibbonBadge: true,
    bookFields: true,
    footerStyle: "amountInWords" as const,
    badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    tableHeaderBg: "bg-slate-950 text-white",
    tableBorder: "border-0",
    tableShadow: "shadow-none",
    totalsStyle: "badge" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 8,
    name: "Utility Receipt",
    description: "Clean rounded card with a small boxed logo mark, a muted gray section-header band over the line items, and a bold final total row - built for a quick, no-fuss payment receipt.",
    category: "Receipt",
    layout: "card" as const,
    badgeBg: "bg-slate-100 text-slate-600 border border-slate-200",
    tableHeaderBg: "bg-slate-300/60 text-slate-600",
    tableBorder: "border border-slate-200",
    tableShadow: "shadow-none",
    totalsStyle: "underline" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 9,
    name: "Executive Navy & Gold",
    description: "A slim full-width navy title bar over a white statement, a gold rule, a navy item table, a labeled TOTAL AMOUNT / TAX / AMOUNT DUE card with a gold tab, and an Account Name/Number footer instead of a signature panel - gold bars top and bottom.",
    category: "Corporate",
    layout: "split" as const,
    edgeBars: true,
    badgeBg: "bg-amber-50 text-amber-800 border border-amber-200",
    tableHeaderBg: "bg-slate-900 text-white",
    tableBorder: "border border-slate-200",
    tableShadow: "shadow-sm",
    totalsStyle: "labeledCard" as const,
    footerStyle: "accountDetails" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  }
];

const PRESET_LOGOS = [
  { id: "consult", name: "Corporate Sparkle", char: "✦" },
  { id: "retail", name: "E-Commerce Cart", char: "🛒" },
  { id: "tech", name: "Infinite Hub", char: "∞" },
  { id: "lens", name: "Creative Eye", char: "👁" },
  { id: "node", name: "Network Terminal", char: "☊" }
];

export default function InvoiceReceiptBuilder({
  currentBusiness,
  customers,
  invoices,
  receipts,
  quotations,
  currencySymbol,
  onAddInvoice,
  onAddReceipt,
  onAddQuotation,
  onConvertQuote,
  onUpdateInvoiceStatus
}: InvoiceReceiptBuilderProps) {
  const { isEnabled, tier } = useFeatureFlags();
  // Navigation tabs: "builder" (Form Info) | "style" (10 Designs + Customs) | "history" (Past Invoices Ledger)
  // "pdfImport" was removed entirely - it was a fully simulated "OCR" that
  // never read the uploaded file's actual content at all (only its
  // filename, via basic keyword matching), fabricating a random client
  // name and dollar amount and offering to write that fabricated data
  // straight into real, saveable invoices/receipts/estimates. That's a
  // real risk of a business owner unknowingly issuing a document with
  // fabricated numbers. Removed rather than relabeled - a disclaimer
  // wouldn't fix the underlying risk of a "Populate Editor fields using
  // OCR" button writing fake data into a real financial document.
  const [activePaneTab, setActivePaneTab] = useState<"builder" | "style" | "history" | "brandKit">("builder");

  const changePaneTab = (tab: "builder" | "style" | "history" | "brandKit") => {
    setActivePaneTab(tab);
  };

  // Document status selection inside builder form
  const [invoiceStatus, setInvoiceStatus] = useState<Invoice["status"]>("Sent");

  // "Send by Email" feature state - degrades gracefully when RESEND_API_KEY
  // isn't configured on the server, rather than showing a broken button.
  const [emailSendingEnabled, setEmailSendingEnabled] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // "Request Payment" (Paystack) feature state - same graceful-degradation
  // pattern: hidden/disabled rather than broken when PAYSTACK_SECRET_KEY
  // isn't configured on the server yet.
  const [paystackEnabled, setPaystackEnabled] = useState<boolean>(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState<boolean>(false);

  // Same cache key as useFeatureFlags() (featureFlags.ts) - shares its
  // 15-minute stale-while-revalidate cache rather than issuing a second,
  // independent request for the exact same /config/features response.
  const { data: configFlags } = useCachedResource("aziiki_cache_features", () => api.config.features());
  useEffect(() => {
    setEmailSendingEnabled(configFlags?.emailSendingEnabled ?? false);
    setPaystackEnabled(configFlags?.paystackEnabled ?? false);
  }, [configFlags]);

  // Payment attempts (Paystack) for this business, so the Past Invoices
  // Ledger can show a failed/pending payment even though the invoice's own
  // status never changes on a failed attempt (only a successful one marks
  // it Paid - see the webhook in paymentsWebhook.ts).
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!paystackEnabled || !currentBusiness.id) return;
    api.payments.list(currentBusiness.id).then(setPaymentTransactions).catch(() => setPaymentTransactions([]));
  }, [currentBusiness.id, paystackEnabled, activePaneTab]);

  // Most recent payment attempt per invoice - only surfaced when it did NOT
  // succeed, since a successful one already shows as the invoice's own
  // "PAID" badge below.
  const latestFailedOrPendingPaymentByInvoice = new Map<string, any>();
  for (const tx of paymentTransactions) {
    if (!tx.invoiceId || tx.status === "success") continue;
    const existing = latestFailedOrPendingPaymentByInvoice.get(tx.invoiceId);
    if (!existing || new Date(tx.createdAt) > new Date(existing.createdAt)) {
      latestFailedOrPendingPaymentByInvoice.set(tx.invoiceId, tx);
    }
  }

  // Document mode
  const [mode, setMode] = useState<"invoice" | "receipt" | "quotation">("invoice");
  
  // Choose standard base template from 10 designs
  const [templateIndex, setTemplateIndex] = useState<number>(0);

  // A drag-and-drop-built template (see TemplateEditor.tsx) takes over the
  // live preview entirely when set - null means "render one of the 10
  // built-in bridge designs instead" (the existing behavior below).
  const [activeCustomLayout, setActiveCustomLayout] = useState<CustomBlockLayout | null>(null);
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<string | undefined>(undefined);

  // Custom design overrides ("Design their own receipts/invoices")
  const [accentColor, setAccentColor] = useState<string>("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState<string>("#475569");
  const [customAccentColor, setCustomAccentColor] = useState<string>("#f59e0b");
  const [borderStyle, setBorderStyle] = useState<"Solid" | "Double" | "Dashed" | "Dotted" | "None">("Solid");
  const [paperBackground, setPaperBackground] = useState<"White" | "Ivory" | "Sand" | "Gray">("White");
  const [logoPlacement, setLogoPlacement] = useState<"Left" | "Right" | "Center">("Left");
  const [footerAlignment, setFooterAlignment] = useState<"Left" | "Right" | "Center">("Left");
  const [dateFormat, setDateFormat] = useState<"YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY">("YYYY-MM-DD");
  const [bankDetails, setBankDetails] = useState<string>("Sovereign Savings Bank • Acc: 1024859210 • Accra Branch");
  const [momoDetails, setMomoDetails] = useState<string>("MTN Mobile Money • Registered: 0241234567 (Aziiki Corp)");
  const [termsAndConditions, setTermsAndConditions] = useState<string>("Payment is requested within 14 days of issue. Overdue accounts carry standard interest charges.");
  const [shipping, setShipping] = useState<number>(0);
  const [invoiceAmountPaid, setInvoiceAmountPaid] = useState<number>(0);

  const [selectedFont, setSelectedFont] = useState<string>("Arial");
  const [watermarkText, setWatermarkText] = useState<string>("ORIGINAL COMPLIANT");
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [headerLayout, setHeaderLayout] = useState<"Compact" | "TwoColumn" | "Centered">("TwoColumn");
  const [borderRadiusMode, setBorderRadiusMode] = useState<"None" | "Soft" | "Chubby">("Soft");
  const [customFooterNotes, setCustomFooterNotes] = useState<string>("Thank you for doing business with us! Settlement within 14 days is registered in our local Mobile Money channels.");
  const [authorizedSignature, setAuthorizedSignature] = useState<string>("CFO Operations Director");

  // Custom Logo uploading / Selection
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  // No preset pre-selected by default - an unset logo now falls back to the
  // business's own initials (see getInitials()) at the render sites below,
  // not a generic sparkle icon nobody chose.
  const [selectedPresetLogo, setSelectedPresetLogo] = useState<string | null>(null);

  // Editable Issuer (Issued By) Details
  const [issuerName, setIssuerName] = useState<string>(currentBusiness.name);
  const [issuerIndustry, setIssuerIndustry] = useState<string>(`${currentBusiness.industry} Branch`);
  const [issuerDesc, setIssuerDesc] = useState<string>(currentBusiness.description || "Compliant regional SME enterprise.");
  const [issuerContact, setIssuerContact] = useState<string>("Accra, Ghana • +233 24 123 4567");

  // Keep issuer details synced when user swaps active business profiles
  React.useEffect(() => {
    setIssuerName(currentBusiness.name);
    setIssuerIndustry(`${currentBusiness.industry} Branch`);
    setIssuerDesc(currentBusiness.description || "Compliant regional SME enterprise.");
    if (currentBusiness.primaryColor) {
      setAccentColor(currentBusiness.primaryColor);
    }
  }, [currentBusiness.id, currentBusiness.name, currentBusiness.industry, currentBusiness.description, currentBusiness.primaryColor]);

  // Live preview of the next atomically-tracked document number (backed by
  // document_numbering_sequences), replacing the old invoices.length-based
  // counter which broke across sessions, filtered views, and devices. Falls
  // back silently to the existing value in guest mode (no server session).
  React.useEffect(() => {
    if (!currentBusiness.id) return;
    let cancelled = false;
    api.documentNumbering
      .peek(currentBusiness.id, "invoice", "INV")
      .then((preview) => { if (!cancelled) setInvoiceNumber(preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentBusiness.id]);

  React.useEffect(() => {
    if (!currentBusiness.id) return;
    let cancelled = false;
    api.documentNumbering
      .peek(currentBusiness.id, "receipt", "REC")
      .then((preview) => { if (!cancelled) setReceiptNumber(preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentBusiness.id]);

  React.useEffect(() => {
    if (!currentBusiness.id) return;
    let cancelled = false;
    api.documentNumbering
      .peek(currentBusiness.id, "quotation", "EST")
      .then((preview) => { if (!cancelled) setQuoteNumber(preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentBusiness.id]);

  // Manual Custom Client (Issued To) Backup Details
  const [customClientName, setCustomClientName] = useState<string>("");
  const [customClientEmail, setCustomClientEmail] = useState<string>("");
  const [customClientPhone, setCustomClientPhone] = useState<string>("");
  const [customClientCategory, setCustomClientCategory] = useState<string>("B2B Trade Buyer");

  // Invoicing states
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || "custom");

  // Document currency: defaults to the business's own currency, but a
  // customer's preferredCurrency (set in CustomerCRM) auto-selects it when
  // that customer is picked - still always overridable per-document.
  const [documentCurrency, setDocumentCurrency] = useState<string>(currentBusiness.currency);
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  useEffect(() => {
    if (customerId === "custom") return;
    const selectedCustomer = customers.find((c) => c.id === customerId);
    if (selectedCustomer?.preferredCurrency) {
      setDocumentCurrency(selectedCustomer.preferredCurrency);
    }
  }, [customerId, customers]);

  // Resets to the neutral 1:1 default whenever the currency changes back
  // to the business's own - a foreign-currency document still needs the
  // rate typed in manually below.
  useEffect(() => {
    if (documentCurrency === currentBusiness.currency) {
      setExchangeRate(1);
    }
  }, [documentCurrency, currentBusiness.currency]);

  // Phase F of the currency/localization redesign: the printed/exported
  // document (the "Print Sheet" - window.print() of this same preview) used
  // to always show exactly 2 decimals with a bare currency-symbol prefix
  // regardless of the document's actual currency or the reader's locale -
  // wrong for 0-decimal currencies like JPY and 3-decimal ones like BHD, and
  // not how any of these currencies are conventionally written. fmt() routes
  // every amount shown on the document through the same Intl-based
  // formatter used everywhere else in the currency system.
  const fmt = (amount: number) => formatMoneyIntl(amount, documentCurrency);

  const [invoiceNumber, setInvoiceNumber] = useState<string>(`INV-${2026}${invoices.length + 101}`);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "Raw Material Batch Procurement", quantity: 120, rate: 25 },
    { description: "Regional Freight Transport Logistics", quantity: 1, rate: 450 }
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(currentBusiness.taxRate || 15);

  // Receipt states
  const [receiptNumber, setReceiptNumber] = useState<string>(`REC-${2026}${receipts.length + 101}`);
  const [receiptAmount, setReceiptAmount] = useState<number>(3450);
  const [receiptDesc, setReceiptDesc] = useState<string>("Reimbursement for supplier raw stocks and wholesale clothing transport.");
  const [paymentMethod, setPaymentMethod] = useState<"Mobile Money" | "Cash" | "Bank Transfer">("Mobile Money");

  // Quotation states
  const [quoteNumber, setQuoteNumber] = useState<string>(`EST-${2026}${quotations.length + 101}`);

  // Global Toast notifier
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showIssuerConfig, setShowIssuerConfig] = useState<boolean>(false);

  // Toast trigger helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Logo file upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // PNG only - a fixed, predictable format for something that gets
    // composited into every generated PDF (JPEG's lossy artifacts and lack
    // of transparency, or an SVG that could carry arbitrary markup, are
    // both worse fits here than one simple, well-understood raster format).
    if (file.type !== "image/png") {
      triggerToast("Please upload a PNG file for your logo.");
      e.target.value = "";
      return;
    }

    try {
      // Resized/compressed before ever becoming a data URL - see
      // imageCompress.ts. A raw phone-camera photo used as a "logo" used
      // to get stored at full multi-megabyte size; this typically brings
      // it under 100KB.
      const dataUrl = await compressImageForStorage(file);
      setUploadedLogo(dataUrl);
      setSelectedPresetLogo(null);
      triggerToast("Custom company logo loaded successfully into document headers!");
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : "Couldn't process that image. Please try a different file.");
    }
  };

  // Clean uploaded logo
  const clearUploadedLogo = () => {
    setUploadedLogo(null);
    setSelectedPresetLogo(null);
    triggerToast("Logo removed - using your business initials until you upload or pick one.");
  };


  // Item List operations
  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    if (field === "rate" || field === "quantity") {
      updatedItems[index][field] = Number(value);
    } else {
      updatedItems[index][field] = value;
    }
    setItems(updatedItems);
  };

  // All money math (subtotal/discount/tax/total) runs through integer-cents
  // arithmetic in src/lib/money.ts rather than raw floating point, so this
  // never drifts by fractions of a pesewa/cent across many line items.
  const getSubtotal = () => {
    return calculateInvoiceTotals(items, discount, taxRate).subtotal;
  };

  const getTotal = () => {
    return calculateInvoiceTotals(items, discount, taxRate, Number(shipping)).total;
  };

  const getBalanceDue = () => {
    return subtractMoney(getTotal(), Number(invoiceAmountPaid));
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      if (dateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
      if (dateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
      return `${year}-${month}-${day}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Publish / Dispatch Actions
  // Reverses the customerId encoding used when saving (see splitCustomerRef
  // in App.tsx / the resolvedCustId logic in each handleSave* below):
  // "custom-Some Name" -> select "custom" + fill in the free-text name
  // field, otherwise it's a real customer ID, select it directly.
  const loadCustomerRefIntoForm = (storedCustomerId: string) => {
    if (storedCustomerId?.startsWith("custom-")) {
      setCustomerId("custom");
      setCustomClientName(storedCustomerId.replace("custom-", ""));
    } else {
      setCustomerId(storedCustomerId || "custom");
      setCustomClientName("");
    }
  };

  // Loading a past document into the builder/preview - this is what makes
  // Past Ledger entries clickable. Populates every field the live preview
  // (#mockup-document-view) actually reads, then the person can use the
  // exact same Print/Download PDF/WhatsApp Share toolbar that already
  // exists for documents being created fresh - no separate "viewer" was
  // needed, the live preview already is one once it's fed real data.
  const loadInvoiceIntoBuilder = (inv: Invoice) => {
    setMode("invoice");
    loadCustomerRefIntoForm(inv.customerId);
    setDate(inv.date);
    setDueDate(inv.dueDate);
    setItems(inv.items.length > 0 ? inv.items : [{ description: "", quantity: 1, rate: 0 }]);
    setDiscount(inv.discount);
    setTaxRate(inv.taxRate);
    setInvoiceStatus(inv.status);
    setInvoiceNumber(inv.invoiceNumber);
    setDocumentCurrency(inv.currency || currentBusiness.currency);
    setExchangeRate(inv.exchangeRateToBusinessCurrency || 1);
    setActivePaneTab("builder");
    triggerToast(`Loaded Invoice ${inv.invoiceNumber} - preview updated on the right.`);
  };

  const loadReceiptIntoBuilder = (rec: Receipt) => {
    setMode("receipt");
    loadCustomerRefIntoForm(rec.customerId);
    setDate(rec.date);
    setReceiptDesc(rec.description);
    setReceiptAmount(rec.amountPaid);
    setPaymentMethod(rec.paymentMethod);
    setReceiptNumber(rec.receiptNumber);
    setDocumentCurrency(rec.currency || currentBusiness.currency);
    setExchangeRate(rec.exchangeRateToBusinessCurrency || 1);
    setActivePaneTab("builder");
    triggerToast(`Loaded Receipt ${rec.receiptNumber} - preview updated on the right.`);
  };

  const loadQuotationIntoBuilder = (q: Quotation) => {
    setMode("quotation");
    loadCustomerRefIntoForm(q.customerId);
    setDate(q.date);
    setDueDate(q.validUntil);
    setItems(q.items.length > 0 ? q.items : [{ description: "", quantity: 1, rate: 0 }]);
    setDiscount(q.discount);
    setQuoteNumber(q.quoteNumber);
    setDocumentCurrency(q.currency || currentBusiness.currency);
    setExchangeRate(q.exchangeRateToBusinessCurrency || 1);
    setActivePaneTab("builder");
    triggerToast(`Loaded Estimate ${q.quoteNumber} - preview updated on the right.`);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === "custom") {
      if (!customClientName.trim()) return triggerToast("Please fill in the Custom Customer Name first!");
    } else {
      if (!customerId) return triggerToast("Please select or assign a Client Profile first!");
    }

    const resolvedCustId = customerId === "custom" ? ("custom-" + customClientName.trim()) : customerId;

    const newInv: Invoice = {
      id: "inv-" + Math.random().toString(36).substr(2, 9),
      invoiceNumber, // display-only hint - see handleAddInvoice in App.tsx, the server never trusts this
      customerId: resolvedCustId,
      date,
      dueDate,
      items,
      discount,
      taxRate,
      status: invoiceStatus,
      partialPaidAmount: 0,
      businessId: currentBusiness.id,
      currency: documentCurrency,
      exchangeRateToBusinessCurrency: exchangeRate,
    };

    setIsSavingDocument(true);
    try {
      // Awaited on purpose: the success toast, and the number shown to the
      // person, now come from what the server actually reserved and saved
      // - not the pre-save /peek preview, which is only ever a guess.
      const created = await onAddInvoice(newInv);
      setInvoiceNumber(created.invoiceNumber);
      triggerToast(`Published Invoice ${created.invoiceNumber} successfully under status "${invoiceStatus}".`);
      api.documentNumbering.peek(currentBusiness.id, "invoice", "INV").then(setInvoiceNumber).catch(() => {});
      setInvoiceStatus("Sent");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't save this invoice. Please try again.");
    } finally {
      setIsSavingDocument(false);
    }
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === "custom") {
      if (!customClientName.trim()) return triggerToast("Please fill in the Custom Customer Name for this payment receipt!");
    } else {
      if (!customerId) return triggerToast("Please allocate a Client Profile first!");
    }

    const resolvedCustId = customerId === "custom" ? ("custom-" + customClientName.trim()) : customerId;

    const newRec: Receipt = {
      id: "rec-" + Math.random().toString(36).substr(2, 9),
      receiptNumber, // display-only hint - see handleAddReceipt in App.tsx
      customerId: resolvedCustId,
      date,
      description: receiptDesc,
      amountPaid: receiptAmount,
      paymentMethod,
      businessId: currentBusiness.id,
      currency: documentCurrency,
      exchangeRateToBusinessCurrency: exchangeRate,
    };

    setIsSavingDocument(true);
    try {
      const created = await onAddReceipt(newRec);
      setReceiptNumber(created.receiptNumber);
      triggerToast(`Logged payment confirmation receipt ${created.receiptNumber} into business archives.`);
      api.documentNumbering.peek(currentBusiness.id, "receipt", "REC").then(setReceiptNumber).catch(() => {});
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't save this receipt. Please try again.");
    } finally {
      setIsSavingDocument(false);
    }
  };

  // Resolves the currently-previewed invoice/receipt/quotation back to its
  // saved, server-issued record (if any) so "Send by Email"/"Sign
  // Document" can reference a real id - the preview panel itself is just
  // local draft state until saved.
  const savedDocumentId =
    mode === "invoice"
      ? invoices.find((inv) => inv.invoiceNumber === invoiceNumber && inv.businessId === currentBusiness.id)?.id
      : mode === "receipt"
      ? receipts.find((r) => r.receiptNumber === receiptNumber && r.businessId === currentBusiness.id)?.id
      : quotations.find((q) => q.quoteNumber === quoteNumber && q.businessId === currentBusiness.id)?.id;

  const resolvedDocCustomer = customerId && customerId !== "custom" ? customers.find((c) => c.id === customerId) : undefined;

  // Customer e-signature captured against this specific saved document
  // (invoice/quotation only - a receipt is proof of a payment already
  // made, not something a customer needs to sign off on).
  const [documentSignature, setDocumentSignature] = useState<any | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  useEffect(() => {
    if (!savedDocumentId || (mode !== "invoice" && mode !== "quotation")) {
      setDocumentSignature(null);
      return;
    }
    api.signatures.get(mode, savedDocumentId).then(setDocumentSignature).catch(() => setDocumentSignature(null));
  }, [savedDocumentId, mode]);

  const handleSendDocumentEmail = async () => {
    if (!savedDocumentId || (mode !== "invoice" && mode !== "receipt")) return;
    setIsSendingEmail(true);
    try {
      const result =
        mode === "invoice" ? await api.invoices.sendEmail(savedDocumentId) : await api.receipts.sendEmail(savedDocumentId);
      triggerToast(result.message);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to send the email. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Starts a Paystack checkout for the currently-saved invoice and opens it
  // in a new tab. Payment confirmation itself never happens here - it's the
  // server-side webhook (paystack/webhook) that later marks the invoice
  // Paid once Paystack actually confirms the charge.
  const handleRequestPayment = async () => {
    if (!savedDocumentId || mode !== "invoice") return;
    setIsRequestingPayment(true);
    try {
      const result = await api.payments.initializePaystack({
        businessId: currentBusiness.id,
        invoiceId: savedDocumentId,
        customerId: resolvedDocCustomer?.id,
        email: resolvedDocCustomer?.email,
        amount: getTotal(),
        currency: currentBusiness.currency,
      });
      window.open(result.authorizationUrl, "_blank", "noreferrer");
      triggerToast(`Payment link opened - share it with ${resolvedDocCustomer?.name || "your customer"} to collect payment.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to start the payment. Please try again.");
    } finally {
      setIsRequestingPayment(false);
    }
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === "custom") {
      if (!customClientName.trim()) return triggerToast("Please fill in the Custom Customer Name for this quote estimate!");
    } else {
      if (!customerId) return triggerToast("Select a client target to dispatch this quote proposal.");
    }

    const resolvedCustId = customerId === "custom" ? ("custom-" + customClientName.trim()) : customerId;

    const { total } = calculateInvoiceTotals(items, discount, 0);

    const newQuote: Quotation = {
      id: "quote-" + Math.random().toString(36).substr(2, 9),
      quoteNumber, // display-only hint - see handleAddQuotation in App.tsx
      customerId: resolvedCustId,
      date,
      validUntil: dueDate,
      items,
      discount,
      totalAmount: total,
      status: "Sent",
      businessId: currentBusiness.id,
      currency: documentCurrency,
      exchangeRateToBusinessCurrency: exchangeRate,
    };

    setIsSavingDocument(true);
    try {
      const created = await onAddQuotation(newQuote);
      setQuoteNumber(created.quoteNumber);
      triggerToast(`Quotation Proposal ${created.quoteNumber} logged successfully. Eligible for client dispatch.`);
      api.documentNumbering.peek(currentBusiness.id, "quotation", "EST").then(setQuoteNumber).catch(() => {});
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't save this estimate. Please try again.");
    } finally {
      setIsSavingDocument(false);
    }
  };

  // WhatsApp helper text - still used as the *message* accompanying the PDF
  // (or the fallback text if PDF sharing isn't supported on this device),
  // just no longer the entire payload the way a bare wa.me link was.
  const getWhatsAppMessage = (num: string, totalVal: number, typeLabel: string) => {
    const clientName = customerId === "custom" ? (customClientName || "Valued Customer") : (customers.find(c => c.id === customerId)?.name || "Valued Customer");
    return `Hello ${clientName},\n\nPlease find attached the ${typeLabel} (${num}) from ${issuerName}.\nTotal Value: ${currencySymbol}${totalVal.toLocaleString()}\nPlease route settlement via Mobile Money or Bank Transfer.\n\nThank you for partnering with our SME workspace!`;
  };

  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const num = mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber;
      const typeLabel = mode === "invoice" ? "Invoice" : mode === "receipt" ? "Receipt" : "Estimate";
      const pdfFile = await renderDocumentToPdf("mockup-document-view", `${typeLabel}-${num}.pdf`);
      downloadFile(pdfFile);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : "Couldn't generate the PDF. Please try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleWhatsAppPdfShare = async () => {
    setIsSharingPdf(true);
    try {
      const num = mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber;
      const typeLabel = mode === "invoice" ? "Invoice" : mode === "receipt" ? "Receipt Slip" : "Estimate Proposal";
      const totalVal = mode === "receipt" ? receiptAmount : getTotal();
      const pdfFile = await renderDocumentToPdf("mockup-document-view", `${typeLabel}-${num}.pdf`);
      const outcome = await sharePdfToWhatsApp(pdfFile, getWhatsAppMessage(num, totalVal, typeLabel));
      if (outcome === "downloaded") {
        triggerToast("Your browser can't attach files to WhatsApp directly, so the PDF downloaded instead — attach it in the WhatsApp chat that just opened.");
      }
    } catch (err) {
      // AbortError fires when the person just closes the native share sheet
      // without picking anything - that's a cancel, not a failure, and
      // shouldn't show an error toast.
      if (err instanceof DOMException && err.name === "AbortError") return;
      triggerToast(err instanceof Error ? err.message : "Couldn't generate the PDF. Please try again.");
    } finally {
      setIsSharingPdf(false);
    }
  };

  const activeTemplate = DESIGN_TEMPLATES[templateIndex];

  return (
    <div id="invoice-receipt-builder-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-800">
      
      {/* 4-Column Controls Panel */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm shadow-emerald-500/5">
        
        {/* Component Header info */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            Workspace Designer
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Configure, style, auto-import, and design local business invoices with high design standards.
          </p>
        </div>

        {/* Action Type Toggle */}
        <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setMode("invoice")}
            className={`py-2 text-[10px] font-bold font-sans rounded-lg transition-all cursor-pointer ${
              mode === "invoice" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Invoice
          </button>
          <button
            onClick={() => setMode("receipt")}
            className={`py-2 text-[10px] font-bold font-sans rounded-lg transition-all cursor-pointer ${
              mode === "receipt" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Receipt
          </button>
          <button
            onClick={() => setMode("quotation")}
            className={`py-2 text-[10px] font-bold font-sans rounded-lg transition-all cursor-pointer ${
              mode === "quotation" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Estimate
          </button>
        </div>

        {/* Tab Controls for the Side Panel */}
        <div className="flex border-b border-slate-100 pb-1 gap-1">
          <button
            onClick={() => changePaneTab("builder")}
            className={`flex-1 pb-2 text-[10px] font-bold font-sans border-b-2 text-center cursor-pointer transition-colors ${
              activePaneTab === "builder" ? "border-emerald-600 text-emerald-600 font-extrabold" : "border-transparent text-slate-455 hover:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1"><PencilSimple className="w-3.5 h-3.5" /> Info Form</span>
          </button>
          <button
            onClick={() => changePaneTab("style")}
            className={`flex-1 pb-2 text-[10px] font-bold font-sans border-b-2 text-center cursor-pointer transition-colors ${
              activePaneTab === "style" ? "border-emerald-600 text-emerald-600 font-extrabold" : "border-transparent text-slate-455 hover:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Styles</span>
          </button>
          <button
            onClick={() => changePaneTab("history")}
            className={`flex-1 pb-2 text-[10px] font-bold font-sans border-b-2 text-center cursor-pointer transition-colors ${
              activePaneTab === "history" ? "border-emerald-600 text-emerald-600 font-extrabold" : "border-transparent text-slate-455 hover:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1"><History className="w-3.5 h-3.5" /> Past Ledger</span>
          </button>
          <button
            onClick={() => changePaneTab("brandKit")}
            className={`flex-1 pb-2 text-[10px] font-bold font-sans border-b-2 text-center cursor-pointer transition-colors ${
              activePaneTab === "brandKit" ? "border-emerald-600 text-emerald-600 font-extrabold" : "border-transparent text-slate-455 hover:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Brand Kit</span>
          </button>
        </div>

        {/* Global Toast Alerts */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-250 text-emerald-850 text-[11px] p-3 rounded-xl font-sans flex items-start gap-2 animate-fade-in shadow-sm shadow-emerald-500/5 select-none">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-semibold">{toastMessage}</p>
          </div>
        )}

        {/* key={activePaneTab} forces a remount on every pane switch so the
            fade-in animation replays instead of only firing once. */}
        <div key={activePaneTab} className="animate-fade-in">
            {/* PANE 1: Standard Document Info Form */}
            {activePaneTab === "builder" && (
          <form onSubmit={mode === "invoice" ? handleSaveInvoice : mode === "receipt" ? handleSaveReceipt : handleSaveQuotation} className="space-y-3.5 text-xs">
            
            {/* COLLAPSIBLE ISSUER DETAILS BRAND CARD (Issued By) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm text-left">
              <button
                type="button"
                onClick={() => setShowIssuerConfig(!showIssuerConfig)}
                className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-slate-100/50 transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <Buildings className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-mono font-bold text-slate-650 uppercase tracking-widest">
                    Edit Issuer Brand Info (Issued By)
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 font-mono font-bold">{showIssuerConfig ? "Close" : "Customize"}</span>
              </button>

              {showIssuerConfig && (
                <div className="p-4 border-t border-slate-200 space-y-3 bg-white animate-fade-in text-xs">
                  {currentBusiness?.locked && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-[10px] font-sans font-medium flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" /> <strong>Brand Profile Locked:</strong> Company profile details are locked from editing. Uncheck "Lock Business Profile Details" in Settings (Edit) to modify.
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Company / Issuer Name</label>
                    <input
                      type="text"
                      disabled={currentBusiness?.locked}
                      value={issuerName}
                      onChange={(e) => setIssuerName(e.target.value)}
                      className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all font-medium disabled:opacity-60"
                      placeholder="e.g. BlueStar Agro-Ventures"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Industry / Branch label</label>
                      <input
                        type="text"
                        disabled={currentBusiness?.locked}
                        value={issuerIndustry}
                        onChange={(e) => setIssuerIndustry(e.target.value)}
                        className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                        placeholder="e.g. Accra Logistics Branch"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Accreditation / Contacts</label>
                      <input
                        type="text"
                        disabled={currentBusiness?.locked}
                        value={issuerContact}
                        onChange={(e) => setIssuerContact(e.target.value)}
                        className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                        placeholder="City, Country • Phone/Email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Legal/VAT Description</label>
                    <textarea
                      rows={2}
                      disabled={currentBusiness?.locked}
                      value={issuerDesc}
                      onChange={(e) => setIssuerDesc(e.target.value)}
                      className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans resize-none text-[11px] focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                      placeholder="Compliant SME hub description..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customer dropdown selection */}
            <div className="text-left">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wide">
                  Account CRM Customer (Issued To)
                </label>
                <span className="text-[9px] text-indigo-600 font-mono font-bold">Limitless Direct Input</span>
              </div>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans cursor-pointer transition-all font-medium"
              >
                <option value="custom">[Manual Client] Type custom customer below...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || "No Mobile Info"})</option>
                ))}
              </select>
            </div>

            {/* Document currency - defaults to the business's own currency,
                auto-fills from a customer's saved preference, always overridable. */}
            <div className={`grid ${documentCurrency !== currentBusiness.currency ? "grid-cols-2" : "grid-cols-1"} gap-2 text-left`}>
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wide block mb-1">
                  Document Currency
                </label>
                <select
                  value={documentCurrency}
                  onChange={(e) => setDocumentCurrency(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans cursor-pointer transition-all font-medium"
                >
                  {SUPPORTED_CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              {documentCurrency !== currentBusiness.currency && (
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wide block mb-1">
                    1 {documentCurrency} = ? {currentBusiness.currency}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                    className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans font-mono"
                  />
                </div>
              )}
            </div>

            {/* Custom Manual Customer Fields */}
            {customerId === "custom" && (
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-3 animate-fade-in text-left">
                <span className="text-[9.5px] font-mono text-emerald-600 uppercase tracking-widest font-extrabold flex items-center gap-1">
                  <User className="w-3 h-3" /> Custom Client Profile
                </span>
                <div>
                  <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Customer name / Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Osei-Tutu & Partners Ltd"
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Email Address</label>
                    <input
                      type="email"
                      placeholder="finance@oseitutu.gh"
                      value={customClientEmail}
                      onChange={(e) => setCustomClientEmail(e.target.value)}
                      className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+233 55 987 6543"
                      value={customClientPhone}
                      onChange={(e) => setCustomClientPhone(e.target.value)}
                      className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Client Segment Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Retail Consumer, Wholesale, Distributor"
                    value={customClientCategory}
                    onChange={(e) => setCustomClientCategory(e.target.value)}
                    className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Code identifier and date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 tracking-wider block mb-1">
                  Document Code Call
                </label>
                <input
                  type="text"
                  value={mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}
                  onChange={(e) => mode === "invoice" ? setInvoiceNumber(e.target.value) : mode === "receipt" ? setReceiptNumber(e.target.value) : setQuoteNumber(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 tracking-wider block mb-1">
                  Issue Statement Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Line items list for Invoices & Estimates */}
            {(mode === "invoice" || mode === "quotation") ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-450 tracking-wider uppercase">Line Ledger Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold font-sans flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="bg-slate-50/70 p-2.5 border border-slate-205 rounded-xl space-y-2">
                      <input
                        type="text"
                        placeholder="Service / stock material description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none font-sans"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-center"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-right"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                          className="bg-rose-50 text-rose-600 border border-rose-100 rounded-lg flex items-center justify-center p-1.5 hover:bg-rose-100 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Discounts and compliance rates */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450">Discount Percent (%)</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-455">Local VAT Rate (%)</label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full bg-white text-slate-805 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Shipping and Amount Paid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450">Shipping Cost ({currencySymbol})</label>
                    <input
                      type="number"
                      value={shipping}
                      onChange={(e) => setShipping(Number(e.target.value))}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-455">Amount Paid ({currencySymbol})</label>
                    <input
                      type="number"
                      value={invoiceAmountPaid}
                      onChange={(e) => setInvoiceAmountPaid(Number(e.target.value))}
                      className="w-full bg-white text-slate-805 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Receipt single item fields */
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">
                    Receipt Ledger Payment Description
                  </label>
                  <input
                    type="text"
                    value={receiptDesc}
                    onChange={(e) => setReceiptDesc(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">Amount Settled ({currencySymbol})</label>
                    <input
                      type="number"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(Number(e.target.value))}
                      className="w-full bg-white text-slate-805 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">Payment Channel</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-sans cursor-pointer"
                    >
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Cash">Cash Ledger</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Active Terms due details */}
            {mode === "invoice" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">
                    Settlement Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">
                    Document Payment Status
                  </label>
                  <select
                    value={invoiceStatus}
                    onChange={(e) => setInvoiceStatus(e.target.value as Invoice["status"])}
                    className="w-full bg-white text-slate-850 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-sans cursor-pointer focus:border-emerald-500"
                  >
                    <option value="Sent">Sent (Unpaid)</option>
                    <option value="Paid">Paid (Automated Stock Lift)</option>
                    <option value="Draft">Draft</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>
            )}

            {/* Save Buttons */}
            <button
              type="submit"
              disabled={isSavingDocument}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-sans uppercase tracking-wider disabled:opacity-60 disabled:cursor-wait"
            >
              {isSavingDocument ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isSavingDocument ? "Saving..." : `Save & Register ${mode}`}
            </button>
          </form>
        )}

        {/* PANE 2: Choose a Layout Design & Design Your Own */}
        {activePaneTab === "style" && (
          <div className="space-y-4 text-xs">

            {/* Template switcher section. MVP_TEMPLATE_IDS controls which of the 10 named designs are shown; trim it to curate a smaller set (array itself untouched either way). */}
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider mb-2">
                Choose from {MVP_TEMPLATE_IDS.length} Layout Designs
              </span>

              {/* Grid of designs. AZIIKI BASIC VERSION 1.0 fix: the badge number is now the design's
                  position within the DISPLAYED list (1, 2, 3, 4...), not its original array id — so if
                  MVP_TEMPLATE_IDS is ever trimmed to a subset again, the numbers stay sequential instead
                  of jumping (the earlier bug: #1, #2, #3, #6, #7). templateIndex/setTemplateIndex still
                  use the template's real array id underneath, so saved documents keep pointing at the
                  correct design regardless of what's currently shown. */}
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {DESIGN_TEMPLATES.filter((t) => MVP_TEMPLATE_IDS.includes(t.id)).map((tpl, displayPosition) => {
                  const i = tpl.id; // real array index — used for state/rendering, never shown to the user
                  const displayNumber = displayPosition + 1; // what the user sees — always sequential
                  const maxUnlocked = TIER_MAX_TEMPLATES[tier] ?? TIER_MAX_TEMPLATES.basic;
                  const isLocked = displayNumber > maxUnlocked;
                  return (
                  <button
                    key={tpl.id}
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) {
                        triggerToast(
                          tier === "basic"
                            ? "Upgrade to Standard or Pro to unlock more designs."
                            : "Upgrade to Pro to unlock every design."
                        );
                        return;
                      }
                      setTemplateIndex(i);
                      // Apply default configuration values for specific templates to improve UX
                      if (i === 6) {
                        setSelectedFont("Courier");
                      } else if (i === 3 || i === 2) {
                        setSelectedFont("Georgia");
                      } else {
                        setSelectedFont("Arial");
                      }
                      // A handful of templates have a signature color
                      // pairing from their reference design - applied as a
                      // starting point, still fully overridable below.
                      if (i === 9) {
                        setAccentColor("#B8860B"); // gold
                        setSecondaryColor("#102A43"); // navy
                      } else if (i === 7) {
                        setAccentColor("#22C55E"); // green
                        setSecondaryColor("#0F0F0F"); // near-black
                      } else if (i === 6) {
                        setAccentColor("#4F46E5"); // indigo
                        setSecondaryColor("#312E81");
                      } else if (i === 8) {
                        setAccentColor("#475569"); // slate-gray, neutral utility-receipt tone
                        setSecondaryColor("#1E293B");
                      }
                      triggerToast(`Applied visual template layout: ${tpl.name}`);
                    }}
                    className={`text-left p-2.5 rounded-xl border transition-all text-[11px] relative ${
                      isLocked
                        ? "border-slate-150 bg-slate-50/60 opacity-60 cursor-pointer"
                        : templateIndex === i
                        ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-bold text-slate-900 font-sans flex items-center gap-1">
                      <span className="text-emerald-600 font-bold font-mono">#{displayNumber}</span>
                      {tpl.name}
                      {isLocked && <Lock className="w-3 h-3 text-slate-400 ml-auto shrink-0" />}
                    </div>
                    <p className="text-[9px] text-slate-450 leading-tight mt-1 line-clamp-2">
                      {isLocked ? "Upgrade to unlock this design." : tpl.description}
                    </p>
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Design Their Own / Customizable Section */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                <Wrench className="w-3.5 h-3.5" /> Custom Branding Suite
              </span>

              {/* Accent Color Picker and safe codes */}
              <div>
                <label className="text-[10px] text-slate-455 block mb-1 font-sans">
                  Accent Primary Colorway
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#10b981"
                    className="flex-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono"
                  />
                </div>
                {/* Accent presets */}
                <div className="flex gap-1.5 mt-1.5">
                  {["#10b981", "#059669", "#047857", "#065f46", "#15803d", "#166534"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className="w-5 h-5 rounded-full border border-slate-200 cursor-pointer"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Font style Selector */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">
                  Typography pairing font
                </label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Arial">Sans-Serif (Standard Clear)</option>
                  <option value="Georgia">Editorial Serif (Tradition)</option>
                  <option value="Courier">Monospaced (Raw Code Tech)</option>
                  <option value="Trebuchet MS">Tech-Forward Outfit</option>
                </select>
              </div>

              {/* Secondary Color Picker */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-455 block mb-1 font-sans">
                    Secondary Accent
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#475569"
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-[10px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-455 block mb-1 font-sans">
                    Branding Highlight
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={customAccentColor}
                      onChange={(e) => setCustomAccentColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={customAccentColor}
                      onChange={(e) => setCustomAccentColor(e.target.value)}
                      placeholder="#f59e0b"
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-[10px]"
                    />
                  </div>
                </div>
              </div>

              {/* Paper Background Style */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Paper Background Treatment</label>
                <select
                  value={paperBackground}
                  onChange={(e) => setPaperBackground(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="White">Pure White (#FFFFFF)</option>
                  <option value="Ivory">Creamy Ivory (#FAF8F5)</option>
                  <option value="Sand">Warm Sand (#F5F1EA)</option>
                  <option value="Gray">Recycled Gray (#F3F4F6)</option>
                </select>
              </div>

              {/* Border Style Option */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Document Border Style</label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Solid">Solid Border</option>
                  <option value="Double">Double Border</option>
                  <option value="Dashed">Dashed Border</option>
                  <option value="Dotted">Dotted Border</option>
                  <option value="None">No Outer Border</option>
                </select>
              </div>

              {/* Logo Placement */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Logo Header Placement</label>
                <select
                  value={logoPlacement}
                  onChange={(e) => setLogoPlacement(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Left">Left-Aligned Logo</option>
                  <option value="Center">Centered Logo</option>
                  <option value="Right">Right-Aligned Logo</option>
                </select>
              </div>

              {/* Footer Alignment */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Footer Elements Alignment</label>
                <select
                  value={footerAlignment}
                  onChange={(e) => setFooterAlignment(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Left">Left Aligned</option>
                  <option value="Center">Centered Alignment</option>
                  <option value="Right">Right Aligned</option>
                </select>
              </div>

              {/* Date Format Option */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Localized Date Format</label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="YYYY-MM-DD">Standard ISO (YYYY-MM-DD)</option>
                  <option value="DD/MM/YYYY">Commonwealth (DD/MM/YYYY)</option>
                  <option value="MM/DD/YYYY">North American (MM/DD/YYYY)</option>
                </select>
              </div>

              {/* Bank Transfer Details Input */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Bank Payment Details</label>
                <input
                  type="text"
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  placeholder="e.g. Bank Name, Account Number, Branch"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                />
              </div>

              {/* Mobile Money Details Input */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Mobile Money (MOMO) Details</label>
                <input
                  type="text"
                  value={momoDetails}
                  onChange={(e) => setMomoDetails(e.target.value)}
                  placeholder="e.g. MTN Mobile Money / Telecel Cash"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                />
              </div>

              {/* Terms and Conditions Input */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Terms & Conditions Statement</label>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  rows={2}
                  placeholder="Official Terms and Conditions text..."
                  className="w-full bg-slate-50 text-slate-808 border border-slate-200 rounded-xl p-2 outline-none font-sans text-[11px]"
                />
              </div>

              {/* Logo Manager - preset custom icon vs upload brand */}
              <div>
                <label className="text-[10px] text-slate-455 block font-sans">Logo Import Channels</label>
                
                {/* File picker for custom logo */}
                <div className="mt-1 flex items-center justify-between gap-2 bg-slate-50 p-2 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    {uploadedLogo ? (
                      <img 
                        src={uploadedLogo} 
                        alt="Brand preview" 
                        className="w-8 h-8 rounded-lg object-contain bg-white border"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center text-xs">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold block text-slate-800">
                        {uploadedLogo ? "Brand Imaged loaded" : "Upload Custom Logo"}
                      </span>
                      <span className="text-[9px] text-slate-400 block">PNG only</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1 text-[9px] font-bold cursor-pointer font-sans transition-colors shrink-0">
                      Browse
                      <input
                        type="file"
                        accept="image/png"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    {uploadedLogo && (
                      <button
                        onClick={clearUploadedLogo}
                        className="text-rose-600 hover:text-rose-700 font-bold text-[9px] font-sans"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset badges choice if they do not have file ready */}
                {!uploadedLogo && (
                  <div className="mt-2">
                    <span className="text-[9px] text-slate-450 block mb-1">Or choose a pre-designed icon graphic:</span>
                    <div className="flex gap-1 overflow-x-auto max-width-full py-0.5">
                      {PRESET_LOGOS.map((logo) => (
                        <button
                          key={logo.id}
                          onClick={() => {
                            setSelectedPresetLogo(logo.id);
                            triggerToast(`Activated Preset Vector: ${logo.name}`);
                          }}
                          className={`px-2 py-1 rounded border text-[9px] whitespace-nowrap transition-all ${
                            selectedPresetLogo === logo.id 
                              ? "bg-emerald-600 text-white font-bold border-emerald-600" 
                              : "bg-slate-50 text-slate-655 border-slate-200"
                          }`}
                        >
                          <span className="mr-0.5 font-mono font-black">{logo.char}</span> {logo.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Borders control and roundness settings */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">
                  Edge Borders Roundness
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["None", "Soft", "Chubby"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setBorderRadiusMode(mode as any)}
                      className={`py-1 rounded border font-sans text-[10px] transition-all capitalize ${
                        borderRadiusMode === mode 
                          ? "bg-slate-200 border-slate-400 font-bold text-slate-900" 
                          : "bg-white border-slate-205 text-slate-500"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Watermark texts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-455 font-sans">
                    Enable Background Watermark
                  </label>
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="w-3.5 h-3.5 bg-white rounded accent-emerald-600"
                  />
                </div>
                {showWatermark && (
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. TAX COMPLIANT ORIGINAL"
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                  />
                )}
              </div>

              {/* Header Style */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Header Alignment Variant</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["Compact", "TwoColumn", "Centered"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setHeaderLayout(opt)}
                      className={`py-1 text-[9px] rounded border transition-all ${
                        headerLayout === opt 
                          ? "bg-emerald-600 text-white font-bold border-emerald-600" 
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      {opt === "TwoColumn" ? "2-Col Detail" : opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Signature Block edit */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Signature Title line</label>
                <input
                  type="text"
                  value={authorizedSignature}
                  onChange={(e) => setAuthorizedSignature(e.target.value)}
                  className="w-full bg-slate-50 text-slate-805 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                />
              </div>

              {/* Footnotes statement */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Footnote Disclaimers</label>
                <textarea
                  value={customFooterNotes}
                  onChange={(e) => setCustomFooterNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 text-slate-808 border border-slate-200 rounded-xl p-2 outline-none font-sans text-[11px]"
                />
              </div>

            </div>
          </div>
        )}

        {/* PANE 4: Past Invoices Ledger List */}
        {activePaneTab === "history" && (
          <div className="space-y-4 text-xs font-sans">
            {/* Root cause of "Past Ledger shows nothing for my receipts/
                estimates": this whole section used to unconditionally
                render ONLY the invoices list, no matter which document
                mode (Invoice/Receipt/Estimate) was selected up top. If you
                switched to Receipt or Estimate mode and opened Past
                Ledger, you'd see the invoices list regardless - or an
                invoices-only empty state even if you had receipts. Now
                each mode shows its own real, persisted list. */}
            {mode === "invoice" && (
            <>
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-650 flex items-center gap-1 uppercase tracking-wider mb-1">
                <ReceiptIcon className="w-3.5 h-3.5" /> Past Invoices Ledger List
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans mb-3">
                Manage sent estimates or invoices. Flagging an invoice as "Paid" automatically triggers inventory stock lift and ledger cash inflow transaction registration.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {invoices.filter(inv => inv.businessId === currentBusiness.id).map(inv => {
                const grandTotal = calculateInvoiceTotals(inv.items, inv.discount, inv.taxRate).total;
                const customerObj = customers.find(c => c.id === inv.customerId);

                return (
                  <div
                    key={inv.id}
                    onClick={() => loadInvoiceIntoBuilder(inv)}
                    className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 space-y-2 text-left relative flex flex-col justify-between hover:border-slate-350 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-[11px]">
                        {inv.invoiceNumber}
                      </span>
                      {inv.status === "Paid" ? (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" weight="fill" /> PAID
                        </span>
                      ) : inv.status === "Overdue" ? (
                        <span className="text-[9px] font-mono bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-md border border-red-150 flex items-center gap-1">
                          <Warning className="w-3 h-3" weight="fill" /> OVERDUE
                        </span>
                      ) : inv.status === "Draft" ? (
                        <span className="text-[9px] font-mono bg-slate-100/80 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                          <PencilSimple className="w-3 h-3" /> DRAFT
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-md border border-emerald-150 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> SENT / UNPAID
                        </span>
                      )}
                    </div>

                    {latestFailedOrPendingPaymentByInvoice.has(inv.id) && (
                      <div
                        className={`text-[9px] font-mono font-bold px-2 py-1 rounded-md border flex items-center gap-1 w-fit ${
                          latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "failed"
                            ? "bg-rose-50 text-rose-600 border-rose-150"
                            : latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "abandoned"
                            ? "bg-amber-50 text-amber-700 border-amber-150"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "failed"
                          ? (<><XCircle className="w-3 h-3 inline" /> Last payment attempt failed</>)
                          : latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "abandoned"
                          ? (<><Loader2 className="w-3 h-3 inline" /> Payment link opened, not completed</>)
                          : (<><Loader2 className="w-3 h-3 inline" /> Payment in progress</>)}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight text-slate-600 font-sans">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-mono">CLIENT</span>
                        <strong className="text-slate-800">{customerObj?.name || (inv.customerId?.startsWith("custom-") ? inv.customerId.replace("custom-", "") : "Direct Buyer")}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-mono">DUE VALUE</span>
                        <strong className="text-slate-900 text-xs font-mono">{currencySymbol}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-450">Issue: {inv.date}</span>
                      
                      {inv.status !== "Paid" && onUpdateInvoiceStatus && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateInvoiceStatus(inv.id, "Paid");
                            triggerToast(`Invoice ${inv.invoiceNumber} status finalized to "Paid"! Silent trigger adjusted warehouse stocks.`);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold select-none cursor-pointer px-2.5 py-1 rounded-lg transition-all shadow-sm inline-flex items-center gap-1"
                        >
                          Mark as Paid <CheckCircle className="w-3 h-3" weight="fill" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {invoices.filter(inv => inv.businessId === currentBusiness.id).length === 0 && (
                <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-8 text-center text-slate-400 italic text-[11px] font-sans">
                  No invoices are registered for this account profile yet. Fill in standard client info under info tab to generate records.
                </div>
              )}
            </div>
            </>
            )}

            {mode === "receipt" && (
            <>
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-650 flex items-center gap-1 uppercase tracking-wider mb-1">
                <ReceiptIcon className="w-3.5 h-3.5" /> Past Receipts Ledger List
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans mb-3">
                Every payment receipt you've issued, permanently on record and linked to its customer.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {receipts.filter(rec => rec.businessId === currentBusiness.id).map(rec => {
                const customerObj = customers.find(c => c.id === rec.customerId);
                return (
                  <div
                    key={rec.id}
                    onClick={() => loadReceiptIntoBuilder(rec)}
                    className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 space-y-2 text-left relative flex flex-col justify-between hover:border-slate-350 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-[11px]">{rec.receiptNumber}</span>
                      <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" weight="fill" /> SETTLED
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight text-slate-600 font-sans">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-mono">CLIENT</span>
                        <strong className="text-slate-800">{customerObj?.name || (rec.customerId?.startsWith("custom-") ? rec.customerId.replace("custom-", "") : "Direct Buyer")}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-mono">AMOUNT PAID</span>
                        <strong className="text-slate-900 text-xs font-mono">{currencySymbol}{(rec.amountPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-450">Issue: {rec.date}</span>
                      <span className="text-slate-450">{rec.paymentMethod}</span>
                    </div>
                  </div>
                );
              })}
              {receipts.filter(rec => rec.businessId === currentBusiness.id).length === 0 && (
                <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-8 text-center text-slate-400 italic text-[11px] font-sans">
                  No receipts are registered for this account profile yet. Log a payment under the info tab to generate records.
                </div>
              )}
            </div>
            </>
            )}

            {mode === "quotation" && (
            <>
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-650 flex items-center gap-1 uppercase tracking-wider mb-1">
                <ReceiptIcon className="w-3.5 h-3.5" /> Past Estimates Ledger List
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans mb-3">
                Every estimate you've issued. Accepted estimates can be converted into an invoice while keeping this original record intact.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {quotations.filter(q => q.businessId === currentBusiness.id).map(q => {
                const customerObj = customers.find(c => c.id === q.customerId);
                return (
                  <div
                    key={q.id}
                    onClick={() => loadQuotationIntoBuilder(q)}
                    className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 space-y-2 text-left relative flex flex-col justify-between hover:border-slate-350 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-[11px]">{q.quoteNumber}</span>
                      {q.status === "Converted" ? (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                          <ArrowBendUpRight className="w-3 h-3" /> CONVERTED
                        </span>
                      ) : q.status === "Accepted" ? (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-md border border-emerald-150 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" weight="fill" /> ACCEPTED
                        </span>
                      ) : q.status === "Draft" ? (
                        <span className="text-[9px] font-mono bg-slate-100/80 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                          <PencilSimple className="w-3 h-3" /> DRAFT
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-md border border-amber-150 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> SENT
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight text-slate-600 font-sans">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-mono">CLIENT</span>
                        <strong className="text-slate-800">{customerObj?.name || (q.customerId?.startsWith("custom-") ? q.customerId.replace("custom-", "") : "Direct Buyer")}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-mono">VALUE</span>
                        <strong className="text-slate-900 text-xs font-mono">{currencySymbol}{(q.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-450">Issue: {q.date}</span>
                      <span className="text-slate-450">Valid until: {q.validUntil}</span>
                    </div>
                  </div>
                );
              })}
              {quotations.filter(q => q.businessId === currentBusiness.id).length === 0 && (
                <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-8 text-center text-slate-400 italic text-[11px] font-sans">
                  No estimates are registered for this account profile yet. Fill in the info tab to generate records.
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* PANE 5: Brand Kit (colors, tax info, footer text used on every document) — kept in MVP */}
        {activePaneTab === "brandKit" && <BrandKitSettings businessId={currentBusiness.id} />}
        </div>

      </div>

      {/* 8-Column Document Preview Canvas (WYSIWYG Mockup layout representing client-facing branding) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        
        {/* Dynamic Mockup Card with real-time variables */}
        <div 
          id="mockup-document-view" 
          className="relative overflow-hidden flex flex-col justify-between select-all mx-auto w-full"
          style={{
            // A4-ish minimum height (roughly the 210:297mm ratio at this
            // card's typical width) so a short invoice/receipt still fills
            // one visual "page" instead of looking like a squished half-page
            // box. Deliberately NOT paired with a CSS `aspectRatio` here -
            // that property makes a block box's height a fixed, non-auto
            // value once width is definite, which silently clips any content
            // past that height (verified: overflow-hidden + aspectRatio
            // clipped roughly half of a content-heavy template's content,
            // including the totals/signature footer, on a narrow/mobile
            // viewport - the box never grew past the ratio-derived height).
            // With only minHeight set, the box's height stays auto and
            // genuinely grows with content, so a longer line-item list is
            // free to push it taller rather than getting cut off. This is
            // what renderDocumentToPdf() (html2canvas) captures, so the
            // exported PDF matches whatever is actually visible here.
            minHeight: "580px",
            fontFamily: selectedFont === "Arial" ? "Inter, sans-serif" : selectedFont === "Georgia" ? "Georgia, serif" : selectedFont === "Courier" ? "monospace" : "Outfit, sans-serif",
            backgroundColor: paperBackground === "White" ? "#ffffff" : paperBackground === "Ivory" ? "#FAF8F5" : paperBackground === "Sand" ? "#F5F1EA" : "#F3F4F6",
            color: paperBackground === "White" ? "#0f172a" : paperBackground === "Ivory" ? "#1e293b" : paperBackground === "Sand" ? "#334155" : "#1e293b",
            border: borderStyle === "None" ? "none" : borderStyle === "Double" ? `6px double ${accentColor}` : borderStyle === "Dashed" ? `1px dashed ${accentColor}` : borderStyle === "Dotted" ? `1px dotted ${accentColor}` : `1px solid ${accentColor}`,
            boxShadow: borderStyle === "None" ? "none" : "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: borderRadiusMode === "None" ? "0" : borderRadiusMode === "Soft" ? "12px" : "24px"
          }}
        >
          {activeCustomLayout ? (
            <DocumentBlockRenderer
              layout={activeCustomLayout}
              currencySymbol={currencySymbol}
              items={items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                total: item.quantity * item.rate,
              }))}
              data={{
                "business.name": issuerName,
                "business.address": issuerContact,
                "document.type": mode === "invoice" ? "INVOICE" : mode === "receipt" ? "RECEIPT" : "ESTIMATE",
                "document.number": mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber,
                "document.date": formatDateString(date),
                "document.dueDate": formatDateString(dueDate),
                "customer.name":
                  customerId === "custom"
                    ? customClientName || "Valued Customer"
                    : customers.find((c) => c.id === customerId)?.name || "Valued Customer",
                "customer.email":
                  customerId === "custom" ? customClientEmail || "" : customers.find((c) => c.id === customerId)?.email || "",
                "document.subtotal": fmt(getSubtotal()),
                "document.tax": fmt(calculateInvoiceTotals(items, discount, taxRate).taxAmount),
                "document.total": fmt(getTotal()),
              }}
            />
          ) : (
            <>
          {/* Watermark overlay */}
          {showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none overflow-hidden">
              <span className="text-[55px] md:text-[80px] font-black font-sans uppercase tracking-[15px] rotate-[340deg]">
                {watermarkText}
              </span>
            </div>
          )}

          {/* Left Vertical Band for Executive Left-Strip template */}
          {(activeTemplate.hasLeftStrip || templateIndex === 2) && (
            <div className="absolute top-0 bottom-0 left-0 w-2.5 opacity-90 pointer-events-none" style={{ backgroundColor: accentColor }}></div>
          )}

          {/* Top/bottom gold accent bars for Executive Navy & Gold */}
          {(activeTemplate as any).edgeBars && (
            <>
              <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none" style={{ backgroundColor: accentColor }}></div>
              <div className="absolute bottom-0 left-0 right-0 h-2 pointer-events-none" style={{ backgroundColor: accentColor }}></div>
            </>
          )}

          {/* Template-specific design highlights */}
          {templateIndex === 4 && ( // Luxury Dark's gold accent border inside
            <div className="absolute inset-2 border-2 border-amber-500/20 pointer-events-none rounded-lg" />
          )}

          {/* Core Content Area */}
          <div className={`p-6 sm:p-8 space-y-6 relative z-10 ${(activeTemplate as any).monospace ? "font-mono text-xs" : ""}`}>

            {/* Header alignments with Logo Placement and Layout styles.
                "split" layout templates (Creative Agency, Luxury Dark,
                Photography) get a genuine full-bleed identity panel here
                instead of a plain top strip — this is the single biggest
                structural difference between template families, not a
                recolor. */}
            {activeTemplate.layout === "split" ? (
              <div
                className="-mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6 px-6 sm:px-8 py-7 flex flex-col sm:flex-row justify-between items-start gap-5 relative overflow-hidden"
                style={{
                  backgroundColor: templateIndex === 4 ? "#0f172a" : (activeTemplate as any).headerShape === "ribbon" ? secondaryColor : (activeTemplate as any).edgeBars ? secondaryColor : accentColor,
                  borderBottom: (activeTemplate as any).edgeBars ? `3px solid ${accentColor}` : undefined,
                }}
              >
                {/* "Diagonal Cut" template's signature diagonal ribbon -
                    a second color block cut on an angle across the header
                    panel, matching its reference design's parallelogram
                    banner rather than a plain flat-color bar. */}
                {(activeTemplate as any).headerShape === "ribbon" && (
                  <div
                    className="absolute inset-y-0 right-0 w-2/3 pointer-events-none"
                    style={{ backgroundColor: accentColor, clipPath: "polygon(30% 0, 100% 0, 100% 100%, 0% 100%)" }}
                  />
                )}
                <div className={`relative z-10 flex items-start gap-3 ${logoPlacement === "Center" ? "flex-col items-center text-center w-full" : logoPlacement === "Right" ? "flex-row-reverse" : ""}`}>
                  {uploadedLogo ? (
                    <img
                      src={uploadedLogo}
                      alt="Company Custom Logo"
                      className="w-14 h-14 rounded-xl object-contain bg-white p-1 border border-white/30 shadow-sm select-none"
                    />
                  ) : selectedPresetLogo ? (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold select-none bg-white/15 border border-white/25">
                      {PRESET_LOGOS.find(l => l.id === selectedPresetLogo)?.char}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-black select-none bg-white/15 border border-white/25 tracking-tight">
                      {getInitials(issuerName)}
                    </div>
                  )}
                  <div className={logoPlacement === "Center" ? "text-center" : "text-left"}>
                    <h3 className="font-sans font-extrabold text-lg tracking-tight text-white">
                      {issuerName}
                    </h3>
                    <span className="text-[10px] font-semibold text-white/70 uppercase tracking-widest font-mono block mt-0.5">
                      {issuerIndustry}
                    </span>
                    <p className="text-[9px] text-white/60 font-mono mt-1">
                      {issuerContact}
                    </p>
                  </div>
                </div>

                <div className="relative z-10 space-y-1.5 text-left sm:text-right">
                  <span className="px-2.5 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase inline-block font-extrabold bg-white/15 text-white border border-white/25">
                    {mode === "invoice" ? "PROFESSIONAL INVOICE" : mode === "receipt" ? "PAYMENT RECORD" : "OFFICIAL ESTIMATE"}
                  </span>
                  <p className="text-sm font-bold font-mono text-white">
                    #{mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}
                  </p>
                  <div className="text-[9px] text-white/70 font-mono space-y-0.5">
                    <p>Issue Date: {formatDateString(date)}</p>
                    {mode === "invoice" && <p>Due Date: {formatDateString(dueDate)}</p>}
                    {mode === "quotation" && <p>Valid Until: {formatDateString(dueDate)}</p>}
                  </div>
                </div>
              </div>
            ) : (
            <div className={`flex flex-col ${
              headerLayout === "Centered" 
                ? "items-center text-center" 
                : "sm:flex-row justify-between items-start"
            } gap-4 border-b border-slate-100 pb-5`}>
              
              {/* Brand Logo & Basic details */}
              <div className={`flex ${
                logoPlacement === "Center" 
                  ? "flex-col items-center text-center" 
                  : logoPlacement === "Right" 
                  ? "flex-row-reverse items-start" 
                  : "flex-row items-start"
              } gap-3`}>
                
                {/* Brand Logo rendering */}
                {uploadedLogo ? (
                  <img
                    src={uploadedLogo}
                    alt="Company Custom Logo"
                    className="w-14 h-14 rounded-xl object-contain bg-slate-50 p-1 border shadow-sm select-none"
                  />
                ) : selectedPresetLogo ? (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl font-bold select-none shadow-sm shadow-emerald-500/10" style={{ backgroundColor: accentColor }}>
                    {PRESET_LOGOS.find(l => l.id === selectedPresetLogo)?.char}
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-black select-none shadow-sm shadow-emerald-500/10 tracking-tight" style={{ backgroundColor: accentColor }}>
                    {getInitials(issuerName)}
                  </div>
                )}

                <div className={logoPlacement === "Center" || headerLayout === "Centered" ? "text-center" : "text-left"}>
                  <h3 className="font-sans font-extrabold text-base tracking-tight text-slate-900">
                    {issuerName}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest font-mono block mt-0.5">
                    {issuerIndustry}
                  </span>
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm mt-1">
                    {issuerDesc}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {issuerContact}
                  </p>
                </div>
              </div>

              {/* Inward Document Tags & Ref Code */}
              <div className={`space-y-1.5 ${
                headerLayout === "Centered" ? "text-center" : "text-right"
              }`}>
                {(activeTemplate as any).miniRibbonBadge ? (
                  <div className="relative inline-block">
                    <span
                      className="px-4 py-1 text-[10px] font-mono tracking-widest uppercase inline-block font-extrabold text-white"
                      style={{ backgroundColor: "#0F0F0F", clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0% 100%)" }}
                    >
                      {mode === "invoice" ? "INVOICE" : mode === "receipt" ? "RECEIPT" : "ESTIMATE"}
                    </span>
                  </div>
                ) : (
                <span className={`px-2.5 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase inline-block font-extrabold ${activeTemplate.badgeBg}`}>
                  {mode === "invoice" ? "PROFESSIONAL INVOICE" : mode === "receipt" ? "PAYMENT RECORD" : "OFFICIAL ESTIMATE"}
                </span>
                )}
                <p className="text-sm font-bold font-mono text-slate-900">
                  #{mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}
                </p>
                <div className="text-[9px] text-slate-500 font-mono space-y-0.5">
                  <p>Issue Date: {formatDateString(date)}</p>
                  {mode === "invoice" && <p>Due Date: {formatDateString(dueDate)}</p>}
                  {mode === "quotation" && <p>Valid Until: {formatDateString(dueDate)}</p>}
                </div>
              </div>

            </div>
            )}

            {/* Client address & Terms details */}
            {(activeTemplate as any).bookFields ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  <p className="text-slate-700 flex items-baseline gap-1.5">
                    <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider shrink-0">Name:</span>
                    <span className="flex-1 border-b border-dotted border-slate-400 font-bold text-slate-900 pb-0.5 truncate">
                      {(customerId === "custom" ? customClientName : customers.find(c => c.id === customerId)?.name) || " "}
                    </span>
                  </p>
                  <p className="text-slate-700 flex items-baseline gap-1.5">
                    <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider shrink-0">Address:</span>
                    <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 truncate">{issuerContact || " "}</span>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-slate-200 bg-slate-100 text-center">
                  <div className="bg-slate-50 px-2 py-2">
                    <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider block">Order No.</span>
                    <span className="text-[11px] font-bold font-mono text-slate-900">{mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}</span>
                  </div>
                  <div className="bg-slate-50 px-2 py-2">
                    <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider block">Phone</span>
                    <span className="text-[11px] font-bold text-slate-900 truncate block">{(customerId === "custom" ? customClientPhone : customers.find(c => c.id === customerId)?.phone) || "-"}</span>
                  </div>
                  <div className="bg-slate-50 px-2 py-2">
                    <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider block">Date</span>
                    <span className="text-[11px] font-bold text-slate-900">{formatDateString(date)}</span>
                  </div>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">

              {/* Customer Profile info */}
              <div className={`p-3 rounded-xl border ${
                activeTemplate.tableBorder.includes("dashed") ? "border-dashed border-zinc-300" : activeTemplate.tableBorder.includes("dotted") ? "border-dotted border-teal-200" : "border-slate-100"
              } bg-slate-50/40 text-left`}>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Target Customer Profile</span>
                {customerId === "custom" ? (
                  <div className="space-y-0.5 select-all">
                    <p className="font-extrabold text-slate-905 text-xs">{customClientName || "Enter Custom Customer Name"}</p>
                    <p className="text-slate-500 text-[11px]">{customClientEmail || "No Email Provided"}</p>
                    <p className="text-slate-500 text-[11px]">{customClientPhone || "No Mobile Info"}</p>
                    <span className="text-[8px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded inline-block mt-1">
                      Custom Segment: {customClientCategory}
                    </span>
                  </div>
                ) : customerId ? (
                  (() => {
                    const cust = customers.find(c => c.id === customerId);
                    if (!cust) return <p className="text-slate-400 italic">Unassigned Client Profile</p>;
                    return (
                      <div className="space-y-0.5 select-all">
                        <p className="font-extrabold text-slate-905 text-xs">{cust.name}</p>
                        <p className="text-slate-500 text-[11px]">{cust.email || "accounts@client-hub.com"}</p>
                        <p className="text-slate-500 text-[11px]">{cust.phone || "+233 24..."}</p>
                        <span className="text-[8px] font-mono bg-slate-50 text-slate-500 border border-slate-150 px-1 py-0.5 rounded inline-block mt-1">
                          CRM category: {cust.category}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-slate-400 italic">Please select customer profile in standard input forms</p>
                )}
              </div>

              {/* Payment details and expectations */}
              <div className={`p-3 rounded-xl border ${
                activeTemplate.tableBorder.includes("dashed") ? "border-dashed border-zinc-300" : activeTemplate.tableBorder.includes("dotted") ? "border-dotted border-teal-200" : "border-slate-100"
              } bg-slate-50/40 text-left sm:text-right flex flex-col justify-between`}>
                <div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Expected Settlement Channels</span>
                  <p className="text-[10px] text-slate-650 leading-relaxed font-mono">
                    Bank: {bankDetails.split("•")[0]}
                  </p>
                  <p className="text-[10px] text-slate-650 leading-relaxed font-mono">
                    MOMO: {momoDetails.split("•")[1] || momoDetails}
                  </p>
                </div>
                {mode === "invoice" && (
                  <div className="mt-2 text-left sm:text-right">
                    <span className="text-[8px] font-mono text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded inline-block">
                      Terms: Net 14 Days
                    </span>
                  </div>
                )}
              </div>

            </div>
            )}

            {/* Line items billing grid - structural, not just re-tinted:
                "ledger" templates get a bordered table; "minimalList"
                (Minimal Professional) gets a clean hairline-ruled list with
                no table chrome at all, which is the actual defining trait
                of that design family, not a color swap. */}
            {(mode === "invoice" || mode === "quotation") ? (
              activeTemplate.layout === "minimalList" ? (
                <div className={`divide-y ${activeTemplate.tableBorder.includes("dashed") ? "divide-dashed divide-zinc-300" : activeTemplate.tableBorder.includes("dotted") ? "divide-dotted divide-teal-200" : "divide-slate-150"}`}>
                  <div className="flex items-center justify-between pb-2 uppercase tracking-wider font-mono text-[9px] text-slate-400">
                    <span>Statement Lines</span>
                    <span className="flex gap-6">
                      <span className="w-10 text-center">Qty</span>
                      <span className="w-16 text-right">Rate</span>
                      <span className="w-20 text-right">Total</span>
                    </span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 text-xs">
                      <span className="font-semibold text-slate-905">{item.description || "Consultancy Material Support"}</span>
                      <span className="flex gap-6 font-mono text-slate-600 shrink-0">
                        <span className="w-10 text-center">{item.quantity}</span>
                        <span className="w-16 text-right">{fmt(item.rate)}</span>
                        <span className="w-20 text-right font-bold text-slate-900">{fmt(item.quantity * item.rate)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
              <div className={`overflow-hidden rounded-xl ${activeTemplate.tableBorder} ${activeTemplate.tableShadow}`}>
                <table className="min-w-full divide-y divide-slate-100 text-xs select-all">
                  <thead className={activeTemplate.tableHeaderBg} style={{ backgroundColor: templateIndex === 4 ? "#0f172a" : templateIndex === 2 ? accentColor : undefined, color: templateIndex === 2 ? "#ffffff" : undefined }}>
                    {(activeTemplate as any).miniRibbonBadge ? (
                      <tr className="uppercase tracking-wider font-mono text-[9px] text-white">
                        <th className="px-4 py-3 text-left" style={{ backgroundColor: "#0F0F0F" }}>Statement Lines</th>
                        <th className="px-4 py-3 text-center w-16" style={{ backgroundColor: accentColor }}>Qty</th>
                        <th className="px-4 py-3 text-right w-24" style={{ backgroundColor: "#0F0F0F" }}>Rate</th>
                        <th className="px-4 py-3 text-right w-28" style={{ backgroundColor: accentColor }}>Row Total</th>
                      </tr>
                    ) : (
                    <tr className="uppercase tracking-wider font-mono text-[9px]">
                      <th className="px-4 py-3 text-left">Statement Lines</th>
                      <th className="px-4 py-3 text-center w-16">Qty</th>
                      <th className="px-4 py-3 text-right w-24">Rate</th>
                      <th className="px-4 py-3 text-right w-28">Row Total</th>
                    </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}>
                        <td className="px-4 py-3.5 font-semibold text-slate-905">{item.description || "Consultancy Material Support"}</td>
                        <td className="px-4 py-3.5 text-center font-mono text-slate-600">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-600">{fmt(item.rate)}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">{fmt(item.quantity * item.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            ) : (
              activeTemplate.layout === "minimalList" ? (
                /* Receipt Specific Layout Slip - "Market Receipt Book" family.
                   Structurally distinct from the card-style receipt below:
                   a diagonal corner cut (solid color, via clip-path - no
                   gradient), and a classic fill-in-the-blank prose format
                   instead of a modern app-style card. Reserved for the
                   minimalList template family (currently just Minimal
                   Professional) since this format reads as traditional
                   market/trade paperwork, which suits that character. */
                <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div
                    className="absolute top-0 right-0 w-20 h-20"
                    style={{
                      backgroundColor: accentColor,
                      clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                    }}
                  />
                  <div className="p-6 space-y-5 text-xs leading-loose relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: accentColor, color: accentColor }}>
                        <Check className="w-4 h-4" weight="bold" />
                      </div>
                      <h4 className="text-slate-900 font-extrabold text-xs tracking-wider uppercase font-mono">
                        Official Receipt of Payment
                      </h4>
                    </div>

                    <p className="text-slate-700">
                      Received with thanks from{" "}
                      <span className="font-bold border-b border-dotted border-slate-400 px-1">
                        {(customerId === "custom" ? customClientName : customers.find(c => c.id === customerId)?.name) || "________________"}
                      </span>
                      {" "}the sum of{" "}
                      <span className="font-bold border-b border-dotted border-slate-400 px-1" style={{ color: accentColor }}>{fmt(receiptAmount)}</span>
                    </p>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1">
                      <div>
                        <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Paid Via</span>
                        <span className="border-b border-dotted border-slate-400 block pb-1 font-semibold text-slate-800">{paymentMethod}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Reference No.</span>
                        <span className="border-b border-dotted border-slate-400 block pb-1 font-semibold text-slate-800 font-mono">{receiptNumber}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 pt-1">
                      {receiptDesc || "For goods/services rendered, as agreed between both parties."}
                    </p>

                    <div className="flex justify-end pt-3">
                      <div className="text-center">
                        <div className="w-32 border-b border-slate-400 mb-1"></div>
                        <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Authorized Signature</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              /* Receipt Specific Layout Slip - modern card family, used by
                 ledger and split templates. */
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-250 flex items-center justify-center rounded-full animate-fade-in" style={{ borderColor: accentColor, color: accentColor }}>
                  <Check className="w-6 h-6" weight="bold" />
                </div>
                <div>
                  <h4 className="text-slate-950 font-extrabold text-xs tracking-wider uppercase font-mono">Mobile Money Receipt Slip</h4>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed mt-1">
                    {receiptDesc || "Official settlement confirmation slip recorded in corporate cash ledgers."}
                  </p>
                </div>
                
                {/* Visual acquired cash box */}
                <div className="border border-slate-200/65 py-3 p-4 rounded-xl grid grid-cols-2 gap-4 text-xs font-sans bg-white">
                  <div className="text-left pl-2">
                    <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Settlement Routing</span>
                    <strong className="text-slate-850 font-bold block mt-0.5">{paymentMethod}</strong>
                  </div>
                  <div className="text-right pr-2">
                    <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Acquired Cash Position</span>
                    <strong className="font-mono text-sm block mt-0.5 font-bold" style={{ color: accentColor }}>
                      {fmt(receiptAmount)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1 opacity-25 font-mono text-[9px]">
                  <Barcode className="w-5 h-5 text-slate-800" />
                  <span>TRANSACTION-SECURE-Aziiki-#2026</span>
                </div>
              </div>
              )
            )}

            {/* Interactive totals block */}
            {(mode === "invoice" || mode === "quotation") && (
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-72 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-650">
                  <div className="flex justify-between">
                    <span>Base Subtotal:</span>
                    <span className="font-mono text-slate-800">{fmt(getSubtotal())}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>Discount ({discount}%):</span>
                      <span className="font-mono">-{fmt(calculateInvoiceTotals(items, discount, taxRate).discountAmount)}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex justify-between">
                      <span>Assessed VAT ({taxRate}%):</span>
                      <span className="font-mono">+{fmt(calculateInvoiceTotals(items, discount, taxRate).taxAmount)}</span>
                    </div>
                  )}
                  {Number(shipping) > 0 && (
                    <div className="flex justify-between">
                      <span>Shipping Logistics:</span>
                      <span className="font-mono">+{fmt(Number(shipping))}</span>
                    </div>
                  )}
                  
                  {/* Grand Total treatment is the single most-looked-at
                      element on the document, so it carries the biggest
                      per-template visual signature (activeTemplate.totalsStyle). */}
                  {activeTemplate.totalsStyle === "labeledCard" ? (
                    <div className="mt-1">
                      <div className="flex justify-end">
                        <span className="px-2.5 py-0.5 text-[8px] font-mono font-extrabold uppercase tracking-widest text-white rounded-t" style={{ backgroundColor: accentColor }}>
                          Statement
                        </span>
                      </div>
                      <div className="bg-slate-900 text-white divide-y divide-white/10 rounded-lg rounded-tr-none overflow-hidden border border-slate-200">
                        <div className="flex justify-between px-4 py-2 text-[10px]">
                          <span className="uppercase tracking-widest text-slate-400 font-mono">Total Amount</span>
                          <span className="font-mono font-bold">{fmt(getSubtotal())}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2 text-[10px]">
                          <span className="uppercase tracking-widest text-slate-400 font-mono">Tax</span>
                          <span className="font-mono font-bold">{fmt(calculateInvoiceTotals(items, discount, taxRate).taxAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5">
                          <span className="uppercase tracking-widest text-[10px] font-mono font-extrabold" style={{ color: accentColor }}>Amount Due</span>
                          <span className="font-mono font-black text-sm">{fmt(getTotal())}</span>
                        </div>
                      </div>
                    </div>
                  ) : activeTemplate.totalsStyle === "dark" ? (
                    <div className="flex justify-between items-center rounded-xl px-4 py-3 mt-1 text-sm font-black" style={{ backgroundColor: "#0f172a" }}>
                      <span className="text-slate-300 font-bold">Grand Total</span>
                      <span className="font-mono text-base" style={{ color: accentColor }}>{fmt(getTotal())}</span>
                    </div>
                  ) : activeTemplate.totalsStyle === "badge" ? (
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                      <span className="text-sm font-black text-slate-900">Grand Total:</span>
                      <span className="font-mono font-extrabold text-sm text-white rounded-full px-4 py-1.5" style={{ backgroundColor: accentColor }}>
                        {fmt(getTotal())}
                      </span>
                    </div>
                  ) : activeTemplate.totalsStyle === "underline" ? (
                    <div className="flex justify-between items-baseline border-t-2 border-slate-800 pt-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Grand Total</span>
                      <span className="font-mono font-black text-lg tracking-tight" style={{ color: accentColor }}>{fmt(getTotal())}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center rounded-lg px-3 py-2.5 mt-1 text-sm font-black text-slate-900 border" style={{ backgroundColor: `${accentColor}0d`, borderColor: `${accentColor}33` }}>
                      <span>Grand Total:</span>
                      <span className="font-mono" style={{ color: accentColor }}>{fmt(getTotal())}</span>
                    </div>
                  )}

                  {Number(invoiceAmountPaid) > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Paid to Date:</span>
                        <span className="font-mono">-{fmt(Number(invoiceAmountPaid))}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-xs font-bold text-slate-900">
                        <span>Balance Due:</span>
                        <span className="font-mono text-rose-600">{fmt(getBalanceDue())}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Amount-in-words + Terms & Signature footer, for the "Diagonal
                Ribbon" market-trader receipt-book design - replaces the
                stamp/QR verification panel below entirely. */}
            {(activeTemplate as any).footerStyle === "amountInWords" ? (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <p className="text-[11px] text-slate-600">
                  <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Amount in Words</span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 inline-block">
                    {(() => {
                      const amt = mode === "receipt" ? receiptAmount : getTotal();
                      const cents = Math.round((Math.abs(amt) - Math.floor(Math.abs(amt))) * 100);
                      const currencyWord = currencySymbol === "GH₵" ? "Ghana Cedis" : currencySymbol === "₦" ? "Naira" : "Dollars";
                      return `${numberToWords(amt)} ${currencyWord}${cents > 0 ? ` and ${numberToWords(cents)} ${currencySymbol === "GH₵" ? "Pesewas" : "Cents"}` : ""} Only`;
                    })()}
                  </span>
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700">Terms &amp; Conditions:</span> Goods sold are not returnable. Please verify items before leaving the counter.
                </p>
                <div className="flex justify-end pt-2">
                  <div className="text-center">
                    <div className="w-36 border-b border-slate-400 mb-1"></div>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Signature</span>
                  </div>
                </div>
              </div>
            ) : (activeTemplate as any).footerStyle === "accountDetails" ? (
              <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider block">Account Name</span>
                    <span className="font-bold text-slate-900">{issuerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider block">Account Number</span>
                    <span className="font-bold text-slate-900">{bankDetails.split("•")[0]}</span>
                  </div>
                </div>
                <div className="text-center border-t border-slate-200 pt-1.5 w-36">
                  <span className="text-[12px] font-serif italic text-slate-700 flex items-center justify-center gap-1 max-w-full truncate tracking-wider font-semibold" style={{ fontFamily: "'Georgia', serif" }}>
                    <Signature className="w-3.5 h-3.5 shrink-0 not-italic" /> {authorizedSignature}
                  </span>
                  <span className="text-[8px] font-mono text-slate-400 tracking-widest block uppercase mt-0.5">Authorized Officer</span>
                </div>
              </div>
            ) : (
            <>
            {/* Verification Widgets Panel (Stamp, Barcode, QR code, Signature) */}
            <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row justify-between items-center gap-6">

              {/* Barcode & QR Code representation */}
              <div className="flex items-center gap-4">
                {/* SVG QR Code */}
                <div className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0 flex flex-col items-center justify-center relative">
                  <svg className="w-full h-full text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="6" height="6" rx="1" />
                    <rect x="16" y="2" width="6" height="6" rx="1" />
                    <rect x="2" y="16" width="6" height="6" rx="1" />
                    <rect x="16" y="16" width="2" height="2" />
                    <rect x="20" y="20" width="2" height="2" />
                    <rect x="16" y="20" width="2" height="2" />
                    <rect x="20" y="16" width="2" height="2" />
                    <path d="M10 4h2M10 8h2M4 10v2M8 10v2M12 12h2" />
                  </svg>
                  <span className="text-[6px] text-slate-400 absolute bottom-0.5 tracking-tight scale-75">SCAN TO PAY</span>
                </div>

                {/* SVG Barcode */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex gap-[1.5px] h-7 items-end bg-white px-2 py-0.5 rounded border border-slate-200">
                    {[1,2,1,3,1,1,2,1,3,1,2,2,1,3,1,2,1,1,2,3,1,1,2].map((w, idx) => (
                      <div key={idx} className="bg-slate-800" style={{ width: `${w}px`, height: idx % 4 === 0 ? "100%" : "85%" }} />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 mt-0.5 scale-90">REF-{mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}</span>
                </div>
              </div>

              {/* Rubber Stamp and Authorized Signature */}
              <div className="flex items-center gap-4">
                {/* SVG Certified Rubber Stamp */}
                <div className="w-16 h-16 rounded-full border-4 border-dashed flex items-center justify-center p-0.5 rotate-[345deg] opacity-80 shrink-0 select-none cursor-default font-sans" style={{ borderColor: accentColor, color: accentColor }}>
                  <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-0.5">
                    <span className="text-[5px] font-bold tracking-widest leading-none uppercase">Aziiki</span>
                    <span className="text-[7px] font-black tracking-tight leading-none uppercase my-0.5">VERIFIED</span>
                    <span className="text-[5px] font-mono tracking-tighter leading-none">{new Date().getFullYear()}-AUTH</span>
                  </div>
                </div>

                {/* cursive signature lines */}
                <div className="text-center border-t border-slate-200 pt-1.5 w-36">
                  <span className="text-[12px] font-serif italic text-slate-700 flex items-center justify-center gap-1 max-w-full truncate tracking-wider font-semibold" style={{ fontFamily: "'Georgia', serif" }}>
                    <Signature className="w-3.5 h-3.5 shrink-0 not-italic" /> {authorizedSignature}
                  </span>
                  <span className="text-[8px] font-mono text-slate-400 tracking-widest block uppercase mt-0.5">
                    Authorized Officer
                  </span>
                </div>

                {/* Business representative signature (invoice/quotation only) -
                    strictly the full name of the person at the business
                    signing the document, not the customer's. New captures
                    are always signatureKind "typed" (SignatureCapture.tsx no
                    longer offers hand-drawing); the "drawn" branch here only
                    renders signatures captured before that change. */}
                {(mode === "invoice" || mode === "quotation") && (
                  <div className="text-center border-t border-slate-200 pt-1.5 w-36">
                    {documentSignature ? (
                      documentSignature.signatureKind === "typed" ? (
                        <span className="text-[12px] text-slate-700 block max-w-full truncate tracking-wider font-semibold" style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
                          {documentSignature.signatureData}
                        </span>
                      ) : (
                        <svg viewBox="0 0 460 90" className="w-full h-8 mx-auto">
                          {(JSON.parse(documentSignature.signatureData) as string[]).map((d, i) => (
                            <path key={i} d={d} fill="none" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          ))}
                        </svg>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">Not yet signed</span>
                    )}
                    <span className="text-[8px] font-mono text-slate-400 tracking-widest block uppercase mt-0.5">
                      {documentSignature ? documentSignature.signerName : "Business Representative"}
                    </span>
                  </div>
                )}
              </div>

            </div>
            </>
            )}

          </div>
            </>
          )}

          {/* Footnotes disclaimers and compliance footer - this is real
              document content (kept inside #mockup-document-view on
              purpose, so it prints/exports with the document). The action
              buttons that used to live in this same flex row have been
              moved out entirely - see the toolbar rendered right after
              this div closes below. */}
          <div className="bg-slate-50 border-t border-slate-150 p-6 text-xs font-sans text-slate-500 relative z-10">
            <div className={`max-w-md ${
              footerAlignment === "Center" ? "text-center mx-auto" : footerAlignment === "Right" ? "text-right ml-auto" : "text-left"
            }`}>
              <p className="font-extrabold text-slate-700 tracking-wider text-[9px] uppercase font-mono">Disclaimers & Conditions</p>
              <p className="text-[10px] text-slate-450 leading-relaxed font-sans mt-1">
                {termsAndConditions}
              </p>
              <p className="text-[9px] text-slate-400 italic mt-1 leading-relaxed">
                {customFooterNotes}
              </p>
            </div>
          </div>

        </div>

        {/* Document action toolbar - deliberately rendered OUTSIDE
            #mockup-document-view (the div closed just above). These
            buttons are app chrome, not part of the invoice/receipt/
            estimate itself, so they must never be captured by
            html2canvas (documentPdf.ts), never appear in the generated
            PDF, and never show up when printing (the @media print rule
            in index.css only un-hides #mockup-document-view and its
            children - this toolbar being a sibling, not a child, is what
            keeps it out of both). */}
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleWhatsAppPdfShare}
            disabled={isSharingPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {isSharingPdf ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-white" />
            )}
            {isSharingPdf ? "Preparing PDF..." : "WhatsApp Share"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="bg-white border border-slate-205 text-slate-700 hover:bg-slate-100 font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider disabled:opacity-60 disabled:cursor-wait"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
            ) : (
              <FileArrowDown className="w-3.5 h-3.5 text-slate-600" />
            )}
            {isDownloadingPdf ? "Preparing PDF..." : "Download PDF"}
          </button>
          {mode === "invoice" && (
            <button
              type="button"
              onClick={handleRequestPayment}
              disabled={!paystackEnabled || !resolvedDocCustomer?.email || !savedDocumentId || isRequestingPayment}
              title={
                !paystackEnabled
                  ? "Card/Mobile Money payments are not configured for this workspace yet."
                  : !resolvedDocCustomer?.email
                  ? "Add an email address to this customer's profile to request payment."
                  : !savedDocumentId
                  ? "Save this invoice first to request payment."
                  : `Request payment of ${currencySymbol}${getTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via Paystack`
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
            >
              {isRequestingPayment ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5 text-white" />
              )}
              Request Payment
            </button>
          )}
          {(mode === "invoice" || mode === "receipt") && (
            <button
              type="button"
              onClick={handleSendDocumentEmail}
              disabled={!emailSendingEnabled || !resolvedDocCustomer?.email || !savedDocumentId || isSendingEmail}
              title={
                !emailSendingEnabled
                  ? "Email sending is not configured for this workspace yet."
                  : !resolvedDocCustomer?.email
                  ? "Add an email address to this customer's profile to send by email."
                  : !savedDocumentId
                  ? `Save this ${mode} first to send it by email.`
                  : `Email this ${mode} to ${resolvedDocCustomer.email}`
              }
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800"
            >
              {isSendingEmail ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5 text-white" />
              )}
              Send by Email
            </button>
          )}
          {/* Signature capture: off by default in Phase 1, code preserved. Toggle via admin portal -> signature_capture. */}
          {isEnabled("signature_capture") && (mode === "invoice" || mode === "quotation") && (
            <button
              type="button"
              onClick={() => setIsSignatureModalOpen(true)}
              disabled={!savedDocumentId}
              title={!savedDocumentId ? `Save this ${mode} first to capture a signature.` : documentSignature ? "Replace the captured signature" : "Capture the business representative's signature"}
              className="bg-white border border-slate-205 text-slate-700 hover:bg-slate-100 font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Signature className="w-3.5 h-3.5" /> {documentSignature ? "Signed" : "Sign Document"}
            </button>
          )}
          <button
            onClick={() => {
              window.print();
            }}
            className="bg-white border border-slate-205 text-slate-700 hover:bg-slate-100 font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Sheet
          </button>
        </div>

        {/* Dynamic Estimate proposal Convert block */}
        {mode === "quotation" && quotations.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in text-xs shadow-sm shadow-emerald-500/5 select-none">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg shrink-0">
                <RefreshCw className="w-4.5 h-4.5 animate-spin text-emerald-600" />
              </div>
              <div className="leading-relaxed">
                <h5 className="font-bold text-emerald-800 font-sans">Convert estimate quotation parameters to Invoice?</h5>
                <p className="text-slate-600 text-[11px] mt-0.5 font-sans">Directly transform this quote into a draft invoice ledger with zero double data entry.</p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await onConvertQuote(quotations[0].id);
                  setMode("invoice");
                  triggerToast(`Extracted estimate variables successfully from Quote #${quotations[0].quoteNumber}`);
                } catch (err) {
                  triggerToast(err instanceof Error ? err.message : "Couldn't convert this estimate to an invoice. Please try again.");
                }
              }}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 font-bold transition-all cursor-pointer font-sans shrink-0 block text-[11px] uppercase tracking-wider shadow-sm"
            >
              Convert Estimate Now
            </button>
          </div>
        )}

      </div>

      {isEnabled("signature_capture") && isSignatureModalOpen && savedDocumentId && (mode === "invoice" || mode === "quotation") && (
        <SignatureCapture
          businessId={currentBusiness.id}
          documentType={mode}
          documentId={savedDocumentId}
          onSaved={(signature) => {
            setDocumentSignature(signature);
            setIsSignatureModalOpen(false);
            triggerToast(`Signature captured from ${signature.signerName}.`);
          }}
          onClose={() => setIsSignatureModalOpen(false)}
        />
      )}
    </div>
  );
}
