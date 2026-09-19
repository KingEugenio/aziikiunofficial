import { createClient } from "@supabase/supabase-js";

const supabaseUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL ?? "" : "";
const supabaseAnonKey = typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "" : "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const missingConfigMessage =
  "Aziiki is not configured yet: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project URL and anon key before starting the app.";

function makeMissingConfigClient() {
  const createError = () => new Error(missingConfigMessage);

  const safeAuth = {
    getSession: async () => ({ data: { session: null, user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    signOut: async () => {
      throw createError();
    },
    signInWithOAuth: async () => {
      throw createError();
    },
    getUser: async () => ({ data: { user: null }, error: null }),
    setSession: async () => {
      throw createError();
    },
    signInWithPassword: async () => {
      throw createError();
    },
    signUp: async () => {
      throw createError();
    },
    resetPasswordForEmail: async () => {
      throw createError();
    },
    verifyOtp: async () => {
      throw createError();
    },
    signInWithOtp: async () => {
      throw createError();
    },
    updateUser: async () => {
      throw createError();
    },
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] }, error: null }),
      enroll: async () => {
        throw createError();
      },
      challenge: async () => {
        throw createError();
      },
      verify: async () => {
        throw createError();
      },
      unenroll: async () => {
        throw createError();
      },
    },
  } as any;

  return {
    auth: safeAuth,
    from: () => {
      throw createError();
    },
    storage: {
      from: () => {
        throw createError();
      },
    },
    rpc: async () => {
      throw createError();
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) }),
      subscribe: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    }),
    removeChannel: () => undefined,
  } as any;
}

// Session/refresh token handling is entirely Supabase's built-in mechanism -
// persisted to localStorage and auto-refreshed by this client. No custom JWT
// signing/verification exists anywhere in this app anymore.
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : makeMissingConfigClient();
