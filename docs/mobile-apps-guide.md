# Aziiki Mobile Apps (Android + iOS)

Real, installable native app projects, built with [Capacitor](https://capacitorjs.com/)
- the same technique many companies use to ship their existing web app as a
real Android/iOS app without a rewrite: your actual React app runs inside a
native shell with a real app icon, splash screen, and Play Store/App Store
listing.

## How it's wired up

`capacitor.config.ts` points the app at a URL (`server.url`) instead of
bundling the web assets offline - the native shell just displays your real
website, the same way it would in a phone's browser, except as its own app.
Every admin setting (feature flags, PostHog, pricing, branding) applies
automatically, because it *is* the web app - there's no separate mobile
backend to keep in sync.

Right now that URL is set to `http://localhost:5173` (your local dev
server), for building and testing before a production URL exists.

### Before you ship: point it at your real deployment

Once your Vercel or Cloudflare deployment is live (see
`docs/vercel-deploy-guide.md` / `docs/cloudflare-setup-guide.md`), edit
`capacitor.config.ts`:

```ts
server: {
  url: "https://your-real-domain.com",
  cleartext: false, // true was only for local http:// testing
},
```

Then re-sync and rebuild (see below).

## Android

**Status: buildable right now**, tools installed this session (Android SDK
command-line tools, Java). No Apple/Google account needed for a local debug
build - just Google Play's own account when you're ready to actually publish.

```bash
npm run build                    # rebuilds dist/, in case anything changed
npx cap sync android             # copies the latest web build into the native project
cd android
./gradlew assembleDebug          # builds an installable .apk
```

The `.apk` lands at `android/app/build/outputs/apk/debug/app-debug.apk` -
install it on a real Android phone (enable "Install from unknown sources"),
an emulator, or send it to someone to sideload. This is a debug build,
fine for testing; **publishing to the Play Store** needs a signed release
build and a one-time $25 Google Play Developer account - a separate,
deliberate step once you're happy with how it works.

To open the project in Android Studio itself (installed this session too):

```bash
npx cap open android
```

## iOS

**Status: scaffolded, not yet buildable** - the native iOS project exists
(`ios/`), but actually compiling it needs the full **Xcode** app, not just
the Command Line Tools that were already on this machine. Xcode is a ~15GB
download from the Mac App Store that needs your Apple ID signed in - that's
the one step here I genuinely can't do for you (a `sudo`/admin password
prompt only you can answer, and I won't ask for or enter your Apple
credentials).

**What to do:**
1. Open the **App Store** app on this Mac (already shows other apps
   installed under this Apple ID, so it should already be signed in).
2. Search for **Xcode**, click **Get** / the cloud-download icon.
3. Wait for it to finish (large download - can take a while).
4. Open Xcode once, so it finishes its own first-launch setup and installs
   its additional components.
5. Come back and say so - I'll take it from there: build the iOS app,
   verify it in the Simulator, and hand you a real `.app`/`.ipa`.

Once Xcode is installed, the build itself is:

```bash
npm run build
npx cap sync ios
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
  -destination "generic/platform=iOS Simulator" build
```

Or, more simply, open it in Xcode directly and press Run:

```bash
npx cap open ios
```

**Publishing to the App Store** additionally needs a paid ($99/year) Apple
Developer account and code signing - also a separate, deliberate step once
you're ready, not something needed for testing.

## App identity

Both platforms share one app identity, set in `capacitor.config.ts`:
- **App ID**: `com.aziiki.app`
- **App name**: Aziiki

Change the app icon/splash screen with
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) once
you have a final logo file - not done yet, both platforms are using
Capacitor's default placeholder icon for this first build.
