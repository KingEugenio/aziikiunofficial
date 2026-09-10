import { supabase } from "./supabaseClient";
import { getCachedResponse, setCachedResponse, enqueueWrite } from "./offlineDb";

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

class ApiError extends Error {
  status: number;
  issues?: unknown;
  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

/**
 * Thrown instead of a generic ApiError when a mutating request couldn't
 * reach the network at all (not a validation/auth/server error - the
 * request never got a response). The write has already been queued in
 * IndexedDB (see offlineDb.ts) and will replay automatically once the
 * browser is back online (see offlineSync.ts).
 *
 * Deliberately a subclass of ApiError, not a plain Error: every existing
 * call site across the app already does `catch (err) { ... err instanceof
 * ApiError ? err.message : "generic fallback" ... }` - subclassing means
 * this flows through that same existing handling everywhere for free,
 * showing the real "saved for later" message instead of a generic
 * failure, with no changes needed at any of those ~10 call sites.
 */
class OfflineQueuedError extends ApiError {
  constructor() {
    super("You're offline - this has been saved and will sync automatically once you're back online.", 0);
  }
}

// GET responses cached for offline reading are scoped to paths worth
// re-showing with no network: the one bulk load-everything endpoint,
// plus config the pre-login/pre-sync screens need. Deliberately NOT every
// GET - caching e.g. a one-off document-numbering preview would be actively
// wrong to replay stale.
const CACHEABLE_GET_PREFIXES = ["/sync", "/config/features", "/config/branding"];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    // fetch() only throws for a genuine network failure (offline, DNS,
    // connection refused, ...) - a real HTTP error status (400, 500, ...)
    // still resolves normally and is handled below, not here.
    if (method === "GET") {
      const cached = await getCachedResponse(path);
      if (cached !== undefined) return cached as T;
      throw new ApiError("You're offline, and this hasn't been loaded before on this device.", 0);
    }
    await enqueueWrite({ path, method, body: options.body as string | undefined });
    throw new OfflineQueuedError();
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || `Request failed (${response.status})`, response.status, body.issues);
  }

  if (method === "GET" && CACHEABLE_GET_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    setCachedResponse(path, body);
  }

  return body as T;
}

