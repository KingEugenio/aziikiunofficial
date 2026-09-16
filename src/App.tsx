import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Buildings as Building2, Stack as Layers2, Coins, Users, Target, Warehouse, Brain as BrainCircuit, MagicWand as Sparkles, CurrencyDollar as DollarSign, DeviceMobile as Smartphone, CheckCircle, TrendUp as TrendingUp, WarningCircle as AlertCircle, Database, ShieldCheck, SignOut as LogOut, UserCheck, ChartLine as LineChart, BookOpen, ArrowsClockwise, Lock, GearSix, Plus, X, Globe, ArrowRight, User, UsersThree, ChartBar, LockKey, CaretDown, CaretUp, Package, Question as HelpCircle } from "@phosphor-icons/react";
import { Business, Customer, Transaction, Invoice, Receipt, Quotation, Investment, Asset, Goal, Debt, InventoryItem, Partner, Shareholder, UserRole, AuditLog } from "./types";
import BusinessDashboard from "./components/BusinessDashboard";

const AIFieldAssistant = lazy(() => import("./components/AIFieldAssistant"));
import { Skeleton, SkeletonDashboard, SkeletonTable, SkeletonDetail, SkeletonForm, SkeletonCRM, SkeletonInventory, SkeletonBillingBuilder, SkeletonReportsCharts, SkeletonAppShell } from "./components/Skeleton";
import { useMinimumLoadingTime, useLoadingTimedOut } from "./hooks/useMinimumLoadingTime";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import BrandLogo from "./components/BrandLogo";
import NotificationBanner from "./components/NotificationBanner";
import AnnouncementBanner from "./components/AnnouncementBanner";
import SurveyPrompt from "./components/SurveyPrompt";
import MobileNavBar from "./components/MobileNavBar";
import Footer from "./components/Footer";
import OfflineStatusBanner from "./components/OfflineStatusBanner";
import MfaOnboardingNudge from "./components/MfaOnboardingNudge";
import { ONBOARDING_COMPLETE_KEY } from "./components/onboarding/onboardingStorage";
import { useFeatureFlags } from "./lib/featureFlags";
import { clearCachePrefix } from "./lib/sessionCache";
import { useRealtimeConfigSync } from "./lib/realtimeConfigSync";

