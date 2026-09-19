import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {IconContext} from '@phosphor-icons/react';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import AdminApp from './admin/AdminApp.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { api } from './lib/api.ts';
import { captureUtmParams } from './lib/utm.ts';
import { initSentry } from './lib/sentry.ts';
import { primeCache } from './lib/sessionCache.ts';
import { supabaseConfigured } from './lib/supabaseClient.ts';
import './index.css';

// No-ops entirely until VITE_SENTRY_DSN is set - see lib/sentry.ts.
initSentry();

// Capture utm_source/utm_medium/utm_campaign from the URL, if present, so a
// signup completed later in the session can be attributed to the campaign
// that brought the visitor in (see the socials setup work this ties into).
captureUtmParams();

// Swaps the browser-tab favicon for the admin-uploaded one (see /admin ->
// Branding & Files), if one exists. Runs once at boot, outside React,
// since a <link> tag in <head> isn't part of the component tree - falls
// back to whatever's already in index.html on any failure.
api.config
  .branding()
  .then((res) => {
    // Primes useBranding()'s cache (same "aziiki_cache_branding" key) so
    // BrandLogo.tsx's first mount, moments later, doesn't fire a second
    // identical request for data this fetch already has in hand.
    primeCache('aziiki_cache_branding', res);
    if (!res.faviconUrl) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement('link');
    link.rel = 'icon';
    link.href = res.faviconUrl;
    if (!link.parentNode) document.head.appendChild(link);
  })
  .catch(() => {
    // Keep the static default favicon already in index.html.
  });

// Vercel Analytics only means anything on a real https deployment. On
// localhost, the desktop app (127.0.0.1) or plain-http hosts it can't record
// anything - and it would still reach out to va.vercel-scripts.com from the
// user's machine for nothing, which is a needless third-party request.
const analyticsEnabled =
  window.location.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname);

// /admin is a second, separate root component (its own auth/admin check,
// its own bundle) rather than a route within <App/> - this app has no
// client-side router at all (single-page, tab-state only), and the admin
// portal has nothing in common with the main app's session/business state.
const isAdminPath = window.location.pathname.startsWith('/admin');
const RootApp = isAdminPath ? AdminApp : App;

const renderApp = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Every Phosphor icon in the app defaults to the solid "fill" weight
        from here, so individual call sites never need to pass weight="fill"
        themselves - see the icon imports across src/components for the
        lucide-react -> @phosphor-icons/react name mapping. */}
    <IconContext.Provider value={{ weight: 'fill' }}>
      {/* Catches any uncaught render error anywhere in the app - see
          ErrorBoundary.tsx for why this matters: without it, any
          unexpected error crashes the whole app to a blank white screen
          with zero explanation, which is exactly what was happening. */}
      <ErrorBoundary>
        <RootApp />
      </ErrorBoundary>
      {/* No-ops outside a real Vercel deployment (local dev, other hosts) -
          nothing to configure, no env var, no signup. Page views are
          automatic; feature-level events are sent via track() at the
          specific action points that matter (see lib/analytics.ts). */}
      {analyticsEnabled && <Analytics />}
    </IconContext.Provider>
  </StrictMode>,
);

if (!supabaseConfigured) {
  createRoot(document.getElementById('root')!).render(
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="max-w-lg w-full rounded-3xl border border-amber-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-lg font-black text-amber-700">
          !
        </div>
        <h1 className="text-xl font-black text-slate-900">Aziiki needs configuration</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The browser app is missing the required Supabase environment variables.
          Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before reloading the page.
        </p>
        <p className="mt-4 text-xs font-mono text-amber-700 break-words bg-amber-50 border border-amber-200 rounded-xl p-3">
          Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
        </p>
      </div>
    </div>
  );
} else {
  renderApp();
}
