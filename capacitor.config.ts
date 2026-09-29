import type { CapacitorConfig } from "@capacitor/cli";

// Aziiki's API calls are relative ("/api/...", see src/lib/api.ts) - they
// resolve against whatever origin the app's HTML was loaded from. A fully
// offline-bundled native app (webDir below, with no `server.url`) would
// load from capacitor://localhost / https://localhost, where those calls
// have nothing to reach - so this points the native shell at the real web
// app's origin instead, same as loading the live site in a normal mobile
// browser, just wrapped in a native app icon/splash screen. Every admin
// setting (feature flags, PostHog, pricing, branding) applies exactly like
// it does on web, since this IS the web app.
//
// Points at the real production URL, not local dev - a phone can't reach
// "localhost" and mean this computer, so a build shipped to a real device
// has to point somewhere the device can actually reach. This is the same
// URL Vercel serves today; it currently shows "Aziiki needs configuration"
// until the env vars from docs/vercel-deploy-guide.md are set - once they
// are, this exact same built app starts working with no rebuild needed.
// Switching to Cloudflare later (docs/cloudflare-setup-guide.md) or a
// custom domain just means changing this one URL and rebuilding.
const config: CapacitorConfig = {
  appId: "com.aziiki.app",
  appName: "Aziiki",
  webDir: "dist",
  server: {
    url: "https://aziikiunofficial.vercel.app",
  },
};

export default config;