// Code-split the heaviest views: each is only downloaded when the user
// actually navigates to that tab, instead of bloating the initial bundle.
// AuthPortal and OnboardingFlow are here too - a returning, already-signed-in
// user never touches either one again after their first session, so neither
// belongs in the main chunk every visitor has to download up front.
const PersonalWorkspace = lazy(() => import("./components/PersonalWorkspace"));
const InvoiceReceiptBuilder = lazy(() => import("./components/InvoiceReceiptBuilder"));
const NetWorthInvestments = lazy(() => import("./components/NetWorthInvestments"));
const FinancialReports = lazy(() => import("./components/FinancialReports"));
const AppGuide = lazy(() => import("./components/AppGuide"));
const AdMonetizationHub = lazy(() => import("./components/AdMonetizationHub"));
const AuthPortal = lazy(() => import("./components/AuthPortal"));
const OnboardingFlow = lazy(() => import("./components/onboarding/OnboardingFlow"));
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy"));
const LegalTextPage = lazy(() => import("./components/LegalTextPage"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const HelpSupportPage = lazy(() => import("./components/HelpSupportPage"));
import NotFoundPage from "./components/NotFoundPage";
// CustomerCRM and InventoryManager were previously eager-imported (bundled
// into the main chunk with everything else), which meant there was never a
// Suspense boundary to attach a loading state to - they just appeared
// instantly because their code was already downloaded, whether or not the
// data behind them was ready. Lazy-loading them is a genuine, real
// code-splitting win, and gives page-shaped skeletons (below) somewhere
// meaningful to actually be shown.
const CustomerCRM = lazy(() => import("./components/CustomerCRM"));
const InventoryManager = lazy(() => import("./components/InventoryManager"));
const PurchaseOrderManager = lazy(() => import("./components/PurchaseOrderManager"));
const TeamManager = lazy(() => import("./components/TeamManager"));

// Supabase imports
import { supabase } from "./lib/supabaseClient";
import { api } from "./lib/api";
import { bulkImportState, isUuid } from "./lib/bulkImport";
import { calculateInvoiceTotals, addMoney, subtractMoney } from "./lib/money";
import { getCurrencySymbol } from "./lib/currency";
import { isImageLogo, businessLogoGlyph } from "./lib/businessLogo";
import { compressImageForStorage } from "./lib/imageCompress";
import { detectBrowserCountryCode, detectBrowserTimezone, describeTimezoneOffsetDiff } from "./lib/location";
import { COUNTRIES } from "./lib/countries";
import { trackFeatureUsage } from "./lib/analytics";

export default function App() {
  // Granular, admin-controlled feature flags (see supabase/migrations/0032
  // and the /admin portal) - replaces the single hardcoded MVP_MODE boolean
  // that used to live here. Each Phase-2+ feature (Net Worth/Investments,
  // Ad Monetization Hub, Personal Workspace, Business Partners/Shareholders,
  // Inventory, ...) now has its own flag, off by default, code and routes
  // left fully intact ("hide, not delete" per the product teardown).
  const { isEnabled, tier, loaded: flagsLoaded, flags } = useFeatureFlags();
  // Custom 404: Aziiki is a single-page app served entirely at "/" - there
  // is no real routing, everything else is client-side tab state, not a
  // distinct URL. A path other than "/" means someone followed a stale or
  // mistyped link, not a legitimate part of the app. Checked once, since
  // the pathname doesn't change during a normal session (Supabase auth
  // redirects use hash fragments on "/", not a different pathname).
  const [isUnknownPath] = useState<boolean>(
    () => window.location.pathname !== "/" && window.location.pathname !== "/index.html"
  );
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState<boolean>(false);
  const [showTermsOfService, setShowTermsOfService] = useState<boolean>(false);
  const [showRefundPolicy, setShowRefundPolicy] = useState<boolean>(false);

  // Authentication, Firestore Loading list and sync markers
  const [user, setUser] = useState<any>(null);
  // Pushes a cache-clear the instant an admin changes a flag or this
  // account's plan, instead of waiting up to 15 minutes for the normal
  // stale-while-revalidate window - see realtimeConfigSync.ts.
  useRealtimeConfigSync(user?.id);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem("aziiki_is_guest") === "true";
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  // Set when the workspace-loading effect below fails outright (network
  // error, Supabase misconfiguration, a table genuinely missing, etc.) so
  // it can be shown as a real, visible banner with a retry button instead
  // of silently leaving the person with an empty, non-functional workspace
  // and no explanation. syncRetryCount is bumped by the retry button to
  // re-run the effect.
  const [criticalSyncError, setCriticalSyncError] = useState<string | null>(null);
  const [syncRetryCount, setSyncRetryCount] = useState(0);
  const [needsPasswordRecovery, setNeedsPasswordRecovery] = useState<boolean>(false);
  // AZIIKI BASIC VERSION: surfaces a friendly message when a password-reset
  // or email-confirmation link is invalid/expired (Supabase redirects back
  // with #error=...&error_code=otp_expired instead of firing an auth event).
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== "true"
  );
  // Carried over from OnboardingFlow's last step so AuthPortal's Create
  // Account tab opens with the email already filled in - see the handoff
  // comment on the OnboardingFlow render below.
  const [onboardingPrefillEmail, setOnboardingPrefillEmail] = useState<string | undefined>(undefined);

  // Active Navigation Tab
  // Options: "dashboard" | "billing" | "crm" | "wealth" | "stock" | "monetize" | "ai"
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Unique per-tab browser title (see useDocumentTitle) - Aziiki has no
  // client-side router, so this is the only thing that ever changes
  // document.title away from index.html's static default.
  const TAB_TITLES: Record<string, string> = {
    dashboard: "Scorecard",
    billing: "Billing & PDFs",
    crm: "Customer CRM",
    wealth: "Wealth & Goals",
    stock: "Warehouse Stock",
    purchaseOrders: "Purchase Orders",
    team: "Team",
    reports: "Reports & Wisdom",
    ai: "CFO AI Advisor",
    monetize: "Updates & Growth",
    guide: "App Guide & Academy",
    helpSupport: "Help & Support",
    settings: "Settings",
  };
  useDocumentTitle(`${TAB_TITLES[activeTab] ?? "Dashboard"} — Aziiki`);

  // Priority order to fall back through if the current/requested tab's flag
  // is off - covers both the original Phase 2+ flags and the Phase 1 "core"
  // ones added in migration 0044, since an admin can now switch any of
  // these off too. Returns null only if literally every one of them is off.
  const CORE_TAB_FLAGS: Record<string, string> = {
    dashboard: "core_dashboard",
    billing: "core_billing",
    crm: "core_customers",
    reports: "core_reports",
    ai: "core_ai_advisor",
    guide: "core_app_guide",
  };
  const getFallbackTab = (): string | null => {
    for (const t of ["dashboard", "billing", "crm", "reports", "ai", "guide"]) {
      if (isEnabled(CORE_TAB_FLAGS[t])) return t;
    }
    return null;
  };

  const changeTab = (tab: string) => {
    // Block navigation to a tab whose feature flag is off (defends against
    // stale deep links / persisted state, not just hidden nav buttons).
    const flagForTab: Record<string, string> = {
      wealth: "net_worth_investments",
      monetize: "ad_monetization_hub",
      stock: "inventory_management",
      purchaseOrders: "purchase_orders",
      team: "team_memberships_invite_ui",
      settings: "core_settings",
      helpSupport: "core_help_support",
      ...CORE_TAB_FLAGS,
    };
    const requiredFlag = flagForTab[tab];
    if (requiredFlag && !isEnabled(requiredFlag)) {
      setActiveTab(getFallbackTab() ?? tab);
      window.scrollTo({ top: 0 });
      return;
    }
    setActiveTab(tab);
    // Tapping a nav icon should always open that screen at the top, not
    // wherever the previous screen happened to be scrolled to - the user
    // is still free to scroll down again once the new screen is open.
    window.scrollTo({ top: 0 });
    if (tab === "reports") trackFeatureUsage("reportsGenerated");
    if (tab === "ai") trackFeatureUsage("aiQueries");
    if (tab === "guide") trackFeatureUsage("guideViews");
  };

  // Safety net: if the currently-active tab's flag goes off after the fact
  // (admin flips it mid-session, or flags finish loading after mount and
  // the default "dashboard" turns out to be disabled), fall back instead of
  // showing a blank content area.
  useEffect(() => {
    if (!flagsLoaded) return;
    const requiredFlag = CORE_TAB_FLAGS[activeTab];
    if (requiredFlag && !isEnabled(requiredFlag)) {
      const fallback = getFallbackTab();
      if (fallback) setActiveTab(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsLoaded, activeTab, flags]);
  const [showMobileBanner, setShowMobileBanner] = useState<boolean>(true);
  // Mobile only: the sidebar is `sticky top-0` (see <aside> below) so it
  // stays pinned while the page scrolls, rather than a true side column
  // like it is on desktop - past a certain content height that meant the
  // business-switcher + account widget permanently ate a big chunk of a
  // phone screen, with page content scrolling in underneath it. Collapsing
  // it down to just the logo bar (still tappable to expand again) fixes
  // that without touching the desktop layout at all.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [dismissedTravelBannerFor, setDismissedTravelBannerFor] = useState<string | null>(null);
  // Persisted (not just per-session) - once someone closes the Launch
  // Edition welcome banner, it should free up that space for good, not
  // reappear on every reload.
  const [launchBannerDismissed, setLaunchBannerDismissed] = useState<boolean>(
    () => localStorage.getItem("aziiki_launch_banner_dismissed") === "true"
  );
  const [plans, setPlans] = useState<Array<{ tier: string; paystackLink: string | null; priceMinorUnits: number | null; currency: string; provider: string }>>([]);
  useEffect(() => {
    api.config
      .plans()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  // Business Profile Editing & Registration States
  const [showBrandConfig, setShowBrandConfig] = useState<boolean>(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandFormError, setBrandFormError] = useState<string | null>(null);
  const [bizFormName, setBizFormName] = useState<string>("");
  const [bizFormIndustry, setBizFormIndustry] = useState<string>("");
  const [bizFormCurrency, setBizFormCurrency] = useState<string>("GHS");
  const [bizFormCountryCode, setBizFormCountryCode] = useState<string>("");
  const [bizFormTimezone, setBizFormTimezone] = useState<string>("");
  const [bizFormTaxRate, setBizFormTaxRate] = useState<number>(15);
  const [bizFormLogo, setBizFormLogo] = useState<string>("💼");
  const [bizFormDesc, setBizFormDesc] = useState<string>("");
  const [isAddingNewBiz, setIsAddingNewBiz] = useState<boolean>(false);
  const [isPersonalForm, setIsPersonalForm] = useState<boolean>(false);
  const [bizFormType, setBizFormType] = useState<"Sole Proprietor" | "Partnership" | "Company">("Sole Proprietor");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [allowFinancialApprovals, setAllowFinancialApprovals] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bizFormLocked, setBizFormLocked] = useState<boolean>(false);

  // Sub-forms editing states
  const [newPartnerName, setNewPartnerName] = useState<string>("");
  const [newPartnerOwnership, setNewPartnerOwnership] = useState<number>(50);
  const [newPartnerCapital, setNewPartnerCapital] = useState<number>(10000);

  const [newShareholderName, setNewShareholderName] = useState<string>("");
  const [newShareholderShares, setNewShareholderShares] = useState<number>(1000);
  const [newShareholderCapital, setNewShareholderCapital] = useState<number>(25000);

  const [newRoleName, setNewRoleName] = useState<string>("");
  const [newRoleEmail, setNewRoleEmail] = useState<string>("");
  const [newRoleType, setNewRoleType] = useState<"Owner" | "Admin" | "Accountant" | "Staff">("Staff");

  // Multi-Business Switcher State
  const [businesses, setBusinesses] = useState<Business[]>([]);
  
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("biz-1");
  // Safe, neutral fallback so property access (currentBusiness.name,
  // .currency, .id, etc.) never throws across the hundreds of places that
  // assume a business always exists - this is what's briefly shown if
  // someone gets let past the sync timeout above before their real
  // business has loaded. It deliberately has no fake name or identity;
  // BusinessDashboard shows an explicit "still setting up" empty state
  // when businesses.length === 0 rather than pretending this placeholder
  // is real data.
  const EMPTY_BUSINESS_PLACEHOLDER: Business = {
    id: "",
    name: "",
    industry: "",
    logo: "💼",
    primaryColor: "#2563eb",
    taxRate: 0,
    currency: "USD",
    description: "",
    businessType: "Sole Proprietor",
    partners: [],
    shareholders: [],
    roles: [],
    allowFinancialApprovals: false,
    auditLogs: [],
  };
  const currentBusiness = businesses.find(b => b.id === currentBusinessId) || businesses[0] || EMPTY_BUSINESS_PLACEHOLDER;

  // Shared by the desktop sidebar's plan badge and MobileNavBar's "More"
  // sheet, so both surfaces link to the same upgrade destination. Regional
  // pricing: prefer the plan row matching the active business's own
  // currency (GHS, NGN, or whichever African currency an admin has priced),
  // falling back to USD for a business whose currency has no matching row
  // configured - "flat USD outside Africa" with no extra picker UI, since
  // the business's currency is already real per-business data.
  const nextTier = tier === "basic" ? "standard" : tier === "standard" ? "pro" : null;
  const nextTierPlans = nextTier ? plans.filter((p) => p.tier === nextTier) : [];
  const nextPlan =
    nextTierPlans.find((p) => p.currency === currentBusiness.currency) ?? nextTierPlans.find((p) => p.currency === "USD");
  const upgradeUrl =
    nextPlan?.paystackLink && user?.email
      ? `${nextPlan.paystackLink}${nextPlan.paystackLink.includes("?") ? "&" : "?"}email=${encodeURIComponent(user.email)}`
      : nextPlan?.paystackLink;

  // Traveling-user detection (Phase D of the currency/localization redesign):
  // if the business has a saved home timezone and it doesn't match the
  // browser's current one, the user is probably traveling - surface it as a
  // dismissible notice rather than silently assuming "home" applies.
  const browserTimezone = useMemo(() => detectBrowserTimezone(), []);
  const travelNotice = useMemo(() => {
    if (!currentBusiness?.timezone || currentBusiness.timezone === browserTimezone) return null;
    return describeTimezoneOffsetDiff(currentBusiness.timezone, browserTimezone);
  }, [currentBusiness?.timezone, browserTimezone]);

  // Global Ledger States populated with professional mock seed entries
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const [quotations, setQuotations] = useState<Quotation[]>([]);

  // Sovereign high-yield local asset placements (updated to tracker model with amountInvested)
  const [investments, setInvestments] = useState<Investment[]>([]);

  // Owned Asset Register and Planning state
  const [assets, setAssets] = useState<Asset[]>([]);

  // Business expansions goals
  const [goals, setGoals] = useState<Goal[]>([]);

  // Liabilities registry
  const [debts, setDebts] = useState<Debt[]>([]);

  // Warehouse inventory counts
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // 1. Listen to Supabase Auth changes and fetch this user's dashboard state
  // via the relational API (src/lib/api.ts) instead of a single Firestore
  // document blob.
  useEffect(() => {
    // AZIIKI BASIC VERSION: a reset/verification link that's expired or was
    // already used sends the user back here with an error in the URL hash
    // rather than a session — surface that instead of a silent, confusing
    // plain login screen.
    if (window.location.hash.includes("error=")) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const errorCode = hashParams.get("error_code");
      const errorDescription = hashParams.get("error_description");
      if (errorCode === "otp_expired") {
        setAuthLinkError("That link has expired. Request a new one below.");
      } else if (hashParams.get("error")) {
        setAuthLinkError(
          errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, " ")) : "That link is no longer valid. Request a new one below."
        );
      }
      // Clean the error params out of the URL so a refresh doesn't re-show them.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setNeedsPasswordRecovery(true);
        setIsAuthLoading(false);
        return;
      }
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user);
      } else {
        setIsAuthLoading(false);
      }
    })();

    return () => authListener.subscription.unsubscribe();
  }, []);

  // 1a. Whenever `user` becomes set (fresh login, page reload with an
  // existing session, or token refresh), load this account's data.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setIsGuest(false);
      localStorage.setItem("aziiki_is_guest", "false");
      setIsAuthLoading(true);
      setCriticalSyncError(null);
      try {
        const remoteData = await api.sync.fetchAll();
        if (cancelled) return;
        if (remoteData && remoteData.businesses && remoteData.businesses.length > 0) {
          setBusinesses(remoteData.businesses || []);
          setTransactions(remoteData.transactions || []);
          setCustomers(remoteData.customers || []);
          setInvoices(remoteData.invoices || []);
          setReceipts(remoteData.receipts || []);
          setQuotations(remoteData.quotations || []);
          setInvestments(remoteData.investments || []);
          setAssets(remoteData.assets || []);
          setGoals(remoteData.goals || []);
          setDebts(remoteData.debts || []);
          setInventory(remoteData.inventory || []);
          setCurrentBusinessId(remoteData.businesses[0].id);
        } else {
          // No remote data exists yet for this account - create one real,
          // persisted business row rather than a local-only placeholder.
          const created = await api.businesses.create({
            name: "My Enterprise",
            industry: "Retail & Logistics",
            logo: "💼",
            primaryColor: "#2563eb",
            taxRate: 15,
            currency: "USD",
            description: "Clean cloud-connected ledger workspace.",
            businessType: "Sole Proprietor",
          });
          if (cancelled) return;
          setBusinesses([{ ...created, partners: [], shareholders: [], roles: [], auditLogs: [] }]);
          setCurrentBusinessId(created.id);
          setTransactions([]);
          setCustomers([]);
          setInvoices([]);
          setReceipts([]);
          setQuotations([]);
          setInvestments([]);
          setAssets([]);
          setGoals([]);
          setDebts([]);
          setInventory([]);
        }
      } catch (e) {
        console.error("Failed to fetch this account's dashboard data:", e);
        // This used to be silent - businesses stayed at whatever the
        // hardcoded seed data initializer provided (fake demo businesses),
        // so a real failure here was invisible: the app just looked fine
        // with fake data. Now that there's no seed data to fall back on,
        // a failure here means NO business exists at all, which cascades
        // into "Apply Brand Changes does nothing" (silently can't find a
        // business to update) and "still syncing to the cloud" on every
        // subsequent save (there's no valid businessId to attach anything
        // to). Surface it for real instead of hiding it again.
        setCriticalSyncError(
          e instanceof Error ? e.message : "Couldn't load your workspace. Please check your connection and try again."
        );
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately keyed on user?.id (a stable primitive), not the `user`
    // object itself: Supabase hands onAuthStateChange a brand-new User
    // object on effectively every event, including ones that don't change
    // who's signed in (tab focus, token auto-refresh ticks, ...). Depending
    // on the object caused this effect to refire continuously - each refire
    // called api.sync.fetchAll() and re-mounted the whole dashboard, which
    // is what was hammering /api/sync, /api/config/*, /api/announcements,
    // /api/surveys, and /api/notifications into a 429 rate-limit storm
    // (the exact same root cause as the AdminApp.tsx admin-access loop
    // fixed earlier - just never applied here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, syncRetryCount]);

  // 1b. Load guest data from localStorage when in guest mode
  useEffect(() => {
    localStorage.setItem("aziiki_is_guest", isGuest ? "true" : "false");
    if (isGuest && !user) {
      const savedData = localStorage.getItem("aziiki_guest_data");
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.businesses && parsed.businesses.length > 0) {
            setBusinesses(parsed.businesses);
            if (parsed.transactions) setTransactions(parsed.transactions);
            if (parsed.customers) setCustomers(parsed.customers);
            if (parsed.invoices) setInvoices(parsed.invoices);
            if (parsed.receipts) setReceipts(parsed.receipts);
            if (parsed.quotations) setQuotations(parsed.quotations);
            if (parsed.investments) setInvestments(parsed.investments);
            if (parsed.assets) setAssets(parsed.assets);
            if (parsed.goals) setGoals(parsed.goals);
            if (parsed.debts) setDebts(parsed.debts);
            if (parsed.inventory) setInventory(parsed.inventory);
            setCurrentBusinessId(parsed.businesses[0].id);
          }
        } catch (e) {
          console.error("Failed to restore guest data from localStorage:", e);
        }
      }
    }
  }, [isGuest, user]);

  // 2. Guest sessions (no Supabase account) persist to localStorage only.
  // Signed-in sessions no longer round-trip the entire dashboard state as one
  // blob on every change - each mutation handler below (handleAddTransaction,
  // handleAddInvoice, etc.) persists just that one record via the relational
  // API as it happens, which is what makes per-table RLS meaningful.
  useEffect(() => {
    if (isAuthLoading || !isGuest) return;

    const delayDebounceLocal = setTimeout(() => {
      const guestPayload = {
        businesses,
        transactions,
        customers,
        invoices,
        receipts,
        quotations,
        investments,
        assets,
        goals,
        debts,
        inventory
      };
      localStorage.setItem("aziiki_guest_data", JSON.stringify(guestPayload));
    }, 1000);
    return () => clearTimeout(delayDebounceLocal);
  }, [isGuest, isAuthLoading, businesses, transactions, customers, invoices, receipts, quotations, investments, assets, goals, debts, inventory]);

  // Keep brand configuration editing form in sync with active business properties
  useEffect(() => {
    if (currentBusiness && !isAddingNewBiz) {
      setBizFormName(currentBusiness.name);
      setBizFormIndustry(currentBusiness.industry);
      setBizFormCurrency(currentBusiness.currency);
      setBizFormCountryCode(currentBusiness.countryCode || detectBrowserCountryCode() || "");
      setBizFormTimezone(currentBusiness.timezone || detectBrowserTimezone());
      setBizFormTaxRate(currentBusiness.taxRate);
      setBizFormLogo(currentBusiness.logo || "💼");
      setBizFormDesc(currentBusiness.description || "");
      setBizFormType(currentBusiness.businessType || "Sole Proprietor");
      setPartners(currentBusiness.partners || []);
      setShareholders(currentBusiness.shareholders || []);
      setRoles(currentBusiness.roles || []);
      setAllowFinancialApprovals(currentBusiness.allowFinancialApprovals || false);
      setAuditLogs(currentBusiness.auditLogs || []);
      setBizFormLocked(currentBusiness.locked || false);
    } else if (isAddingNewBiz) {
      setBizFormName("");
      setBizFormIndustry("");
      setBizFormCurrency("GHS");
      setBizFormCountryCode(detectBrowserCountryCode() || "");
      setBizFormTimezone(detectBrowserTimezone());
      setBizFormTaxRate(15);
      setBizFormLogo("💼");
      setBizFormDesc("");
      setBizFormType("Sole Proprietor");
      setPartners([]);
      setShareholders([]);
      setRoles([]);
      setAllowFinancialApprovals(false);
      setAuditLogs([]);
      setBizFormLocked(false);
    }
  }, [currentBusinessId, isAddingNewBiz]);

  // 3. Clear sessions and sign out safely
  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await api.auth.logout().catch(() => {});
      await supabase.auth.signOut();
      // The cached /config/features response includes this account's own
      // tier + per-user overrides - clear it so a different account
      // signing in on the same tab never briefly sees the previous
      // session's flags before its own fetch resolves.
      clearCachePrefix("aziiki_cache_features");
      setUser(null);
      setIsGuest(false);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAuthSuccess = async (authInfo: {
    user: any;
    isNewUser: boolean;
    businessName?: string;
    currency?: string;
    seedDemoData?: boolean;
  }) => {
    setUser(authInfo.user);
    setIsGuest(false);
    localStorage.setItem("aziiki_is_guest", "false");
    // Whatever was cached under this key so far (an anonymous/guest
    // fetch's result, most likely) is no longer this account's real
    // flags/tier - clear it so the first post-login fetch is a real one,
    // not skipped as "still fresh" by useCachedResource.
    clearCachePrefix("aziiki_cache_features");

    if (authInfo.isNewUser) {
      const primaryColor = "#2563eb"; // Standard blue
      const newBiz: Business = {
        id: "biz-init-" + Math.random().toString(36).substr(2, 5),
        name: authInfo.businessName || "My Trade Enterprise",
        industry: "Retail & General Logistics",
        logo: "💼",
        primaryColor: primaryColor,
        taxRate: 15,
        currency: authInfo.currency || "GHS",
        description: "Registered standard SME business ledger synced to unifed cloud nodes successfully.",
        businessType: "Sole Proprietor",
        partners: [],
        shareholders: [],
        roles: [],
        allowFinancialApprovals: false,
        auditLogs: []
      };

      let baseBusinesses = [newBiz];
      let baseTransactions: Transaction[] = [];
      let baseCustomers: Customer[] = [];
      let baseInvoices: Invoice[] = [];
      let baseReceipts: Receipt[] = [];
      let baseQuotations: Quotation[] = [];
      let baseInvestments: Investment[] = [];
      let baseAssets: Asset[] = [];
      let baseGoals: Goal[] = [];
      let baseDebts: Debt[] = [];
      let baseInventory: InventoryItem[] = [];

      // Check if there is guest data in localStorage to migrate
      const localGuestDataStr = localStorage.getItem("aziiki_guest_data");
      let hasMigratedGuestData = false;
      if (localGuestDataStr) {
        try {
          const parsed = JSON.parse(localGuestDataStr);
          if (parsed.businesses && parsed.businesses.length > 0) {
            baseBusinesses = parsed.businesses;
            baseTransactions = parsed.transactions || [];
            baseCustomers = parsed.customers || [];
            baseInvoices = parsed.invoices || [];
            baseReceipts = parsed.receipts || [];
            baseQuotations = parsed.quotations || [];
            baseInvestments = parsed.investments || [];
            baseAssets = parsed.assets || [];
            baseGoals = parsed.goals || [];
            baseDebts = parsed.debts || [];
            baseInventory = parsed.inventory || [];
            hasMigratedGuestData = true;
          }
        } catch (e) {
          console.error("Failed to parse guest data for cloud migration:", e);
        }
      }

      if (!hasMigratedGuestData && authInfo.seedDemoData) {
        // Carry over high-quality African operational presets
        baseBusinesses.push({
          id: "biz-nested-1",
          name: "Amina Fashion Couture",
          industry: "Boutique Apparel Design",
          logo: "🪡",
          primaryColor: "#EC4899",
          taxRate: 7.5,
          currency: "NGN",
          description: "Ankara textiles design brand based in Ikeja, Lagos.",
          businessType: "Partnership",
          partners: [
            { id: "p-1", name: "Amina Alao", ownershipPercentage: 60, capitalContribution: 300000, withdrawals: 12000 },
            { id: "p-2", name: "Tunde Coker", ownershipPercentage: 40, capitalContribution: 200000, withdrawals: 8000 }
          ],
          shareholders: [],
          roles: [],
          allowFinancialApprovals: false,
          auditLogs: []
        });

        baseTransactions = [
          { id: "tx-1", date: "2026-06-10", type: "income", category: "Client Project", amount: 4500, description: "Received 50% deposit for photography package", paymentMethod: "Mobile Money", customerId: "cust-1", businessId: newBiz.id },
          { id: "tx-2", date: "2026-06-12", type: "expense", category: "Outsource Help", amount: 800, description: "Hired secondary layout design contractors", paymentMethod: "Cash", businessId: newBiz.id },
          { id: "tx-5", date: "2026-06-14", type: "income", category: "Direct Sales", amount: 650000, description: "Sold 3 pieces bespoke luxury dress outfits", paymentMethod: "Bank Transfer", customerId: "cust-3", businessId: "biz-nested-1" }
        ];

        baseCustomers = [
          { id: "cust-1", name: "Yaw Mensah", email: "yaw@mensah.com", phone: "+233 24 555 1010", notes: "Prefers payments route via Telecel Cash.", category: "Freelance", businessId: newBiz.id, avatarColor: "bg-indigo-500" },
          { id: "cust-3", name: "Chioma Adeleke", email: "chioma@adeleke.ng", phone: "+234 812 555 9000", notes: "Consistently orders bespoke custom patterns.", category: "VIP Partner", businessId: "biz-nested-1", avatarColor: "bg-rose-500" }
        ];

        baseInvoices = [
          { id: "inv-1", invoiceNumber: "INV-2026101", customerId: "cust-1", date: "2026-06-15", dueDate: "2026-06-29", items: [{ description: "Wedding Product package", quantity: 1, rate: 3000 }], discount: 0, taxRate: 15, status: "Sent", partialPaidAmount: 0, businessId: newBiz.id }
        ];

        baseGoals = [
          { id: "goal-1", type: "Equipment", name: "Procure Lens Upgrade", currentAmount: 1800, targetAmount: 4200, deadline: "2026-09-30", businessId: newBiz.id }
        ];

        baseAssets = [
          { id: "asset-seed-1", name: "Pro Studio Flash Lighting Rig", category: "Equipment", purchaseDate: "2025-08-20", purchasePrice: 2200, currentValue: 1850, depreciationMethod: "Straight Line", usefulLifeYears: 5, salvageValue: 400, maintenanceLastDate: "2026-06-01", maintenanceNextDate: "2026-09-01", maintenanceStatus: "Good", maintenanceNotes: "Checked capacitor balance. OK.", documentsNotes: "1-year warranty card with Photostore Ghana.", notes: "Primary lighting asset for portrait sessions.", businessId: newBiz.id }
        ];

        baseInventory = [
          { id: "item-1", name: "SanDisk Extreme Pro 128GB SD Card", sku: "SKU-SD128", quantity: 14, minStockAlert: 5, unitCost: 120, unitPrice: 200, supplierName: "Accra Digital Wholesale", supplierContact: "+233 24 555 1010", businessId: newBiz.id }
        ];
      }

      // Persist the seed/migrated data as real relational rows (each with its
      // own server-issued UUID and business_id foreign key) before it ever
      // touches component state, rather than writing one document blob.
      setIsAuthLoading(true);
      try {
        const persisted = await bulkImportState({
          businesses: baseBusinesses,
          transactions: baseTransactions,
          customers: baseCustomers,
          invoices: baseInvoices,
          receipts: baseReceipts,
          quotations: baseQuotations,
          investments: baseInvestments,
          assets: baseAssets,
          goals: baseGoals,
          debts: baseDebts,
          inventory: baseInventory,
        });

        setBusinesses(persisted.businesses);
        setCurrentBusinessId(persisted.businesses[0].id);
        setTransactions(persisted.transactions);
        setCustomers(persisted.customers);
        setInvoices(persisted.invoices);
        setReceipts(persisted.receipts);
        setQuotations(persisted.quotations);
        setInvestments(persisted.investments);
        setAssets(persisted.assets);
        setGoals(persisted.goals);
        setDebts(persisted.debts);
        setInventory(persisted.inventory);

        // Clear local guest data on successful cloud merge
        localStorage.removeItem("aziiki_guest_data");
      } catch (err) {
        console.error("Failed to initialize this account's workspace:", err);
      } finally {
        setIsAuthLoading(false);
      }
    }
  };

  // Global modifiers handlers passed down to modular interfaces
  // Resolves the "custom-<name>" convention InvoiceReceiptBuilder uses for
  // one-off clients that aren't in the CRM into the {customerId,
  // customClientName} shape the relational schema expects.
  const splitCustomerRef = (customerId?: string): { customerId?: string; customClientName?: string } => {
    if (!customerId) return {};
    if (customerId.startsWith("custom-")) return { customClientName: customerId.slice(7) };
    return { customerId };
  };

  const handleAddTransaction = async (newTx: Transaction) => {
    if (isGuest) {
      setTransactions([newTx, ...transactions]);
      return;
    }
    try {
      const created = await api.transactions.create({
        businessId: newTx.businessId,
        date: newTx.date,
        type: newTx.type,
        category: newTx.category,
        amount: newTx.amount,
        description: newTx.description,
        paymentMethod: newTx.paymentMethod,
        customerId: newTx.customerId,
        proofUri: newTx.proofUri,
        currency: newTx.currency,
        exchangeRateToBusinessCurrency: newTx.exchangeRateToBusinessCurrency,
      });
      setTransactions(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save transaction:", err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    if (!isGuest) {
      try { await api.transactions.remove(id); } catch (err) { console.error("Failed to delete transaction:", err); }
    }
  };

  const handleAddCustomer = async (newCust: Customer): Promise<Customer> => {
    if (isGuest) {
      setCustomers([newCust, ...customers]);
      return newCust;
    }
    if (!isUuid(newCust.businessId)) {
      // Turns a cryptic server-side "Invalid request body" into something
      // the person can actually act on. This happens when the active
      // business hasn't finished being created/synced to the cloud yet -
      // see EMPTY_BUSINESS_PLACEHOLDER and the sync timeout above.
      throw new Error("Your business profile is still syncing to the cloud - please wait a moment and try again.");
    }
    // Deliberately NOT optimistic: CustomerCRM.tsx awaits this and only
    // shows "saved" / clears the form / selects the new customer once the
    // server has actually confirmed it exists. The previous version showed
    // success immediately using a fake local ID before the API call even
    // started, so a failed save (or one whose real server-issued ID didn't
    // match the fake one already selected) looked exactly like "it says
    // saved but I don't see it."
    const created = await api.customers.create({
      businessId: newCust.businessId,
      name: newCust.name,
      email: newCust.email,
      phone: newCust.phone,
      notes: newCust.notes,
      category: newCust.category,
      avatarColor: newCust.avatarColor,
      preferredCurrency: newCust.preferredCurrency,
    });
    setCustomers(prev => [created, ...prev]);
    return created;
  };

  const handleUpdateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    if (isGuest) {
      const updated = { ...customers.find(c => c.id === id), ...updates } as Customer;
      setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
      return updated;
    }
    const updated = await api.customers.update(id, updates);
    setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
    return updated;
  };

  const handleDeleteCustomer = async (id: string) => {
    const previous = customers;
    setCustomers(customers.filter(c => c.id !== id));
    if (!isGuest) {
      try {
        await api.customers.remove(id);
      } catch (err) {
        // Roll back the optimistic removal - a delete that silently failed
        // server-side but still disappeared from the screen is the exact
        // same "looks done but isn't" problem as the save bug above.
        console.error("Failed to delete customer:", err);
        setCustomers(previous);
        throw err;
      }
    }
  };

  // Local, optimistic mirror of what the server's invoices route does
  // server-side (see src/server/routes/invoices.ts runPaidWorkflow) when an
  // invoice is marked Paid: log a matching income transaction and decrement
  // matching warehouse stock. In guest mode this local copy IS the source of
  // truth; when signed in, the server independently persists the same
  // derived records (using the identical calculateInvoiceTotals math), so
  // this function never itself calls the API - that would double them up.
  const triggerInvoicePaidWorkflow = (paidInv: Invoice) => {
    const totals = calculateInvoiceTotals(paidInv.items, paidInv.discount, paidInv.taxRate);

    const newTx: Transaction = {
      id: "tx-inv-auto-paid-" + Math.random().toString(36).substr(2, 9),
      date: paidInv.date || new Date().toISOString().split("T")[0],
      type: "income",
      category: "Sales",
      amount: totals.total,
      description: `Automated Inflow: Settled Invoice ${paidInv.invoiceNumber}`,
      paymentMethod: "Mobile Money",
      customerId: paidInv.customerId,
      businessId: paidInv.businessId
    };

    setTransactions(prev => [newTx, ...prev]);

    // Subtracts the invoiced quantities from Warehouse Stock matching the item name
    setInventory(prevInv => {
      return prevInv.map(stockItem => {
        if (stockItem.businessId !== paidInv.businessId) return stockItem;

        // Find matching item by name (using substring / case-insensitive search)
        const matchedItem = paidInv.items.find(invItem =>
          invItem.description.toLowerCase().trim() === stockItem.name.toLowerCase().trim() ||
          stockItem.name.toLowerCase().trim().includes(invItem.description.toLowerCase().trim()) ||
          invItem.description.toLowerCase().trim().includes(stockItem.name.toLowerCase().trim())
        );

        if (matchedItem) {
          const updatedQty = Math.max(0, stockItem.quantity - matchedItem.quantity);
          return { ...stockItem, quantity: updatedQty };
        }
        return stockItem;
      });
    });
  };

  const handleAddInvoice = async (newInv: Invoice): Promise<Invoice> => {
    if (isGuest) {
      setInvoices([newInv, ...invoices]);
      if (newInv.status === "Paid") triggerInvoicePaidWorkflow(newInv);
      return newInv;
    }
    const { customerId, customClientName } = splitCustomerRef(newInv.customerId);
    const created = await api.invoices.create({
      businessId: newInv.businessId,
      customerId,
      customClientName,
      // Deliberately NOT forwarding newInv.invoiceNumber. That value comes
      // from InvoiceReceiptBuilder's non-reserving /peek preview, shown
      // while the form is still being filled out purely for display - it
      // was never actually reserved. Sending it here would make the
      // server's atomic next_document_number() RPC skip itself entirely
      // (see invoices.ts: "if (!invoiceNumber) { reserve... }"), which is
      // exactly the "two people peek the same number, both submit it"
      // race the numbering system's own design comment warns against.
      // Omitting it forces the server to atomically reserve a number on
      // every single save, no matter what the preview showed.
      date: newInv.date,
      dueDate: newInv.dueDate,
      items: newInv.items,
      discount: newInv.discount,
      taxRate: newInv.taxRate,
      status: newInv.status,
      partialPaidAmount: newInv.partialPaidAmount,
      currency: newInv.currency,
      exchangeRateToBusinessCurrency: newInv.exchangeRateToBusinessCurrency,
    });
    setInvoices(prev => [created, ...prev]);
    if (created.status === "Paid") triggerInvoicePaidWorkflow(created);
    return created;
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, nextStatus: string) => {
    const target = invoices.find(inv => inv.id === invoiceId);
    const shouldTriggerPaidWorkflow = Boolean(target && nextStatus === "Paid" && target.status !== "Paid");

    setInvoices(prev => prev.map(inv => (inv.id === invoiceId ? { ...inv, status: nextStatus as Invoice["status"] } : inv)));
    if (target && shouldTriggerPaidWorkflow) {
      triggerInvoicePaidWorkflow({ ...target, status: nextStatus as Invoice["status"] });
    }

    if (!isGuest) {
      try {
        await api.invoices.update(invoiceId, { status: nextStatus });
      } catch (err) {
        console.error("Failed to update invoice status:", err);
      }
    }
  };

  const handleAddReceipt = async (newRec: Receipt): Promise<Receipt> => {
    if (isGuest) {
      setReceipts([newRec, ...receipts]);
      const resolvedTx: Transaction = {
        id: "tx-auto-" + Math.random().toString(36).substr(2, 9),
        date: newRec.date,
        type: "income",
        category: "Client Project",
        amount: newRec.amountPaid,
        description: newRec.description,
        paymentMethod: newRec.paymentMethod,
        customerId: newRec.customerId,
        businessId: currentBusiness.id
      };
      setTransactions(prev => [resolvedTx, ...prev]);
      return newRec;
    }
    const { customerId, customClientName } = splitCustomerRef(newRec.customerId);
    const created = await api.receipts.create({
      businessId: newRec.businessId,
      customerId,
      customClientName,
      invoiceId: newRec.invoiceId,
      // Not forwarding newRec.receiptNumber - same reasoning as invoices
      // above. The server always atomically reserves via
      // next_document_number() when this is omitted.
      date: newRec.date,
      description: newRec.description,
      amountPaid: newRec.amountPaid,
      paymentMethod: newRec.paymentMethod,
      currency: newRec.currency,
      exchangeRateToBusinessCurrency: newRec.exchangeRateToBusinessCurrency,
    });
    setReceipts(prev => [created, ...prev]);
    // The server already logs the companion income transaction as part of
    // creating the receipt - refresh transactions from it so local state
    // picks up that server-generated row instead of inventing our own.
    const allTransactions = await api.transactions.list();
    setTransactions(allTransactions);
    return created;
  };

  const handleAddQuotation = async (newQuote: Quotation): Promise<Quotation> => {
    if (isGuest) {
      setQuotations([newQuote, ...quotations]);
      return newQuote;
    }
    const { customerId, customClientName } = splitCustomerRef(newQuote.customerId);
    const created = await api.quotations.create({
      businessId: newQuote.businessId,
      customerId,
      customClientName,
      // Not forwarding newQuote.quoteNumber - same reasoning as above.
      date: newQuote.date,
      validUntil: newQuote.validUntil,
      items: newQuote.items,
      discount: newQuote.discount,
      status: newQuote.status,
      currency: newQuote.currency,
      exchangeRateToBusinessCurrency: newQuote.exchangeRateToBusinessCurrency,
    });
    setQuotations(prev => [created, ...prev]);
    return created;
  };

  const handleConvertQuoteToInvoice = async (quoteId: string) => {
    const quote = quotations.find(q => q.id === quoteId);
    if (!quote) return;

    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    if (isGuest) {
      // Guest mode is single-user/local-only, so there's no concurrency to
      // protect against - a locally-computed number is fine here. It is
      // NOT fine for the real (server) path below, which is exactly what
      // changed: that used to compute a number the same way and send it
      // straight through with no atomic reservation at all.
      const newInvNum = `INV-${new Date().getFullYear()}${invoices.length + 101}`;
      const newInv: Invoice = {
        id: "inv-conv-" + Math.random().toString(36).substr(2, 9),
        invoiceNumber: newInvNum,
        customerId: quote.customerId,
        date: new Date().toISOString().split("T")[0],
        dueDate,
        items: quote.items,
        discount: quote.discount,
        taxRate: currentBusiness.taxRate,
        status: "Draft",
        partialPaidAmount: 0,
        businessId: currentBusiness.id
      };
      setInvoices([newInv, ...invoices]);
      setQuotations(quotations.map(q => q.id === quoteId ? { ...q, status: "Converted" } : q));
      return;
    }

    try {
      // No invoiceNumber sent - the server always atomically reserves one
      // via next_document_number() now (see quotations.ts). Previously a
      // hardcoded-year, array-length-based number was computed here and
      // sent directly, bypassing duplicate prevention entirely.
      const invoice = await api.quotations.convertToInvoice(quoteId, {
        dueDate,
        taxRate: currentBusiness.taxRate,
      });
      setInvoices(prev => [invoice, ...prev]);
      setQuotations(prev => prev.map(q => (q.id === quoteId ? { ...q, status: "Converted" } : q)));
    } catch (err) {
      console.error("Failed to convert quotation to invoice:", err);
      // Rethrown rather than swallowed - the caller (InvoiceReceiptBuilder's
      // "Convert to Invoice" button) awaits this and only shows a success
      // toast / switches to the new invoice if it actually resolves.
      throw err;
    }
  };

  const handleAddInvestment = async (newInv: Investment) => {
    if (isGuest) {
      setInvestments([newInv, ...investments]);
      return;
    }
    try {
      const created = await api.investments.create({
        businessId: newInv.businessId,
        type: newInv.type,
        name: newInv.name,
        institution: newInv.institution,
        value: newInv.value,
        amountInvested: newInv.amountInvested,
        maturityDate: newInv.maturityDate,
        expectedReturnRate: newInv.expectedReturnRate,
        dateAcquired: newInv.dateAcquired,
        notes: newInv.notes,
      });
      setInvestments(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save investment:", err);
    }
  };

  const handleAddGoal = async (newGoal: Goal) => {
    if (isGuest) {
      setGoals([newGoal, ...goals]);
      return;
    }
    try {
      const created = await api.goals.create({
        businessId: newGoal.businessId,
        type: newGoal.type,
        name: newGoal.name,
        currentAmount: newGoal.currentAmount,
        targetAmount: newGoal.targetAmount,
        deadline: newGoal.deadline,
        currency: newGoal.currency,
      });
      setGoals(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save goal:", err);
    }
  };

  const handleContributeToGoal = async (goalId: string, amount: number, currency?: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    if (isGuest) {
      // Guest mode has no exchange-rate infrastructure to convert against,
      // so a contribution currency other than the goal's own just adds the
      // raw amount - the same "no rate yet" fallback the real backend uses.
      const newTx: Transaction = {
        id: "tx-contribution-" + Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split("T")[0],
        type: "expense",
        category: "Operations Cost",
        amount: amount,
        description: `Savings goal contribution: ${goal.name}`,
        paymentMethod: "Cash",
        businessId: currentBusiness.id,
        currency: currency ?? goal.currency,
      };
      setTransactions([newTx, ...transactions]);
      setGoals(goals.map(g => (g.id === goalId ? { ...g, currentAmount: addMoney(g.currentAmount, amount) } : g)));
      return;
    }

    try {
      const updatedGoal = await api.goals.contribute(goalId, amount, currency);
      setGoals(prev => prev.map(g => (g.id === goalId ? updatedGoal : g)));
      const allTransactions = await api.transactions.list();
      setTransactions(allTransactions);
    } catch (err) {
      console.error("Failed to contribute to goal:", err);
    }
  };

  const handleRestoreBackup = (backup: {
    transactions?: Transaction[];
    customers?: Customer[];
    invoices?: Invoice[];
    goals?: Goal[];
    investments?: Investment[];
    debts?: Debt[];
    inventory?: InventoryItem[];
  }) => {
    if (backup.transactions) setTransactions(backup.transactions);
    if (backup.customers) setCustomers(backup.customers);
    if (backup.invoices) setInvoices(backup.invoices);
    if (backup.goals) setGoals(backup.goals);
    if (backup.investments) setInvestments(backup.investments);
    if (backup.debts) setDebts(backup.debts);
    if (backup.inventory) setInventory(backup.inventory);
  };

  const handleAddDebt = async (newDebt: Debt) => {
    if (isGuest) {
      setDebts([newDebt, ...debts]);
      return;
    }
    try {
      const created = await api.debts.create({
        businessId: newDebt.businessId,
        creditor: newDebt.creditor,
        amount: newDebt.amount,
        interestRate: newDebt.interestRate,
        dueDate: newDebt.dueDate,
        type: newDebt.type,
        currency: newDebt.currency,
      });
      setDebts(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save debt:", err);
    }
  };

  const handleAddInventoryItem = async (newItem: InventoryItem): Promise<InventoryItem> => {
    if (isGuest) {
      setInventory([newItem, ...inventory]);
      return newItem;
    }
    if (!isUuid(newItem.businessId)) {
      throw new Error("Your business profile is still syncing to the cloud - please wait a moment and try again.");
    }
    const created = await api.inventory.create({
      businessId: newItem.businessId,
      name: newItem.name,
      sku: newItem.sku,
      quantity: newItem.quantity,
      minStockAlert: newItem.minStockAlert,
      unitCost: newItem.unitCost,
      unitPrice: newItem.unitPrice,
      supplierName: newItem.supplierName,
      supplierContact: newItem.supplierContact,
    });
    setInventory(prev => [created, ...prev]);
    return created;
  };

  const handleUpdateInventoryItem = async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    if (isGuest) {
      const updated = { ...inventory.find(i => i.id === id), ...updates } as InventoryItem;
      setInventory(prev => prev.map(i => (i.id === id ? updated : i)));
      return updated;
    }
    const updated = await api.inventory.update(id, updates);
    setInventory(prev => prev.map(i => (i.id === id ? updated : i)));
    return updated;
  };

  const handleDeleteInventoryItem = async (id: string) => {
    const previous = inventory;
    setInventory(inventory.filter(i => i.id !== id));
    if (!isGuest) {
      try {
        await api.inventory.remove(id);
      } catch (err) {
        console.error("Failed to delete inventory item:", err);
        setInventory(previous);
        throw err;
      }
    }
  };

  const handleDeleteDebt = async (id: string) => {
    setDebts(debts.filter(d => d.id !== id));
    if (!isGuest) {
      try { await api.debts.remove(id); } catch (err) { console.error("Failed to delete debt:", err); }
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
    if (!isGuest) {
      try { await api.goals.remove(id); } catch (err) { console.error("Failed to delete goal:", err); }
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    setInvestments(investments.filter(i => i.id !== id));
    if (!isGuest) {
      try { await api.investments.remove(id); } catch (err) { console.error("Failed to delete investment:", err); }
    }
  };

  const handleAddAsset = async (newAsset: Asset) => {
    if (isGuest) {
      setAssets([newAsset, ...assets]);
      return;
    }
    try {
      const created = await api.assets.create({
        businessId: newAsset.businessId,
        name: newAsset.name,
        category: newAsset.category,
        purchaseDate: newAsset.purchaseDate,
        purchasePrice: newAsset.purchasePrice,
        currentValue: newAsset.currentValue,
        depreciationMethod: newAsset.depreciationMethod,
        usefulLifeYears: newAsset.usefulLifeYears,
        salvageValue: newAsset.salvageValue,
        maintenanceLastDate: newAsset.maintenanceLastDate,
        maintenanceNextDate: newAsset.maintenanceNextDate,
        maintenanceStatus: newAsset.maintenanceStatus,
        maintenanceNotes: newAsset.maintenanceNotes,
        documentsNotes: newAsset.documentsNotes,
        notes: newAsset.notes,
      });
      setAssets(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save asset:", err);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
    if (!isGuest) {
      try { await api.assets.remove(id); } catch (err) { console.error("Failed to delete asset:", err); }
    }
  };

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    setAssets(assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    if (!isGuest) {
      try {
        await api.assets.update(updatedAsset.id, {
          name: updatedAsset.name,
          category: updatedAsset.category,
          purchaseDate: updatedAsset.purchaseDate,
          purchasePrice: updatedAsset.purchasePrice,
          currentValue: updatedAsset.currentValue,
          depreciationMethod: updatedAsset.depreciationMethod,
          usefulLifeYears: updatedAsset.usefulLifeYears,
          salvageValue: updatedAsset.salvageValue,
          maintenanceLastDate: updatedAsset.maintenanceLastDate,
          maintenanceNextDate: updatedAsset.maintenanceNextDate,
          maintenanceStatus: updatedAsset.maintenanceStatus,
          maintenanceNotes: updatedAsset.maintenanceNotes,
          documentsNotes: updatedAsset.documentsNotes,
          notes: updatedAsset.notes,
        });
      } catch (err) {
        console.error("Failed to update asset:", err);
      }
    }
  };

  const handleRepayDebt = async (debtId: string, amount: number, paymentMethodName: string) => {
    if (isGuest) {
      setDebts(debts.map(d => {
        if (d.id === debtId) {
          return { ...d, amount: Math.max(0, subtractMoney(d.amount, amount)) };
        }
        return d;
      }).filter(d => d.amount > 0));
      return;
    }
    try {
      const result = await api.debts.repay(debtId, amount);
      if (result.settled) {
        setDebts(prev => prev.filter(d => d.id !== debtId));
      } else {
        setDebts(prev => prev.map(d => (d.id === debtId ? result.data : d)));
      }
    } catch (err) {
      console.error("Failed to repay debt:", err);
    }
  };

  const handleUpdateBusiness = async (updatedBiz: Business) => {
    const previous = businesses;
    setBusinesses(businesses.map(b => b.id === updatedBiz.id ? updatedBiz : b));
    if (!isGuest) {
      await api.businesses.update(updatedBiz.id, {
        name: updatedBiz.name,
        industry: updatedBiz.industry,
        logo: updatedBiz.logo,
        primaryColor: updatedBiz.primaryColor,
        taxRate: updatedBiz.taxRate,
        currency: updatedBiz.currency,
        description: updatedBiz.description,
        businessType: updatedBiz.businessType,
        allowFinancialApprovals: updatedBiz.allowFinancialApprovals,
        locked: updatedBiz.locked,
        countryCode: updatedBiz.countryCode,
        timezone: updatedBiz.timezone,
      }).catch((err) => {
        // Roll back the optimistic update and let the caller (the brand
        // config form) show this to the person - previously this was
        // console.error only, so "Apply Brand Changes" would appear to
        // succeed (the modal closes either way) even when the server
        // rejected it.
        setBusinesses(previous);
        throw err;
      });
    }
  };

  const handleCreatePersonalWorkspace = async (name: string, currency: string) => {
    const localId = "pers-" + Math.random().toString(36).substr(2, 5);
    const accountSeeds = [
      { id: "acc-momo-" + Date.now(), name: "My MTN MoMo Wallet", type: "MTN Mobile Money" as const, initialBalance: 1500, balance: 1500 },
      { id: "acc-cash-" + Date.now(), name: "Cash Wallet", type: "Cash Wallet" as const, initialBalance: 300, balance: 300 },
      { id: "acc-bank-" + Date.now(), name: "Sovereign Savings Bank", type: "Savings Account" as const, initialBalance: 5000, balance: 5000 }
    ];
    const budgetSeeds = [
      { category: "Food", limitAmount: 600 },
      { category: "Transport", limitAmount: 300 },
      { category: "Rent", limitAmount: 1200 },
      { category: "Utilities", limitAmount: 200 },
      { category: "Entertainment", limitAmount: 150 }
    ];

    if (isGuest) {
      const newBiz: Business = {
        id: localId,
        name: name || "My Personal Finances",
        industry: "Personal Finance",
        logo: "👤",
        primaryColor: "#10b981",
        taxRate: 0,
        currency: currency || "USD",
        description: "Permanently Free Personal Wallet.",
        isPersonal: true,
        accounts: accountSeeds,
        budgets: budgetSeeds
      };
      setBusinesses([...businesses, newBiz]);
      setCurrentBusinessId(localId);
      setShowBrandConfig(false);
      setIsAddingNewBiz(false);
      setActiveTab("dashboard");
      return;
    }

    try {
      const createdBiz = await api.businesses.create({
        name: name || "My Personal Finances",
        industry: "Personal Finance",
        logo: "👤",
        primaryColor: "#10b981",
        taxRate: 0,
        currency: currency || "USD",
        description: "Permanently Free Personal Wallet.",
        isPersonal: true,
      });

      const createdAccounts = await Promise.all(
        accountSeeds.map(seed =>
          api.personalAccounts.create({ businessId: createdBiz.id, name: seed.name, type: seed.type, initialBalance: seed.initialBalance, balance: seed.balance })
        )
      );
      const createdBudgets = await Promise.all(
        budgetSeeds.map(seed =>
          api.personalBudgets.create({ businessId: createdBiz.id, category: seed.category, limitAmount: seed.limitAmount })
        )
      );

      setBusinesses([...businesses, { ...createdBiz, accounts: createdAccounts, budgets: createdBudgets }]);
      setCurrentBusinessId(createdBiz.id);
      setShowBrandConfig(false);
      setIsAddingNewBiz(false);
      setActiveTab("dashboard");
    } catch (err) {
      console.error("Failed to create personal workspace:", err);
    }
  };

  const handleStockAdjustment = async (id: string, delta: number) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }));
    if (!isGuest) {
      try {
        const updated = await api.inventory.adjust(id, delta);
        setInventory(prev => prev.map(item => (item.id === id ? updated : item)));
      } catch (err) {
        console.error("Failed to adjust stock:", err);
      }
    }
  };

  // Modern Brand Profile updates
  const handleUpdateActiveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandFormError(null);
    if (!bizFormName.trim()) {
      setBrandFormError("Business name can't be empty.");
      return;
    }
    const existing = businesses.find(b => b.id === currentBusinessId);
    if (!existing) {
      // This is the exact silent-failure case that made "Apply Brand
      // Changes" look like it did nothing: there was no business in
      // `businesses` at all for currentBusinessId to match (root cause is
      // almost always the sync failure surfaced by criticalSyncError
      // above), so this returned with zero feedback before. Now it says
      // so directly instead of doing nothing.
      setBrandFormError("No active business found to update - your workspace may still be syncing. Please wait a moment or use Retry above, then try again.");
      return;
    }

    let newLogs = existing.auditLogs || [];
    if (bizFormType === "Company") {
      const actionLog: AuditLog = {
        id: "a-custom-" + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        userName: "Active Admin",
        action: "Configuration Updated",
        details: `Updated enterprise settings for ${bizFormName.trim()}.`
      };
      newLogs = [actionLog, ...newLogs];
    }

    const updatedBiz: Business = {
      ...existing,
      name: bizFormName.trim(),
      industry: bizFormIndustry.trim() || "General SME Services",
      currency: bizFormCurrency,
      countryCode: bizFormCountryCode || undefined,
      timezone: bizFormTimezone || undefined,
      taxRate: Number(bizFormTaxRate) || 0,
      logo: bizFormLogo,
      description: bizFormDesc.trim() || "West African compliant SME workspace.",
      businessType: bizFormType,
      partners: bizFormType === "Partnership" ? partners : [],
      shareholders: bizFormType === "Company" ? shareholders : [],
      roles: bizFormType === "Company" ? roles : [],
      allowFinancialApprovals: bizFormType === "Company" ? allowFinancialApprovals : false,
      auditLogs: bizFormType === "Company" ? newLogs : [],
      locked: bizFormLocked
    };

    setIsSavingBrand(true);
    try {
      // handleUpdateBusiness both updates local state and persists the core
      // business fields via the API (nested partners/shareholders/roles/audit
      // logs stay local-only for now - see PR notes). Awaited and wrapped
      // here so a rejection is shown, not silently swallowed - previously
      // the modal closed regardless of whether the save actually worked.
      await handleUpdateBusiness(updatedBiz);
      setShowBrandConfig(false);
    } catch (err) {
      setBrandFormError(err instanceof Error ? err.message : "Couldn't save these changes. Please try again.");
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleRegisterNewBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandFormError(null);
    if (!bizFormName.trim()) {
      setBrandFormError("Business name can't be empty.");
      return;
    }
    if (isPersonalForm) {
      await handleCreatePersonalWorkspace(bizFormName, bizFormCurrency);
      setIsPersonalForm(false);
      return;
    }
    let initialLogs: AuditLog[] = [];
    if (bizFormType === "Company") {
      initialLogs = [
        {
          id: "a-init",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          userName: "Owner Admin",
          action: "Company Registered",
          details: `Registered company profile under name ${bizFormName.trim()}.`
        }
      ];
    }

    const commonFields = {
      name: bizFormName.trim(),
      industry: bizFormIndustry.trim() || "General SME Services",
      currency: bizFormCurrency,
      countryCode: bizFormCountryCode || undefined,
      timezone: bizFormTimezone || undefined,
      taxRate: Number(bizFormTaxRate) || 0,
      logo: bizFormLogo,
      primaryColor: "#2563eb",
      description: bizFormDesc.trim() || "West African compliant SME workspace.",
      businessType: bizFormType,
      allowFinancialApprovals: bizFormType === "Company" ? allowFinancialApprovals : false,
      locked: bizFormLocked,
    };

    if (isGuest) {
      const newBiz: Business = {
        id: "biz-custom-" + Math.random().toString(36).substr(2, 5),
        ...commonFields,
        partners: bizFormType === "Partnership" ? partners : [],
        shareholders: bizFormType === "Company" ? shareholders : [],
        roles: bizFormType === "Company" ? roles : [],
        auditLogs: bizFormType === "Company" ? initialLogs : [],
      };
      setBusinesses([...businesses, newBiz]);
      setCurrentBusinessId(newBiz.id);
      setIsAddingNewBiz(false);
      setShowBrandConfig(false);
      return;
    }

    setIsSavingBrand(true);
    try {
      const created = await api.businesses.create(commonFields);
      const newBiz: Business = {
        ...created,
        partners: bizFormType === "Partnership" ? partners : [],
        shareholders: bizFormType === "Company" ? shareholders : [],
        roles: bizFormType === "Company" ? roles : [],
        auditLogs: bizFormType === "Company" ? initialLogs : [],
      };
      setBusinesses([...businesses, newBiz]);
      setCurrentBusinessId(newBiz.id);
      setIsAddingNewBiz(false);
      setShowBrandConfig(false);
    } catch (err) {
      console.error("Failed to register business:", err);
      setBrandFormError(err instanceof Error ? err.message : "Couldn't create this business. Please try again.");
    } finally {
      setIsSavingBrand(false);
    }
  };

  // Real, locale-correct currency symbol via Intl (src/lib/currency.ts) -
  // replaces a hardcoded switch that only recognized GHS/NGN/KES and
  // silently fell back to "$" for every other currency, including ones
  // (USD/EUR/GBP/CAD) this app already claims to support elsewhere.
  const currencySymbol = getCurrencySymbol(currentBusiness.currency);

  // Calculated top-level cash parameters
  const getAvailableCash = () => {
    const plus = transactions
      .filter(t => t.type === "income" && t.businessId === currentBusiness.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const minus = transactions
      .filter(t => t.type === "expense" && t.businessId === currentBusiness.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return Math.max(200, plus - minus); // fallback default
  };

  const availableCash = getAvailableCash();

  // isAuthLoading itself flips the instant Supabase resolves the session
  // check (often from a warm local cache, in well under a frame) - showing
  // the loading screen for that raw duration is what caused it to flash on
  // every page load. This only holds the *visual* gate a little longer; it
  // never delays isAuthLoading itself or anything that depends on it.
  const showAuthLoadingScreenRaw = useMinimumLoadingTime(isAuthLoading, 550);
  // Sync ("SME Ledger Node") keeps running in the background exactly as
  // before, however long it actually takes on a slow connection - this
  // only caps how long it's allowed to block the person from seeing the
  // app at all. After 3 seconds they're let in; whatever the fetch was
  // doing finishes on its own and populates the UI the moment it resolves.
  const syncTimedOut = useLoadingTimedOut(isAuthLoading, 3000);
  const showAuthLoadingScreen = showAuthLoadingScreenRaw && !syncTimedOut;

  // Checked before anything else, including the auth/sync gate below - an
  // unrecognized path has nothing to do with login state.
  if (isUnknownPath) {
    return <NotFoundPage onGoHome={() => { window.location.href = "/"; }} />;
  }

  if (showAuthLoadingScreen) {
    return <SkeletonAppShell />;
  }

  // Both screens below are lazy-loaded (see the imports at the top of this
  // file) - a returning, already-signed-in user never downloads either one
  // again after their first session, so this fallback only ever shows
  // briefly on a first visit or a slow connection.
  const fullScreenFallback = (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto animate-spin border border-emerald-200">
          <ArrowsClockwise className="w-6 h-6" weight="bold" />
        </div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest font-mono">Loading Aziiki</h3>
      </div>
    </div>
  );

  // First-time visitors see the Ask -> Aha -> Commit onboarding flow before
  // ever hitting the sign-in screen. Returning users (an existing session,
  // guest mode already chosen, or a password-recovery link) skip straight
  // past it - onboarding only ever runs once, tracked via localStorage.
  if (showOnboarding && !user && !isGuest && !needsPasswordRecovery) {
    return (
      <Suspense fallback={fullScreenFallback}>
        <OnboardingFlow
          onFinish={({ prefillEmail }) => {
            if (prefillEmail) setOnboardingPrefillEmail(prefillEmail);
            setShowOnboarding(false);
          }}
        />
      </Suspense>
    );
  }

  if (needsPasswordRecovery || (!user && !isGuest)) {
    if (showPrivacyPolicy) {
      return (
        <Suspense fallback={fullScreenFallback}>
          <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={fullScreenFallback}>
        <AuthPortal
          onAuthSuccess={(info) => {
            setNeedsPasswordRecovery(false);
            handleAuthSuccess(info);
          }}
          onEnterGuest={() => setIsGuest(true)}
          recoveryMode={needsPasswordRecovery}
          linkErrorMessage={authLinkError}
          onDismissLinkError={() => setAuthLinkError(null)}
          prefillEmail={onboardingPrefillEmail}
          initialTab={onboardingPrefillEmail ? "create" : undefined}
          onShowPrivacyPolicy={() => setShowPrivacyPolicy(true)}
        />
      </Suspense>
    );
  }

  // Legal pages, reachable from the Footer / Help & Support while signed
  // in too, not just pre-login - full-screen overlay over the whole app,
  // same as the pre-login PrivacyPolicy render above.
  if (showPrivacyPolicy) {
    return (
      <Suspense fallback={fullScreenFallback}>
        <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} />
      </Suspense>
    );
  }
  if (showTermsOfService) {
    return (
      <Suspense fallback={fullScreenFallback}>
        <LegalTextPage title="Terms of Service" settingKey="legal_terms_of_service" onBack={() => setShowTermsOfService(false)} />
      </Suspense>
    );
  }
  if (showRefundPolicy) {
    return (
      <Suspense fallback={fullScreenFallback}>
        <LegalTextPage title="Refund Policy" settingKey="legal_refund_policy" onBack={() => setShowRefundPolicy(false)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans selection:bg-brand-navy/15 transition-colors duration-200">

      {/* Invisible until focused (Tab) - lets keyboard/screen-reader users
          jump straight past the sidebar nav to the actual page content,
          instead of tabbing through every nav item on every page load. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-brand-navy focus:text-white focus:text-xs focus:font-bold focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Sticky Left Navigation Sidebar */}
      <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 sticky top-0 z-50 p-4 md:p-6 flex flex-col justify-between md:h-screen md:overflow-y-auto gap-4 shadow-sm transition-colors duration-200 md:shrink-0" id="sidebar-navigation">
        
        {/* Logo and Switcher combo */}
        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-center gap-3">
            <BrandLogo size={36} className="shadow-md rounded-xl" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black tracking-tighter flex items-center gap-1.5 font-sans text-slate-900">
                Aziiki
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-sans font-medium">Your Business. Organized.</p>
            </div>
            {/* Mobile only - collapses the profile switcher + account widget
                below so they stop permanently occupying screen space while
                scrolling (see sidebarCollapsed above). Desktop's sidebar is
                a true side column, not an overlay, so it has no such button. */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Expand profile panel" : "Collapse profile panel"}
              aria-expanded={!sidebarCollapsed}
              className="md:hidden shrink-0 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
            >
              {sidebarCollapsed ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
            </button>
          </div>

          <div className={`${sidebarCollapsed ? "hidden md:flex" : "flex"} flex-col gap-4`}>
          <div className="h-px w-full bg-slate-200"></div>

          {/* Active Business select dropdown switcher */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              <Building2 className="w-3.5 h-3.5" />
              <span>Enterprise Profile</span>
            </div>
            <div className="flex items-center gap-2">
              {isImageLogo(currentBusiness?.logo) && (
                <img
                  src={currentBusiness!.logo}
                  alt={`${currentBusiness!.name} logo`}
                  className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 shrink-0"
                />
              )}
              <select
                id="global-business-switcher"
                value={currentBusinessId}
                onChange={(e) => {
                  const targetVal = e.target.value;
                  setCurrentBusinessId(targetVal);
                  setIsAddingNewBiz(false);
                }}
                className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans font-bold cursor-pointer"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id} className="">
                    {/* Only prepend the glyph for businesses using a plain
                        emoji logo. For businesses with a real uploaded
                        image logo, the actual <img> avatar is already
                        shown to the left of this dropdown - prepending
                        businessLogoGlyph()'s fallback initial here too
                        (e.g. "E") produced a redundant, unexplained stray
                        letter next to the real logo, which is exactly what
                        was reported: "E EKO PIXELS (GHS)" instead of just
                        "EKO PIXELS (GHS)". */}
                    {isImageLogo(b.logo) ? b.name : `${businessLogoGlyph(b)} ${b.name}`} ({b.currency})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-1.5 mt-1">
              <button
                onClick={() => {
                  setIsAddingNewBiz(false);
                  setShowBrandConfig(!showBrandConfig);
                  setBrandFormError(null);
                }}
                className={`flex-1 p-2 border rounded-xl transition-all cursor-pointer text-[10.5px] font-bold font-sans flex items-center justify-center gap-1 ${
 showBrandConfig && !isAddingNewBiz
 ? "bg-slate-800 text-white border-slate-700 shadow-sm"
 : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
 }`}
                title="Change active enterprise details"
              >
                <span className="flex items-center gap-1">
                  {currentBusiness?.locked ? (<><Lock className="w-3 h-3" /> Locked</>) : (<><GearSix className="w-3 h-3" /> Edit</>)}
                </span>
              </button>
              {/* Adding a second+ business: off by default in Phase 1 per the product teardown ("Multi-Business Profiles" is a v1.1 problem), code preserved. Toggle via admin portal -> multi_business_profiles. */}
              {isEnabled("multi_business_profiles") && (
              <button
                onClick={() => {
                  setIsAddingNewBiz(true);
                  setShowBrandConfig(true);
                  setBrandFormError(null);
                }}
                className="p-2 px-3 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer text-[10.5px] font-bold font-sans flex items-center justify-center gap-1 shrink-0"
                title="Register another company profile"
              >
                <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> New</span>
              </button>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* Separator line for desktop */}
        <div className="h-px w-full bg-slate-200 hidden md:block"></div>

        {/* Workspace Tab Navigators section */}
        <div className="flex flex-col gap-2 my-2 text-left shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5 hidden md:block">
            Workspace Panels
          </div>
          
          {/* Desktop-only: the sidebar list below. Small screens use the fixed
              bottom MobileNavBar instead (rendered once, near the end of this
              component) - the old approach (this same list horizontally
              scrolling on mobile) had no visual hint it was scrollable, so it
              just looked like navigation was missing after the first 2-3 items. */}
          <nav className="hidden md:flex md:flex-col items-center md:items-stretch gap-1.5 md:overflow-x-visible pb-2 md:pb-0 text-xs">
            {/* Every Phase 1 "core" screen below is now flag-gated too (migration 0044) - defaults on, but can be switched off from the admin portal like any other feature. */}
            {isEnabled("core_dashboard") && (
            <button
              id="tab-dashboard-btn"
              onClick={() => changeTab("dashboard")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "dashboard"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Layers2 className="w-4 h-4 shrink-0" /> Scorecard
            </button>
            )}

            {isEnabled("core_billing") && (
            <button
              id="tab-billing-btn"
              onClick={() => changeTab("billing")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "billing"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Coins className="w-4 h-4 shrink-0" /> Billing & PDFs
            </button>
            )}

            {isEnabled("core_customers") && (
            <button
              id="tab-crm-btn"
              onClick={() => changeTab("crm")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "crm"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Users className="w-4 h-4 shrink-0" /> Customer CRM
            </button>
            )}

            {/* Wealth & Goals: off by default in Phase 1, code preserved. Toggle via admin portal -> net_worth_investments. */}
            {isEnabled("net_worth_investments") && (
            <button
              id="tab-wealth-btn"
              onClick={() => changeTab("wealth")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "wealth"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Target className="w-4 h-4 shrink-0" /> Wealth & Goals
            </button>
            )}

            {/* Warehouse Stock: off by default in Phase 1 per the product teardown (Phase 2 - "Inventory Management"), code preserved. Toggle via admin portal -> inventory_management. */}
            {isEnabled("inventory_management") && (
            <button
              id="tab-stock-btn"
              onClick={() => changeTab("stock")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "stock"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Warehouse className="w-4 h-4 shrink-0" /> Warehouse Stock
            </button>
            )}

            {/* Purchase Orders / Team / Exchange Rates: each its own screen now (moved out of the Billing builder's cramped sub-tab strip). Off by default in Phase 1, code preserved. Toggle via admin portal. */}
            {isEnabled("purchase_orders") && (
            <button
              id="tab-purchaseOrders-btn"
              onClick={() => changeTab("purchaseOrders")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "purchaseOrders"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Package className="w-4 h-4 shrink-0" /> Purchase Orders
            </button>
            )}

            {isEnabled("team_memberships_invite_ui") && (
            <button
              id="tab-team-btn"
              onClick={() => changeTab("team")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "team"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <UsersThree className="w-4 h-4 shrink-0" /> Team
            </button>
            )}

            {isEnabled("core_reports") && (
            <button
              id="tab-reports-btn"
              onClick={() => changeTab("reports")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "reports"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <LineChart className="w-4 h-4 shrink-0" /> Reports & Wisdom
            </button>
            )}

            {isEnabled("core_ai_advisor") && (
            <button
              id="tab-ai-btn"
              onClick={() => changeTab("ai")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 border md:w-full md:justify-start ${
 activeTab === "ai"
 ? "bg-brand-navy text-white border-brand-navy font-bold"
 : "text-brand-teal bg-teal-50/70 hover:bg-teal-100/60 border-teal-100"
 }`}
            >
              <BrainCircuit className="w-4 h-4 shrink-0 animate-pulse text-brand-teal" /> CFO AI Advisor
            </button>
            )}

            {/* Updates & Growth (ad monetization hub): off by default in Phase 1, code preserved. Toggle via admin portal -> ad_monetization_hub. */}
            {isEnabled("ad_monetization_hub") && (
            <button
              id="tab-monetize-btn"
              onClick={() => changeTab("monetize")}
              className={`px-4 py-2.5 rounded-xl font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 border md:w-full md:justify-start ${
 activeTab === "monetize"
 ? "bg-brand-navy text-white border-brand-navy font-bold"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 text-brand-teal" /> Updates & Growth
            </button>
            )}

            {isEnabled("core_app_guide") && (
            <button
              id="tab-guide-btn"
              onClick={() => changeTab("guide")}
              className={`px-4 py-2.5 rounded-xl font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 border md:w-full md:justify-start ${
 activeTab === "guide"
 ? "bg-slate-800 text-white border-slate-700 font-bold"
 : "text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 border-indigo-150 font-bold"
 }`}
            >
              <BookOpen className="w-4 h-4 shrink-0 text-indigo-600" /> App Guide & Academy
            </button>
            )}

            {isEnabled("core_help_support") && (
            <button
              id="tab-helpSupport-btn"
              onClick={() => changeTab("helpSupport")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "helpSupport"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" /> Help & Support
            </button>
            )}

            {isEnabled("core_settings") && (
            <button
              id="tab-settings-btn"
              onClick={() => changeTab("settings")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "settings"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <GearSix className="w-4 h-4 shrink-0" /> Settings
            </button>
            )}
          </nav>
        </div>

        {/* User Container Footer Section */}
        <div className={`${sidebarCollapsed ? "hidden md:flex" : "flex"} md:flex-col items-center md:items-stretch gap-2.5 mt-auto pt-3 border-t border-slate-100`}>
          
          {/* User Account Central State Indicator - the signed-in account
              email/avatar card is desktop/tablet only now (hidden md:flex);
              it's shown instead in MobileNavBar's "More" sheet, alongside
              sign-out, so the mobile header stays uncluttered. Guest mode's
              "Sync" prompt stays visible on mobile too, since it's a real
              call-to-action (not account info) and has no other mobile
              entry point. */}
          {user ? (
            <div className="hidden md:flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2.5 w-full transition-colors duration-200 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-brand-teal text-white text-xs font-black flex items-center justify-center shadow-md shadow-brand-navy/10 uppercase shrink-0">
                  {user.email?.[0] ?? "U"}
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[10px] font-bold text-slate-800 truncate max-w-[110px]" title={user.email ?? "Signed in"}>
                    {user.email ?? "Signed in"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out of SME Cloud"
                className="flex p-1.5 hover:bg-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2.5 w-full transition-colors duration-200 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-brand-teal text-white text-xs font-black flex items-center justify-center shadow-md shadow-brand-navy/10 uppercase shrink-0">
                  G
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[10px] font-bold text-slate-800 truncate max-w-[110px]" title="Guest Session">
                    Guest Session
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsGuest(false);
                  setUser(null);
                }}
                className="text-[9px] font-bold text-emerald-600 hover:underline cursor-pointer bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 shrink-0"
              >
                Sync
              </button>
            </div>
          )}

          {/* Plan badge + upgrade link. Basic/Standard/Pro is per-account
              (see useFeatureFlags' `tier`), not per-business - a paid
              Payment Page click here is the only way a user unlocks
              Standard/Pro themselves; Paystack's webhook applies the
              upgrade automatically once the payment clears (no manual
              step from the admin). Hidden on mobile/tablet - shown in
              MobileNavBar's "More" sheet instead, as the last item there. */}
          {user && (
            <div className="hidden md:flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2.5 w-full text-left">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-mono text-slate-450 uppercase tracking-widest">Plan</span>
                <span className="text-[11px] font-bold text-slate-800 capitalize">{tier}</span>
              </div>
              {upgradeUrl && (
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-bold text-emerald-600 hover:underline cursor-pointer bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 shrink-0 capitalize"
                >
                  Upgrade to {nextTier}
                </a>
              )}
            </div>
          )}
        </div>

      </aside>

      {/* Main Workspace Frame container */}
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-7xl mx-auto w-full animate-fade-in focus:outline-none">
        
        {/* Critical sync failure banner - shown whenever the workspace
            failed to load or create a business at all (see the catch
            block in the [user] effect above). Deliberately loud and
            persistent rather than a toast that disappears, because every
            other action in the app (saving a customer, a stock item,
            brand changes) silently can't work at all while this is true -
            there's no business for any of it to attach to. */}
        {criticalSyncError && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="text-rose-500 shrink-0 mt-0.5"><AlertCircle className="w-5 h-5" /></span>
              <div>
                <p className="font-bold text-rose-800">Your workspace couldn't be loaded</p>
                <p className="text-rose-600 text-xs mt-0.5">{criticalSyncError}</p>
                <p className="text-rose-500 text-[11px] mt-1">Nothing can be saved (customers, stock, brand changes) until this is resolved.</p>
              </div>
            </div>
            <button
              onClick={() => setSyncRetryCount((n) => n + 1)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Aziiki Launch Edition Welcome Banner */}
        {!launchBannerDismissed && (
        <div className="mb-6 bg-brand-teal border border-brand-teal rounded-2xl p-4 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in" id="launch-edition-promotion-banner">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 p-1.5">
              <BrandLogo size={28} className="rounded-lg" />
            </div>
            <div className="space-y-0.5 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-mono font-bold bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Launch Edition
                </span>
                <h4 className="text-xs sm:text-sm font-black tracking-tight text-white">
                  Welcome to Aziiki Launch Edition
                </h4>
              </div>
              <p className="text-[11px] text-white font-light">
                Track income and expenses, send professional invoices and receipts, and get answers from your CFO AI Advisor — all free during Launch Edition.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => changeTab("guide")}
              className="bg-white hover:bg-slate-50 text-brand-teal font-extrabold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow shrink-0 font-sans flex items-center gap-1"
            >
              See How It Works <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setLaunchBannerDismissed(true);
                localStorage.setItem("aziiki_launch_banner_dismissed", "true");
              }}
              aria-label="Dismiss"
              className="text-white/70 hover:text-white cursor-pointer p-1.5 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        )}

        {/* Traveling-user notice: only when this business has a saved home
            timezone AND it differs from the browser's current one, and the
            user hasn't already dismissed it for this business this session. */}
        {travelNotice && dismissedTravelBannerFor !== currentBusiness.id && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-fade-in text-xs" id="traveling-user-banner">
            <div className="flex items-center gap-2.5">
              <span className="shrink-0"><Globe className="w-4 h-4" /></span>
              <p>
                <span className="font-bold">Looks like you're traveling.</span>{" "}
                Your current timezone is {travelNotice}. Documents you create will still use{" "}
                <strong>{currentBusiness.name}</strong>'s own currency ({currentBusiness.currency}) unless you pick a
                different one for that document.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissedTravelBannerFor(currentBusiness.id)}
              aria-label="Dismiss traveling notice"
              className="text-amber-600 hover:text-amber-800 font-bold shrink-0 cursor-pointer px-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Offline-sync status - see src/lib/offlineDb.ts / offlineSync.ts.
            Shown regardless of guest/signed-in status; connectivity is
            universal, not an account-scoped concern. */}
        <OfflineStatusBanner />

        {/* Aziiki has no SMS/push channel - this is the only in-app signal
            that a payment/low-stock/overdue-invoice email went out. Guest
            mode has no backend session to fetch notifications from. */}
        {!isGuest && <NotificationBanner userEmail={user?.email} />}

        {/* Admin-portal broadcast channel: product announcements and
            surveys, controlled from /admin. Guest mode has no backend
            session to fetch these from either. */}
        {!isGuest && <AnnouncementBanner screen={activeTab} />}
        {!isGuest && <SurveyPrompt />}
        {!isGuest && user && isEnabled("mfa_onboarding_prompt") && (
          <MfaOnboardingNudge userId={user.id} onGoToSettings={() => changeTab("settings")} />
        )}

        {showBrandConfig && (
          <div className="mb-6 bg-white border-2 border-slate-200/95 rounded-2xl p-5 shadow-lg border-emerald-500/20 text-left animate-fade-in text-xs max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">{isAddingNewBiz ? <Plus className="w-4 h-4" /> : <GearSix className="w-4 h-4" />}</span>
                <div>
                  <h3 className="font-bold text-slate-900 font-sans text-sm">
                    {isAddingNewBiz ? "Register New Company Profile" : "Edit Active Enterprise Brand Details"}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isAddingNewBiz 
                      ? "Create another separate localized workspace profile for your secondary trade activity." 
                      : "Modify the active example properties to match your real registered business information."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBrandConfig(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={isAddingNewBiz ? handleRegisterNewBrand : handleUpdateActiveBrand} className="space-y-4">
              {brandFormError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl p-3 flex items-start gap-2">
                  <span className="shrink-0"><AlertCircle className="w-4 h-4" /></span>
                  <span>{brandFormError}</span>
                </div>
              )}

              {bizFormLocked && !isAddingNewBiz && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold rounded-xl p-3 flex items-start gap-2">
                  <span className="shrink-0"><Lock className="w-4 h-4" /></span>
                  <span>This profile is locked, so fields below can't be edited. Uncheck "Lock Business Profile Details" near the bottom to make changes.</span>
                </div>
              )}
              {/* Personal Workspace toggle: off by default in Phase 1 (commercial/SME only), code preserved. Toggle via admin portal -> personal_workspace. */}
              {isAddingNewBiz && isEnabled("personal_workspace") && (
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Select Workspace Category</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsPersonalForm(true)}
                      className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 isPersonalForm ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 }`}
                    >
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> Personal Finances Workspace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPersonalForm(false)}
                      className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 !isPersonalForm ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 }`}
                    >
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> Business SME Workspace</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 font-sans">
                    {isPersonalForm ? "Permanently FREE personal wallet. Manage salaries, mobile money wallets, savings goals, and monthly budgets." : "Commercial SME Operating System. Includes Cashbook ledger, CRM, invoicing, dynamic receipts, and stock."}
                  </p>
                </div>
              )}

              {!isPersonalForm && (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Business Structure / Legal Identity</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      {(["Sole Proprietor", "Partnership", "Company"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={bizFormLocked && !isAddingNewBiz}
                          onClick={() => setBizFormType(t)}
                          className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 bizFormType === t ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 } disabled:opacity-50`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 font-sans">
                      {bizFormType === "Sole Proprietor" && "Single-owner structure (100% equity). Direct personal dashboard labels (\"My Money\", \"My Profit\")."}
                      {bizFormType === "Partnership" && "Joint-ownership partnership structure. Enables Capital ledger registers and auto-splits profit margins."}
                      {bizFormType === "Company" && "Incorporated structured corporate entity. Features Shareholder capital tables, role delegation controls, and audit trails."}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">
                    {isPersonalForm ? "Workspace / Display Name" : "Company / Brand Name"}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={bizFormLocked && !isAddingNewBiz}
                    value={bizFormName}
                    onChange={(e) => setBizFormName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans font-medium focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
                    placeholder={isPersonalForm ? "e.g. My Personal Wallet" : "e.g. BlueStar Logistics"}
                  />
                </div>
                {!isPersonalForm ? (
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Industry Type / Branch Line</label>
                    <input
                      type="text"
                      disabled={bizFormLocked && !isAddingNewBiz}
                      value={bizFormIndustry}
                      onChange={(e) => setBizFormIndustry(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
                      placeholder="e.g. Courier & Freight Branch"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Workspace Category</label>
                    <input
                      type="text"
                      disabled
                      value="Personal Finance"
                      className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans cursor-not-allowed"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Local Base Currency</label>
                  <select
                    disabled={bizFormLocked && !isAddingNewBiz}
                    value={bizFormCurrency}
                    onChange={(e) => setBizFormCurrency(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-2.5 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 cursor-pointer transition-all font-medium text-xs disabled:opacity-60"
                  >
                    <option value="GHS">GHS (₵) Ghana Cedi</option>
                    <option value="NGN">NGN (₦) Nigerian Naira</option>
                    <option value="KES">KES (KSh) Kenyan Shilling</option>
                    <option value="USD">USD ($) US Dollar</option>
                    <option value="EUR">EUR (€) Euro</option>
                    <option value="GBP">GBP (£) British Pound</option>
                  </select>
                </div>
                {!isPersonalForm && (
                  <>
                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Sales VAT / Tax Rate %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        disabled={bizFormLocked && !isAddingNewBiz}
                        value={bizFormTaxRate}
                        onChange={(e) => setBizFormTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans font-mono focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                        placeholder="e.g. 15"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Brand Logo Icon</label>
                      <div className="flex gap-1.5 items-center">
                        {bizFormLogo.startsWith("data:image/") || bizFormLogo.startsWith("http") ? (
                          <div className="relative shrink-0">
                            <img 
                              src={bizFormLogo} 
                              alt="Uploaded Logo" 
                              className="w-8 h-8 rounded-lg object-contain bg-slate-50 border p-0.5"
                            />
                            {!(bizFormLocked && !isAddingNewBiz) && (
                              <button
                                type="button"
                                onClick={() => setBizFormLogo("💼")}
                                className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[7px] font-bold"
                                title="Clear Image"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-slate-150 border rounded-lg flex items-center justify-center text-base shrink-0">
                            {bizFormLogo}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <select
                            disabled={bizFormLocked && !isAddingNewBiz}
                            value={bizFormLogo.startsWith("data:image/") || bizFormLogo.startsWith("http") ? "custom-upload" : bizFormLogo}
                            onChange={(e) => {
                              if (e.target.value !== "custom-upload") {
                                setBizFormLogo(e.target.value);
                              }
                            }}
                            className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-1 py-1.5 outline-none font-sans focus:bg-white focus:border-emerald-500 cursor-pointer transition-all text-[11px] disabled:opacity-60"
                          >
                            <option value="💼">Office/Standard</option>
                            <option value="📸">Creative/Camera</option>
                            <option value="🪡">Apparel/Tailoring</option>
                            <option value="🎪">Event/Expo</option>
                            <option value="🥐">Bakery/Cuisine</option>
                            <option value="🛒">Retail/Shop</option>
                            <option value="🚘">Logistics/Transit</option>
                            <option value="🏗️">Industry/Builders</option>
                            {(bizFormLogo.startsWith("data:image/") || bizFormLogo.startsWith("http")) && (
                              <option value="custom-upload">Custom Logo</option>
                            )}
                          </select>
                          
                          {!(bizFormLocked && !isAddingNewBiz) && (
                            <label className="block text-[8px] text-slate-500 font-sans cursor-pointer bg-slate-100 hover:bg-slate-200 border rounded px-1 py-0.5 mt-0.5 text-center font-bold">
                              Upload Custom Logo File
                              <input
                                type="file"
                                accept="image/png"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.type !== "image/png") {
                                      setBrandFormError("Please upload a PNG file for your logo.");
                                      e.target.value = "";
                                      return;
                                    }
                                    try {
                                      // See imageCompress.ts - resized/
                                      // compressed before storage instead
                                      // of keeping a raw, often
                                      // multi-megabyte upload as-is.
                                      const dataUrl = await compressImageForStorage(file);
                                      setBizFormLogo(dataUrl);
                                      setBrandFormError(null);
                                    } catch (err) {
                                      console.error("Failed to process uploaded logo:", err);
                                      setBrandFormError(err instanceof Error ? err.message : "Couldn't process that image. Please try a different PNG file.");
                                    }
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!isPersonalForm && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Home Country</label>
                    <select
                      disabled={bizFormLocked && !isAddingNewBiz}
                      value={bizFormCountryCode}
                      onChange={(e) => setBizFormCountryCode(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-2.5 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 cursor-pointer transition-all font-medium text-xs disabled:opacity-60"
                    >
                      <option value="">Not set</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Home Timezone</label>
                    <input
                      type="text"
                      disabled={bizFormLocked && !isAddingNewBiz}
                      value={bizFormTimezone}
                      onChange={(e) => setBizFormTimezone(e.target.value)}
                      placeholder="e.g. Africa/Accra"
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all font-mono text-xs disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {!isPersonalForm && (
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Legal / Compliance Description</label>
                  <textarea
                    rows={2}
                    disabled={bizFormLocked && !isAddingNewBiz}
                    value={bizFormDesc}
                    onChange={(e) => setBizFormDesc(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all resize-none text-[11px] disabled:opacity-60"
                    placeholder="Compliant SME hub description as displayed on issued PDF receipts..."
                  />
                </div>
              )}

              {/* Partners/Shareholders registry: off by default in Phase 1, code preserved. Toggle via admin portal -> business_partners_shareholders. */}
              {/* Partnership Configuration Deck */}
              {isEnabled("business_partners_shareholders") && bizFormType === "Partnership" && (
                <div className="border border-slate-200/80 bg-slate-50/50 rounded-2xl p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs font-sans flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                    <UsersThree className="w-3.5 h-3.5" /> Partnership Registry & Capital Splits
                  </h4>
                  
                  <div className="space-y-1.5">
                    {partners.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No partners configured yet. Append records below.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-200/60 rounded-xl p-2.5 max-h-40 overflow-y-auto">
                        {partners.map((p) => (
                          <div key={p.id} className="flex justify-between items-center py-1.5 text-[11px]">
                            <div>
                              <strong className="text-slate-800 font-sans">{p.name}</strong>
                              <span className="text-[10px] text-slate-500 ml-2 font-mono font-bold text-emerald-650">Stake: {p.ownershipPercentage}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-slate-500">Paid Capital: {bizFormCurrency} {p.capitalContribution.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => setPartners(partners.filter(item => item.id !== p.id))}
                                className="text-slate-400 hover:text-rose-600 font-black px-1 text-xs cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="font-sans font-bold text-[10px] text-slate-600 flex justify-between px-1">
                      <span>Combined Partners Registry Stake:</span>
                      <span className={partners.reduce((sum, p) => sum + p.ownershipPercentage, 0) === 100 ? "text-emerald-600" : "text-amber-600 animate-pulse font-mono"}>
                        {partners.reduce((sum, p) => sum + p.ownershipPercentage, 0)}% of 100%
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                    <span className="text-[9px] font-bold font-mono text-slate-400 block uppercase">Append partner stakeholder to register</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          placeholder="Partner Name"
                          value={newPartnerName}
                          onChange={(e) => setNewPartnerName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none font-sans w-full focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          placeholder="Equity percentage %"
                          value={newPartnerOwnership || ""}
                          onChange={(e) => setNewPartnerOwnership(parseInt(e.target.value) || 0)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none font-mono w-full focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="GHS Capital"
                          value={newPartnerCapital || ""}
                          onChange={(e) => setNewPartnerCapital(parseInt(e.target.value) || 0)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none font-mono w-full focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPartnerName.trim()) return;
                        const totalCurrent = partners.reduce((sum, p) => sum + p.ownershipPercentage, 0);
                        if (totalCurrent + newPartnerOwnership > 100) {
                          alert(`Warning: Appending this partner results in ${totalCurrent + newPartnerOwnership}% ownership, which exceeds the absolute 100% threshold.`);
                        }
                        const newP: Partner = {
                          id: "p-custom-" + Math.random().toString(36).substr(2, 5),
                          name: newPartnerName.trim(),
                          ownershipPercentage: newPartnerOwnership,
                          capitalContribution: newPartnerCapital,
                          withdrawals: 0
                        };
                        setPartners([...partners, newP]);
                        setNewPartnerName("");
                        setNewPartnerOwnership(25);
                        setNewPartnerCapital(5000);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2 rounded-xl text-[10px] transition-colors cursor-pointer"
                    >
                      + Commit Partner Allocation
                    </button>
                  </div>
                </div>
              )}

              {/* Shareholders/Roles registry: off by default in Phase 1, code preserved. Toggle via admin portal -> business_partners_shareholders. */}
              {/* Company Configuration Deck */}
              {isEnabled("business_partners_shareholders") && bizFormType === "Company" && (
                <div className="border border-slate-200/85 bg-slate-50/50 rounded-2xl p-4 space-y-4">
                  <h4 className="font-bold text-slate-900 text-xs font-sans flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                    <GearSix className="w-3.5 h-3.5" /> Corporate Governance & Team Delegations
                  </h4>

                  {/* Shareholders Registry */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1"><ChartBar className="w-3 h-3" /> Shareholders Ledger & Seed Capital</span>
                    {shareholders.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No shareholders registered. Initialize authorization below.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-200/60 rounded-xl p-2.5 max-h-32 overflow-y-auto">
                        {shareholders.map((sh) => (
                          <div key={sh.id} className="flex justify-between items-center py-1.5 text-[11px]">
                            <div>
                              <strong className="text-slate-800 font-sans">{sh.name}</strong>
                              <span className="text-[10px] text-slate-500 ml-2 font-mono">Holding: {sh.sharesCount.toLocaleString()} common units</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-slate-500">Paid contribution: {bizFormCurrency} {sh.capitalContribution.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => setShareholders(shareholders.filter(item => item.id !== sh.id))}
                                className="text-slate-400 hover:text-rose-600 font-black px-1 cursor-pointer text-xs"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
                      <span className="text-[9px] font-bold font-mono text-slate-450 block uppercase">Enroll Shareholder Contribution</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Shareholder Name"
                          value={newShareholderName}
                          onChange={(e) => setNewShareholderName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-sans w-full"
                        />
                        <input
                          type="number"
                          placeholder="Shares Units (e.g. 2000)"
                          value={newShareholderShares || ""}
                          onChange={(e) => setNewShareholderShares(parseInt(e.target.value) || 0)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-mono w-full"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            placeholder="Capital contribution"
                            value={newShareholderCapital || ""}
                            onChange={(e) => setNewShareholderCapital(parseInt(e.target.value) || 0)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-mono w-full"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newShareholderName.trim()) return;
                              const newSH: Shareholder = {
                                id: "sh-custom-" + Math.random().toString(36).substr(2, 5),
                                name: newShareholderName.trim(),
                                sharesCount: newShareholderShares,
                                capitalContribution: newShareholderCapital,
                                equityValue: newShareholderCapital
                              };
                              setShareholders([...shareholders, newSH]);
                              setNewShareholderName("");
                              setNewShareholderShares(1000);
                              setNewShareholderCapital(15000);
                            }}
                            className="bg-slate-900 text-white font-bold px-3 rounded-lg text-[10px] hover:bg-slate-950 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team Roles and Permissions: this is the OLD, informational-only
                      roster (business_roles) - a second "team member" system
                      duplicating the real one (business_memberships, gated by
                      team_memberships_invite_ui in InvoiceReceiptBuilder.tsx).
                      Off by default in Phase 1, code and any existing data
                      preserved. Toggle via admin portal -> team_memberships_invite_ui. */}
                  {isEnabled("team_memberships_invite_ui") && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1"><LockKey className="w-3 h-3" /> Role-Based Access Controls</span>
                    {roles.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No custom user roles declared yet. Set permissions below.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-200/60 rounded-xl p-2.5 max-h-32 overflow-y-auto">
                        {roles.map((r) => (
                          <div key={r.id} className="flex justify-between items-center py-1 text-[11px]">
                            <div>
                              <strong className="text-slate-800 font-sans">{r.name}</strong>
                              <span className="text-[10px] text-slate-500 font-mono ml-2">({r.email})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-black rounded text-[9px] uppercase font-mono">{r.role}</span>
                              <button
                                type="button"
                                onClick={() => setRoles(roles.filter(item => item.id !== r.id))}
                                className="text-slate-400 hover:text-rose-600 font-black px-1 cursor-pointer text-xs"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
                      <span className="text-[9px] font-bold font-mono text-slate-450 block uppercase">Assign Staff Role Directory</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-sans w-full"
                        />
                        <input
                          type="email"
                          placeholder="Email address"
                          value={newRoleEmail}
                          onChange={(e) => setNewRoleEmail(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-sans w-full"
                        />
                        <div className="flex gap-1.5">
                          <select
                            value={newRoleType}
                            onChange={(e) => setNewRoleType(e.target.value as any)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[10px] outline-none font-sans w-full cursor-pointer"
                          >
                            <option value="Owner">Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Staff">Staff</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newRoleName.trim() || !newRoleEmail.trim()) return;
                              const newR: UserRole = {
                                id: "r-custom-" + Math.random().toString(36).substr(2, 5),
                                name: newRoleName.trim(),
                                email: newRoleEmail.trim(),
                                role: newRoleType
                              };
                              setRoles([...roles, newR]);
                              setNewRoleName("");
                              setNewRoleEmail("");
                              setNewRoleType("Staff");
                            }}
                            className="bg-slate-900 text-white font-bold px-3 rounded-lg text-[10px] hover:bg-slate-950 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Approvals Workflow switch */}
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60 leading-normal">
                    <input
                      type="checkbox"
                      id="allowApprovalsSwitch"
                      checked={allowFinancialApprovals}
                      onChange={(e) => setAllowFinancialApprovals(e.target.checked)}
                      className="w-3.5 h-3.5 cursor-pointer accent-emerald-600 rounded mt-0.5 shrink-0"
                    />
                    <label htmlFor="allowApprovalsSwitch" className="text-[10px] text-slate-600 font-sans cursor-pointer select-none">
                      Enable <strong>Dual-Signature Financial Approval Process</strong>.<br />
                      Staff adjustments above {bizFormCurrency} 500 will enter pending quarantine until an Admin/Owner approves.
                    </label>
                  </div>
                </div>
              )}

              {/* Brand Profile Locking Feature to prevent accidental changes */}
              {!isPersonalForm && (
                <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl leading-normal">
                  <input
                    type="checkbox"
                    id="lockBrandDetails"
                    checked={bizFormLocked}
                    onChange={(e) => setBizFormLocked(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-emerald-600 rounded shrink-0"
                  />
                  <label htmlFor="lockBrandDetails" className="text-[11px] text-emerald-800 font-sans cursor-pointer select-none flex items-start gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><strong>Lock Business Profile Details</strong>. Lock this brand layout and details to prevent editing again. This applies to company name, currency, tax rate, and legal profiles across the entire app.</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewBiz(false);
                    setShowBrandConfig(false);
                    setBrandFormError(null);
                  }}
                  disabled={isSavingBrand}
                  className="px-4 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBrand}
                  className="px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-500/10 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {isSavingBrand ? "Saving..." : isAddingNewBiz ? "Create Brand Profile" : "Apply Brand Changes"}
                </button>
              </div>
            </form>
          </div>
        )}



        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <>
                {isEnabled("core_dashboard") && activeTab === "dashboard" && (
                  currentBusiness.isPersonal ? (
                    <Suspense fallback={<SkeletonDashboard />}>
                      <PersonalWorkspace
                        currentBusiness={currentBusiness}
                        transactions={transactions}
                        goals={goals}
                        debts={debts}
                        investments={investments}
                        currencySymbol={currencySymbol}
                        onAddTransaction={handleAddTransaction}
                        onDeleteTransaction={handleDeleteTransaction}
                        onAddGoal={handleAddGoal}
                        onAddDebt={handleAddDebt}
                        onAddInvestment={handleAddInvestment}
                        onContributeToGoal={handleContributeToGoal}
                        onUpdateBusiness={handleUpdateBusiness}
                        onDeleteDebt={handleDeleteDebt}
                        onDeleteGoal={handleDeleteGoal}
                        onDeleteInvestment={handleDeleteInvestment}
                        onRepayDebt={handleRepayDebt}
                      />
                    </Suspense>
                  ) : (
                    <BusinessDashboard
                      currentBusiness={currentBusiness}
                      transactions={transactions}
                      customers={customers}
                      invoices={invoices}
                      currencySymbol={currencySymbol}
                      onAddTransaction={handleAddTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      onRestoreBackup={handleRestoreBackup}
                      debts={debts}
                    />
                  )
                )}

                {isEnabled("core_billing") && activeTab === "billing" && (
                  <Suspense fallback={<SkeletonBillingBuilder />}>
                    <InvoiceReceiptBuilder
                      currentBusiness={currentBusiness}
                      customers={customers}
                      invoices={invoices}
                      receipts={receipts}
                      quotations={quotations}
                      currencySymbol={currencySymbol}
                      onAddInvoice={handleAddInvoice}
                      onAddReceipt={handleAddReceipt}
                      onAddQuotation={handleAddQuotation}
                      onConvertQuote={handleConvertQuoteToInvoice}
                      onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                    />
                  </Suspense>
                )}

                {isEnabled("core_customers") && activeTab === "crm" && (
                  <Suspense fallback={<SkeletonCRM />}>
                    <CustomerCRM
                      currentBusiness={currentBusiness}
                      customers={customers}
                      invoices={invoices}
                      transactions={transactions}
                      currencySymbol={currencySymbol}
                      onAddCustomer={handleAddCustomer}
                      onUpdateCustomer={handleUpdateCustomer}
                      onDeleteCustomer={handleDeleteCustomer}
                    />
                  </Suspense>
                )}

                {/* Off by default in Phase 1, code preserved for the admin portal to turn on later. */}
                {isEnabled("net_worth_investments") && activeTab === "wealth" && (
                  <Suspense
                    fallback={
                      <div className="space-y-6">
                        <SkeletonDashboard />
                        <SkeletonDetail />
                      </div>
                    }
                  >
                    <NetWorthInvestments
                      investments={investments}
                      assets={assets}
                      goals={goals}
                      debts={debts}
                      currencySymbol={currencySymbol}
                      totalCash={availableCash}
                      onAddInvestment={handleAddInvestment}
                      onDeleteInvestment={handleDeleteInvestment}
                      onAddAsset={handleAddAsset}
                      onDeleteAsset={handleDeleteAsset}
                      onUpdateAsset={handleUpdateAsset}
                      onAddGoal={handleAddGoal}
                      onDeleteGoal={handleDeleteGoal}
                      onAddDebt={handleAddDebt}
                      onDeleteDebt={handleDeleteDebt}
                      onContributeToGoal={handleContributeToGoal}
                      currentBusiness={currentBusiness}
                    />
                  </Suspense>
                )}

                {/* Off by default in Phase 1 per the product teardown, code preserved for the admin portal to turn on later. */}
                {isEnabled("inventory_management") && activeTab === "stock" && (
                  <Suspense fallback={<SkeletonInventory />}>
                    <InventoryManager
                      currentBusiness={currentBusiness}
                      inventory={inventory}
                      currencySymbol={currencySymbol}
                      onAddInventoryItem={handleAddInventoryItem}
                      onUpdateInventoryItem={handleUpdateInventoryItem}
                      onDeleteInventoryItem={handleDeleteInventoryItem}
                      onStockAdjustment={handleStockAdjustment}
                    />
                  </Suspense>
                )}

                {/* Off by default in Phase 1, code preserved for the admin portal to turn on later. Each of these three used to be a cramped sub-tab inside the Billing builder; they're now their own top-level screens. */}
                {isEnabled("purchase_orders") && activeTab === "purchaseOrders" && (
                  <Suspense fallback={<SkeletonTable rows={5} cols={4} />}>
                    <PurchaseOrderManager businessId={currentBusiness.id} businessCurrency={currentBusiness.currency} />
                  </Suspense>
                )}

                {isEnabled("team_memberships_invite_ui") && activeTab === "team" && (
                  <Suspense fallback={<SkeletonTable rows={4} cols={3} />}>
                    <TeamManager businessId={currentBusiness.id} />
                  </Suspense>
                )}

                {isEnabled("core_reports") && activeTab === "reports" && (
                  <Suspense fallback={<SkeletonReportsCharts />}>
                    <FinancialReports
                      currentBusiness={currentBusiness}
                      transactions={transactions}
                      goals={goals}
                      investments={investments}
                      currencySymbol={currencySymbol}
                      onContributeToGoal={handleContributeToGoal}
                      onAddTransaction={handleAddTransaction}
                    />
                  </Suspense>
                )}

                {isEnabled("core_ai_advisor") && activeTab === "ai" && (
                  <Suspense fallback={<SkeletonForm />}>
                    <AIFieldAssistant
                      currentBusiness={currentBusiness}
                      transactions={transactions}
                      invoices={invoices}
                      goals={goals}
                      currencySymbol={currencySymbol}
                    />
                  </Suspense>
                )}

                {/* Off by default in Phase 1, code preserved for the admin portal to turn on later. */}
                {isEnabled("ad_monetization_hub") && activeTab === "monetize" && (
                  <Suspense fallback={<SkeletonForm />}>
                    <AdMonetizationHub />
                  </Suspense>
                )}

                {isEnabled("core_app_guide") && activeTab === "guide" && (
                  <Suspense
                    fallback={
                      <div className="space-y-4">
                        <Skeleton width="40%" height="2rem" />
                        <Skeleton width="100%" height="15rem" />
                      </div>
                    }
                  >
                    <AppGuide />
                  </Suspense>
                )}

                {isEnabled("core_help_support") && activeTab === "helpSupport" && (
                  <Suspense fallback={<Skeleton width="100%" height="20rem" />}>
                    <HelpSupportPage
                      onGoToGuide={() => changeTab("guide")}
                      onShowPrivacyPolicy={() => setShowPrivacyPolicy(true)}
                      onShowTermsOfService={() => setShowTermsOfService(true)}
                      onShowRefundPolicy={() => setShowRefundPolicy(true)}
                    />
                  </Suspense>
                )}

                {isEnabled("core_settings") && activeTab === "settings" && (
                  <Suspense fallback={<Skeleton width="100%" height="20rem" />}>
                    <SettingsPage userEmail={user?.email ?? null} onAccountDeleted={handleLogout} />
                  </Suspense>
                )}

                {/* Every core screen switched off from the admin portal at once - an edge case, but one that must explain itself rather than render an empty page. */}
                {flagsLoaded && !getFallbackTab() && (
                  <div className="text-center py-20 text-slate-400 text-sm">
                    Every workspace screen is currently turned off. Turn at least one back on from the admin portal's Feature Flags.
                  </div>
                )}
              </>
          </motion.div>
        </AnimatePresence>


        <Footer
          onShowPrivacyPolicy={() => setShowPrivacyPolicy(true)}
          onShowTermsOfService={() => setShowTermsOfService(true)}
          onGoToHelp={isEnabled("core_help_support") ? () => changeTab("helpSupport") : undefined}
        />

      </main>

      <MobileNavBar
        activeTab={activeTab}
        onChangeTab={changeTab}
        isEnabled={isEnabled}
        tier={user ? tier : undefined}
        upgradeUrl={upgradeUrl}
        nextTier={nextTier}
        onLogout={user ? handleLogout : undefined}
        userEmail={user?.email ?? null}
      />

    </div>
  );
}