function makeResource<T>(basePath: string) {
  return {
    list: (businessId?: string) =>
      request<{ data: T[] }>(`${basePath}${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`).then(
        (r) => r.data
      ),
    create: (payload: unknown) => request<{ data: T }>(basePath, { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
    update: (id: string, payload: unknown) =>
      request<{ data: T }>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`${basePath}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  auth: {
    signup: (payload: { email: string; password: string; displayName?: string }) =>
      request<{ message: string }>("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload: { email: string; password: string }) =>
      request<{ session: any; user: { id: string; email: string }; mfaRequired: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    magicLink: (email: string) => request<{ message: string }>("/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) }),
    otpRequest: (email: string) => request<{ message: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ email }) }),
    otpVerify: (email: string, token: string) =>
      request<{ session: any; user: { id: string; email: string } | null }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, token }),
      }),
    passwordResetRequest: (email: string) =>
      request<{ message: string }>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
    mfaFactors: () => request<{ factors: any }>("/auth/mfa/factors"),
    mfaEnroll: (friendlyName?: string) =>
      request<{ factorId: string; qrCode: string; secret: string; uri: string }>("/auth/mfa/enroll", {
        method: "POST",
        body: JSON.stringify({ friendlyName }),
      }),
    mfaChallenge: (factorId: string) =>
      request<{ challengeId: string }>("/auth/mfa/challenge", { method: "POST", body: JSON.stringify({ factorId }) }),
    mfaVerify: (factorId: string, challengeId: string, code: string) =>
      request<{ session: any }>("/auth/mfa/verify", { method: "POST", body: JSON.stringify({ factorId, challengeId, code }) }),
    mfaUnenroll: (factorId: string) => request<void>("/auth/mfa/unenroll", { method: "POST", body: JSON.stringify({ factorId }) }),
  },

  sync: {
    fetchAll: () => request<{ data: any }>("/sync").then((r) => r.data),
  },

  businesses: makeResource<any>("/businesses"),
  personalAccounts: makeResource<any>("/personal-accounts"),
  personalBudgets: makeResource<any>("/personal-budgets"),
  customers: makeResource<any>("/customers"),
  transactions: makeResource<any>("/transactions"),
  receipts: {
    ...makeResource<any>("/receipts"),
    sendEmail: (id: string) => request<{ message: string }>(`/receipts/${id}/send-email`, { method: "POST" }),
  },
  investments: makeResource<any>("/investments"),
  assets: makeResource<any>("/assets"),
  inventory: {
    ...makeResource<any>("/inventory"),
    adjust: (id: string, delta: number) =>
      request<{ data: any }>(`/inventory/${id}/adjust`, { method: "POST", body: JSON.stringify({ delta }) }).then((r) => r.data),
  },
  goals: {
    ...makeResource<any>("/goals"),
    contribute: (id: string, amount: number, currency?: string) =>
      request<{ data: any }>(`/goals/${id}/contribute`, { method: "POST", body: JSON.stringify({ amount, currency }) }).then(
        (r) => r.data
      ),
  },
  debts: {
    ...makeResource<any>("/debts"),
    repay: (id: string, amount: number) =>
      request<{ data: any; settled: boolean }>(`/debts/${id}/repay`, { method: "POST", body: JSON.stringify({ amount }) }),
  },
  invoices: {
    ...makeResource<any>("/invoices"),
    sendEmail: (id: string) => request<{ message: string }>(`/invoices/${id}/send-email`, { method: "POST" }),
  },
  quotations: {
    ...makeResource<any>("/quotations"),
    convertToInvoice: (id: string, payload: { dueDate: string; taxRate: number }) =>
      request<{ invoice: any }>(`/quotations/${id}/convert-to-invoice`, { method: "POST", body: JSON.stringify(payload) }).then(
        (r) => r.invoice
      ),
  },
  purchaseOrders: makeResource<any>("/purchase-orders"),

  feedback: {
    submit: (payload: { name: string; email: string; message: string }) =>
      request<{ message: string }>("/feedback", { method: "POST", body: JSON.stringify(payload) }),
  },

  config: {
    features: () =>
      request<{ emailSendingEnabled: boolean; paystackEnabled: boolean; flags: Record<string, boolean> }>(
        "/config/features"
      ),
    branding: () => request<{ logoUrl: string | null; faviconUrl: string | null }>("/config/branding"),
  },

  brandKits: {
    get: (businessId: string) => request<{ data: any }>(`/brand-kits?businessId=${encodeURIComponent(businessId)}`).then((r) => r.data),
    save: (payload: Record<string, unknown>) =>
      request<{ data: any }>("/brand-kits", { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.data),
  },

  documentTemplates: {
    list: (params?: { documentType?: string; category?: string; folder?: string; favoriteOnly?: boolean; search?: string }) => {
      const query = new URLSearchParams();
      if (params?.documentType) query.set("documentType", params.documentType);
      if (params?.category) query.set("category", params.category);
      if (params?.folder) query.set("folder", params.folder);
      if (params?.favoriteOnly) query.set("favoriteOnly", "true");
      if (params?.search) query.set("search", params.search);
      const qs = query.toString();
      return request<{ data: any[] }>(`/document-templates${qs ? `?${qs}` : ""}`).then((r) => r.data);
    },
    create: (payload: Record<string, unknown>) =>
      request<{ data: any }>("/document-templates", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
    update: (id: string, payload: Record<string, unknown>) =>
      request<{ data: any }>(`/document-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`/document-templates/${id}`, { method: "DELETE" }),
    duplicate: (id: string, businessId: string) =>
      request<{ data: any }>(`/document-templates/${id}/duplicate`, { method: "POST", body: JSON.stringify({ businessId }) }).then(
        (r) => r.data
      ),
    versions: (id: string) => request<{ data: any[] }>(`/document-templates/${id}/versions`).then((r) => r.data),
  },

  documentNumbering: {
    peek: (businessId: string, documentType: string, defaultPrefix?: string) => {
      const query = new URLSearchParams({ businessId, documentType });
      if (defaultPrefix) query.set("defaultPrefix", defaultPrefix);
      return request<{ preview: string }>(`/document-numbering/peek?${query.toString()}`).then((r) => r.preview);
    },
  },

  payments: {
    list: (businessId?: string) =>
      request<{ data: any[] }>(`/payments${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`).then((r) => r.data),
    initializePaystack: (payload: {
      businessId: string;
      invoiceId?: string;
      customerId?: string;
      email?: string;
      amount: number;
      currency?: string;
    }) =>
      request<{ data: any; authorizationUrl: string }>("/payments/paystack/initialize", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  notifications: {
    list: () => request<{ data: any[] }>("/notifications").then((r) => r.data),
    markRead: (id: string) => request<{ data: any }>(`/notifications/${id}/read`, { method: "POST" }).then((r) => r.data),
    markAllRead: () => request<void>("/notifications/read-all", { method: "POST" }),
  },

  exchangeRates: {
    list: (businessId: string) =>
      request<{ data: any[] }>(`/exchange-rates?businessId=${encodeURIComponent(businessId)}`).then((r) => r.data),
    upsert: (payload: { businessId: string; currency: string; rateToBusinessCurrency: number }) =>
      request<{ data: any }>("/exchange-rates", { method: "PUT", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`/exchange-rates/${id}`, { method: "DELETE" }),
  },

  businessMemberships: {
    list: (businessId: string) =>
      request<{ data: any[] }>(`/business-memberships?businessId=${encodeURIComponent(businessId)}`).then((r) => r.data),
    invite: (payload: { businessId: string; email: string; role: "Admin" | "Accountant" | "Staff" }) =>
      request<{ data: any }>("/business-memberships/invite", { method: "POST", body: JSON.stringify(payload) }).then(
        (r) => r.data
      ),
    updateRole: (id: string, role: "Admin" | "Accountant" | "Staff") =>
      request<{ data: any }>(`/business-memberships/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }).then(
        (r) => r.data
      ),
    remove: (id: string) => request<void>(`/business-memberships/${id}`, { method: "DELETE" }),
  },

  signatures: {
    get: (documentType: string, documentId: string) => {
      const query = new URLSearchParams({ documentType, documentId });
      return request<{ data: any | null }>(`/signatures?${query.toString()}`).then((r) => r.data);
    },
    create: (payload: {
      businessId: string;
      documentType: string;
      documentId: string;
      signerName: string;
      signatureKind: "drawn" | "typed";
      signatureData: string;
    }) => request<{ data: any }>("/signatures", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
    remove: (id: string) => request<void>(`/signatures/${id}`, { method: "DELETE" }),
  },

  announcements: {
    list: () =>
      request<{ data: Array<{ id: string; title: string; message: string; createdAt: string; read: boolean }> }>(
        "/announcements"
      ).then((r) => r.data),
    markRead: (id: string) => request<void>(`/announcements/${id}/read`, { method: "POST" }),
  },

  surveys: {
    listActive: () =>
      request<{ data: Array<{ id: string; title: string; description?: string; questions: SurveyQuestion[]; createdAt: string }> }>(
        "/surveys"
      ).then((r) => r.data),
    submitResponse: (id: string, answers: Record<string, string>) =>
      request<{ message: string }>(`/surveys/${id}/responses`, { method: "POST", body: JSON.stringify({ answers }) }),
  },

  admin: {
    me: () => request<{ data: { id: string; email: string } }>("/admin/me"),

    featureFlags: {
      list: () =>
        request<{
          data: Array<{
            key: string;
            name: string;
            description: string;
            phase: number;
            enabledDefault: boolean;
            updatedAt: string;
            overrideCount: number;
          }>;
        }>("/admin/feature-flags").then((r) => r.data),
      setDefault: (key: string, enabledDefault: boolean) =>
        request<{ data: unknown }>(`/admin/feature-flags/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ enabledDefault }),
        }),
      listOverrides: (key: string) =>
        request<{ data: Array<{ userId: string; email: string; enabled: boolean; createdAt: string }> }>(
          `/admin/feature-flags/${key}/overrides`
        ).then((r) => r.data),
      setOverride: (key: string, email: string, enabled: boolean) =>
        request<{ data: unknown }>(`/admin/feature-flags/${key}/overrides`, {
          method: "PUT",
          body: JSON.stringify({ email, enabled }),
        }),
      removeOverride: (key: string, userId: string) =>
        request<void>(`/admin/feature-flags/${key}/overrides/${userId}`, { method: "DELETE" }),
    },

    announcements: {
      list: () =>
        request<{
          data: Array<{ id: string; title: string; message: string; isActive: boolean; createdAt: string; readCount: number }>;
        }>("/admin/announcements").then((r) => r.data),
      create: (title: string, message: string) =>
        request<{ data: unknown }>("/admin/announcements", { method: "POST", body: JSON.stringify({ title, message }) }),
      setActive: (id: string, isActive: boolean) =>
        request<{ data: unknown }>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    },

    surveys: {
      list: () =>
        request<{
          data: Array<{
            id: string;
            title: string;
            description?: string;
            questions: SurveyQuestion[];
            isActive: boolean;
            createdAt: string;
            responseCount: number;
          }>;
        }>("/admin/surveys").then((r) => r.data),
      create: (payload: { title: string; description?: string; questions: SurveyQuestion[] }) =>
        request<{ data: unknown }>("/admin/surveys", { method: "POST", body: JSON.stringify(payload) }),
      setActive: (id: string, isActive: boolean) =>
        request<{ data: unknown }>(`/admin/surveys/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
      results: (id: string) =>
        request<{
          data: {
            survey: { id: string; title: string };
            responseCount: number;
            questions: Array<{ id: string; prompt: string; type: "text" | "choice"; counts?: Record<string, number>; answers?: string[] }>;
          };
        }>(`/admin/surveys/${id}/results`).then((r) => r.data),
    },

    stats: {
      get: () =>
        request<{
          data: { totalUsers: number; totalBusinesses: number; activeAnnouncements: number; activeSurveys: number; flagsEnabled: number };
        }>("/admin/stats").then((r) => r.data),
    },

    assets: {
      list: () =>
        request<{
          data: Array<{
            id: string;
            kind: "logo" | "favicon" | "document";
            fileName: string;
            storagePath: string;
            url: string;
            contentType: string;
            sizeBytes: number;
            isActive: boolean;
            createdAt: string;
          }>;
        }>("/admin/assets").then((r) => r.data),
      create: (payload: { kind: "logo" | "favicon" | "document"; fileName: string; storagePath: string; contentType: string; sizeBytes: number }) =>
        request<{ data: unknown }>("/admin/assets", { method: "POST", body: JSON.stringify(payload) }),
      remove: (id: string) => request<void>(`/admin/assets/${id}`, { method: "DELETE" }),
    },
  },
};

export interface SurveyQuestion {
  id: string;
  type: "text" | "choice";
  prompt: string;
  options?: string[];
}

export { ApiError, OfflineQueuedError, request };
