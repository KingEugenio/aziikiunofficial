# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [1.19.0] - 2026-08-17

### Storage footprint reduction
Found the real cause: logo uploads (both the invoice builder's issuer logo and the business profile logo) stored the raw uploaded file as base64 with zero resizing - a phone-camera photo used as a "logo" (often several MB) got stored at full size. Added `src/lib/imageCompress.ts` - resizes to a 400px max dimension and re-encodes (PNG for likely-transparent logos, JPEG at 0.82 quality otherwise) before ever becoming a data URL, skipping recompression for already-small files. Wired into both upload paths. Typically brings a multi-megabyte upload under 100KB.

### Purple colors → navy/teal
Audited properly - only 10 instances across 4 files (`AppGuide.tsx`, `BusinessDashboard.tsx`, `FinancialReports.tsx`, `NetWorthInvestments.tsx`). All replaced with the real brand tokens (`--color-brand-navy` / `--color-brand-teal`). Confirmed zero purple/violet/fuchsia remain anywhere in the codebase.

### Emoji → SVG icons (large, multi-version effort)
Got an accurate count first: **227 emoji instances across 17 files**. This version completes two of the largest:
- **`BusinessDashboard.tsx`** (7 instances) - fully done.
- **`App.tsx`** (61 → 18 remaining) - every decorative UI emoji converted to a real Phosphor icon (close buttons, toggles, headings, alerts, workspace category picker). The 18 remaining are a deliberate, documented exception - see below.
- **`InvoiceReceiptBuilder.tsx`** (43 → 4 remaining, same exception) - all 8 tab labels, all invoice/receipt/estimate status badges, ledger headings, signature displays, and even two checkmarks inside the actual receipt document design (visible to clients in PDFs/prints) converted to real icons.

**Deliberate exception, not an oversight**: both files have a small number of remaining emoji (💼🪡👤📸🎪🥐🛒🚘🏗️✦👁☊) that function as **stored data values** in a "preset logo" system - businesses without an uploaded image get a simple emoji character as their `logo` field, already persisted this way for existing businesses in the live database. Converting this to a different data format would need a backward-compatible migration (existing businesses' stored `logo` values would need to keep resolving correctly), which wasn't done this pass to avoid a risky, untested data-model change bundled into a branding-only task. The dropdown picker labels for this system had their emoji stripped (a `<select><option>` element cannot render an SVG icon at all - a hard browser limitation, not a code gap).

### Still remaining (in order)
- `PersonalWorkspace.tsx` (33 instances)
- `NetWorthInvestments.tsx` (32 instances)
- `AppGuide.tsx` (23 instances)
- 8 smaller files (`AIFieldAssistant.tsx`, `AdMonetizationHub.tsx`, `FinancialReports.tsx`, `ErrorBoundary.tsx`, `CustomerCRM.tsx`, `InventoryManager.tsx`, `onboarding/Phase2Aha.tsx`, `TemplateGallery.tsx`, `SignatureCapture.tsx`, `onboarding/QuestionCard.tsx`, `onboarding/ProgressBar.tsx`)

## [1.18.0] - 2026-08-17

### Group A (from the 12-item SEO/technical list) + Custom 404 page

**Built new:**
- `public/robots.txt` - allows crawling the entry point, disallows `/api/`.
- `public/sitemap.xml` - one real public URL (this is a login-gated SPA; everything past login is client-side app state, not separate indexable pages).
- `src/components/PrivacyPolicy.tsx` - real, specific content (what's actually collected, how business data isolation works, what the AI advisor does and doesn't send), not generic boilerplate. Reachable via a link at the bottom of the login/signup screen.
- `src/components/NotFoundPage.tsx` - a proper branded 404 instead of a blank screen, shown when someone lands on a path other than `/` (this being a single-page app, any other path is a broken/stale link, not a real route).

**Checked and confirmed already done (no changes needed):**
- Unique page title + Open Graph/Twitter card metadata - already present and correct in `index.html`.
- Alt text on images - audited every `<img>` tag in the codebase (a naive grep first gave false positives from JSX comments containing the literal text "<img>" - re-checked properly); every real image tag already has descriptive alt text.
- Rate limiting on forms - already comprehensive: a global limiter covers every `/api/` route, with tighter dedicated limits on login/signup/password-reset on top of that.

### Still outstanding
- Emoji → SVG icon replacement app-wide (large, not started this pass)
- Storage footprint reduction (KB not MB) - logo-as-base64 is the leading suspect, not yet investigated
- Purple colors → navy/teal brand palette
- Group B items awaiting your answer on marketing-site vs in-app scope: internal linking, thank-you page, FAQ, map & directions

## [1.17.0] - 2026-08-17

### Changed - item 3 of the branding/iconography list: Igbo → Hausa brand story
`AppGuide.tsx`'s "Cultural Origin & Meaning" chapter previously claimed "Aziiki" is Igbo for "youthful" or "vigorous" - an unverified etymology. Replaced entirely with the researched, well-sourced Hausa word **"arziki"** (wealth, riches, prosperity - confirmed across Wiktionary, HausaDictionary.com, and Behind the Name), framed correctly as the product's conceptual inspiration, not a claim that "Aziiki" and "arziki" are the same word. Product name stays Aziiki throughout, per the brief - "arziki" is explained as inspiration, not a rename.

Confirmed via full codebase search: zero remaining mentions of Igbo, "youthful," or "vigorous" anywhere in the app. Kept the pronunciation guide as-is (it's about saying "Aziiki" itself, unrelated to the etymology claim being replaced).

### Remaining list, in order
1. Audit emoji usage (real count, not a guess) - not started
2. Replace all emojis with real SVG icons app-wide, matching meaning
3. ~~Igbo → Hausa brand story~~ - done this version
4. Onboarding + login/signup copy - light Aziiki/arziki introduction (checked: neither currently references the old Igbo content, so this is a clean addition, not a fix)
5. Metadata audit - page title, PWA manifest, Open Graph, SEO description
6. Reduce storage footprint (KB not MB) - logo-as-base64 is the leading suspect, not yet investigated
7. Purple colors → navy/teal brand palette
8. Final QA pass

## [1.16.0] - 2026-08-17

### Working through a 6-item list, 1 and 2 done this pass (3-6 next)
1. **Added the two Gemini API keys** (`GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`) to `.env` - the failover logic from last version was already built, this just activates it with real keys.
2. **Past Ledger entries are now clickable.** Clicking/tapping any past invoice, receipt, or estimate card loads its real data into the same live preview (`#mockup-document-view`) used when creating a document fresh - customer, line items, amounts, dates, status, currency, the actual document number. From there, the exact same Print / Download PDF / WhatsApp Share buttons that already exist just work, since they already operate on whatever's currently in the preview. No separate "viewer" component was needed - the live preview already is one once it's fed real data instead of a blank form. The "Mark as Paid" button inside each invoice card got `stopPropagation()` so clicking it doesn't also trigger loading that invoice into the builder.

### Still to do (3-6), in order
3. Reduce per-record storage footprint (KB not MB) - investigating the logo storage approach first, since a base64 image sitting directly in a database text column is the most likely culprit.
4. Replace emoji icons with real SVG icons app-wide.
5. Fix purple colors to match the app's actual navy/teal brand palette.
6. Remove Igbo text from the app (found real Igbo content already written into `AppGuide.tsx`, including an unverified etymology claim - "Aziiki" = "youthful/vigorous" - that needs checking, not just deleting), replace with the researched Hausa "Arziki" content from last version.

## [1.15.0] - 2026-08-17

### Fixed - Past Ledger blank white screen
Found two real, distinct crash sources, plus a systemic gap that made every crash total instead of contained:
- `InvoiceReceiptBuilder.tsx`'s Past Ledger view called `.startsWith(...)` and `.toLocaleString(...)` directly on `customerId`/`amountPaid`/`totalAmount` fields with no null-guard. Any receipt or estimate with a missing/legacy value for those fields (plausible for older records, or anything created before certain fields were required) threw an uncaught `TypeError`, crashing the render.
- `calculateInvoiceTotals()` in `money.ts` called `items.reduce(...)` with no check that `items` was actually an array - same crash risk for any invoice with a malformed items field.
- **There was no error boundary anywhere in the app.** That's what turned a bug in one small section into a completely blank white screen with zero explanation - any uncaught error, anywhere in the render tree, took down the whole app with nothing shown to the user and nothing logged anywhere they could see. Added `ErrorBoundary.tsx`, wrapping the whole app in `main.tsx`: any future error anywhere now shows a real "Something went wrong" screen with the actual error message and a Try Again / Reload option, instead of a blank tab. This doesn't replace fixing bugs where they're found - it's what stands between "one bad record" and "the entire app is unusable."

### Added - Gemini API key failover
Added support for up to two additional Gemini API keys (`GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` in `.env`, both optional). New `src/server/geminiClient.ts` tries each configured key in order, automatically retrying with the next one specifically when a key is rate-limited or over quota (HTTP 429/503) - a genuinely different kind of error (bad request, invalid model) is thrown immediately rather than retried, since a different key would fail the same way. All three AI routes (`/insights`, `/chat`, `/live-investments`) now go through this shared failover path instead of instantiating their own client directly.

**Important caveat, worth understanding before setting this up**: this only adds real capacity if the extra keys come from separate Google Cloud/AI Studio projects with independent quota. Keys generated inside the same project typically share one quota pool - in that case, rotating between them spreads the same limit across more keys rather than increasing it. Documented directly in `.env` and in the code.

### Researched - Hausa naming
Checked for a genuine Hausa-language angle to pair with "Aziiki" (previous research found no verified independent Hausa word "Aziiki" itself, only a well-attested Igbo connection via Azikiwe). Found a real, well-sourced option this time: **"Arziki"** (Hausa, from Arabic "rizq") means wealth, riches, provision, and prosperity - confirmed across Wiktionary, HausaDictionary.com, and Behind the Name, and it's also used as a Hausa given name. It's phonetically close to "Aziiki" without being a false claim that they're the same word - a legitimate "inspired by / resonates with" branding device, not fabricated etymology. Not applied to any UI copy yet - exact wording is a branding call, left for confirmation before writing it into the product.

## [1.14.0] - 2026-08-16

### Fixed
- **"Android/iOS App" was a false claim on the login page.** There is no native mobile app - Aziiki is a web app. Removed the badge and replaced it (and the space it occupied) with a genuine, honest feature list of what Aziiki actually does (income/expenses, invoices/receipts, customers, inventory, AI insights) - real product education instead of a platform claim that wasn't true.
- **A real, serious document-access ceiling, found across five separate queries**: invoices, receipts, quotations, and customers were all capped at 2,000 rows (and their line-item tables at 20,000), ordered newest-first with nothing to page through the remainder. Once a business's history crossed that line, its *oldest* documents would silently stop being returned - not an error, not a warning, they'd just no longer be there. Worse, `sync.ts`'s own invoices/receipts/quotations/customers queries had **no explicit limit at all**, which meant they were silently subject to whatever Supabase/PostgREST's default per-request row cap is (commonly 1,000) - an invisible limit that wasn't even visible by reading this codebase. Made every one of these explicit and raised generously (50,000 documents, 200,000 line items) so a genuinely long-running SME's full multi-year history fits comfortably. Also fixed a related knock-on effect: if a customer record itself fell out of a capped list, their name would silently start showing as "Direct Buyer" on their own past invoices even if the invoices were still visible - same underlying bug, different symptom.
- Fixed the same 2,000-row cap in the shared CRUD factory used by customers and other resources, for consistency.

### Honest caveat
These are generous fixed caps, not true unlimited pagination. A business that somehow exceeds 50,000 invoices would need real cursor-based pagination in a proper Document Center (part of the larger document-management spec from a couple of versions ago, not built yet) rather than one large bulk fetch. For the realistic range this product is built for - an SME's full history, even across many years - this fix removes the actual, practical risk of documents disappearing.

## [1.13.0] - 2026-08-16

### Context
Received a detailed diagnosis (written by another AI, cross-checked against the product) claiming the AI advisor's problems stemmed from a broken "identity/context" architecture - i.e. that business data was leaking across businesses at the data layer. Verified this against the actual code before acting on it, since the proposed fix (a full account→workspace→business→permissions rebuild) would have been a large, risky undertaking if the premise was wrong.

### What I verified was already correct (did not change)
- `AIFieldAssistant.tsx` (the component that actually powers the live CFO AI Advisor) computes every figure it sends to the AI - revenue, expenses, outstanding invoices, transactions - by filtering `transactions`/`invoices`/etc. by `currentBusiness.id` first. There is no cross-business leakage in what data reaches the AI. The "account → business → isolated data" architecture the diagnosis called for already exists and is correctly wired.
- Grepped the whole codebase for `FOFU` and `PocketCFO` - zero matches anywhere. Already clean from earlier sessions.

### Fixed - the real root cause: the prompt itself, not the data pipeline
`src/server/routes/gemini.ts`'s `/insights` endpoint (the one `AIFieldAssistant.tsx` actually calls) had real, correctly-scoped data - but the prompt around it had none of the discipline needed to use it consistently:
- No identity rules at all - nothing stopped the model from opening with "Welcome to EKO PIXELS! I am your virtual finance director," conflating the business with the AI's own identity, or picking a different title each time ("CFO," "field assistant," "strategic advisor").
- No instruction against inventing figures, discussing businesses not in the current context, or speculating about the app's technical architecture (database, storage) when it wasn't told anything about it.
- No resistance to prompt injection, and no instruction never to reveal its own system prompt.
- **A stale reference to deleted seed data**: the prompt still told the AI to tell users about "our pre-populated example details ('Kofi Media Services', etc.)" - data that was removed from the app entirely in an earlier session. The AI was being instructed to describe example data that no longer exists.

Rewrote the prompt with explicit identity, accuracy, and security rules, and split it into a real `systemInstruction` (rules + product guide) separate from the user-turn content (the actual business data + query) - `systemInstruction` is a genuine, separate channel in the Gemini SDK (`GenerateContentConfig.systemInstruction`), which is real protection against a message trying to talk over the rules, not just asking nicely in the same string. Applied the identical treatment to the `/chat` endpoint (Personal Workspace's AI coach), which previously sent the raw user message to Gemini with **zero** system prompt at all - currently hidden behind `MVP_MODE` so not reachable in the live app, but fixed now rather than left as a latent gap for whenever it's re-enabled.

### Not done this pass
The source diagnosis also called for: a redesigned login/signup education screen, a full "Aziiki Academy" app guide, a canonical structured product-knowledge base the AI queries from, and an automated test suite covering identity/isolation/security/accuracy. None of that was built this pass - the priority was fixing the actual verified bug (prompt discipline) rather than building a large new subsystem on a premise (data-layer leakage) that didn't hold up under inspection.

## [1.12.0] - 2026-08-15

### Fixed
- **The stray "E" beside a business's logo, root-caused, not CSS-hidden**: the business switcher dropdown always prepended a glyph before the business name in each `<option>` - for businesses with a plain emoji logo that's an intentional bullet (e.g. "🪡 Amina Fashion Couture"). For businesses with a real uploaded image logo, `businessLogoGlyph()`'s fallback (the business's first initial, since `<option>` elements structurally cannot render an `<img>`) was *also* being prepended - right next to the actual real logo `<img>` already shown beside the dropdown. Result: "E EKO PIXELS (GHS)" instead of "EKO PIXELS (GHS)". Fixed at the source in `App.tsx` - the glyph is now only prepended for emoji-logo businesses; image-logo businesses show their name plainly since the real logo is already visible right next to it.
- **Past Ledger only ever showed invoices, regardless of which document type was selected**: this was unconditional - switching to Receipt or Estimate mode and opening Past Ledger still showed the invoices list (or an invoices-specific empty state) with no way to see previously issued receipts or estimates at all. `receipts` and `quotations` were already available as props and already correctly persisted via the numbering/save fixes from the previous version - they just had no matching UI. Added two new list views, structurally mirroring the existing invoice list (same card layout, real status badges, real customer linkage), gated on `mode === "receipt"` / `mode === "quotation"` respectively.

### Removed - not disguised, fully removed
- **The "PDF Intake" / "Aziiki Intelligent OCR" feature.** On inspection this never read the uploaded file's actual content at all - it string-matched the *filename* for a few keywords ("mtn", "supplier", etc.) and otherwise fabricated a random client name and dollar amount from a hardcoded list, behind a fake animated progress bar reading "Aziiki Intelligent OCR Active" and a "READY" badge implying real extraction had occurred. It included a "Populate Editor fields using OCR" button that would write that fabricated data directly into a real, saveable invoice/receipt/estimate - a genuine risk of a business owner unknowingly issuing a financial document built on fictional numbers. Per the explicit instruction not to fake this functionality, and since building genuine OCR is out of scope for this pass, removed the tab, its UI, and all supporting state/handlers entirely rather than relabeling or disclaiming it. Confirmed no dangling references anywhere in the codebase after removal, and the component's built bundle size dropped accordingly (~9kb smaller), confirming real code came out, not just a hidden UI element.

## [1.11.0] - 2026-08-15

### Scope note
The request this version addresses was another large, app-wide specification - full document management, history, and numbering. Audited the existing architecture first (as instructed) and found the atomic numbering system already existed and was well-built (`next_document_number()`, a Postgres function using row-locked `UPDATE...RETURNING` for true concurrency safety, plus DB-level `unique(business_id, document_type_number)` constraints as a backstop) - it just wasn't actually being used at save time. Fixed that real bug rather than building a second, parallel numbering system next to a good one.

### Fixed - the numbering system existed but was being bypassed
- **Root cause**: `InvoiceReceiptBuilder.tsx` calls `/api/document-numbering/peek` on mount to show "next number will be INV-0042" while the form is being filled out. That's a **read-only preview that reserves nothing**. The bug: the save handlers (`handleSaveInvoice`/`Receipt`/`Quotation`) then submitted that same previewed value as the actual `invoiceNumber`/`receiptNumber`/`quoteNumber` field, which made the server's own atomic-reservation code path (`if (!invoiceNumber) { reserve one }`) skip itself entirely, since the field was never empty. Two people (or two tabs) peeking around the same time would both see the same "next" number and could both submit it - exactly the race condition the numbering system's own code comments already warned against, just not actually prevented in practice.
- `App.tsx`'s `handleAddInvoice` / `handleAddReceipt` / `handleAddQuotation` no longer forward the client-peeked number to the server at all - the server now always atomically reserves one via `next_document_number()`, on every save, no exceptions.
- **`quotations.ts`'s convert-to-invoice endpoint had the same bug in a worse form**: it *required* a client-supplied `invoiceNumber` (no server-side fallback at all), and `App.tsx` was computing it as `INV-2026${invoices.length + 101}` - a hardcoded year and an array-length-based number, which isn't just race-prone, it actively produces wrong/duplicate numbers the moment any invoice is ever deleted or two people convert around the same time. Removed `invoiceNumber` from the endpoint's accepted input entirely; it now always reserves atomically server-side, matching regular invoice creation.
- Along the way, found and fixed the same "shows success before the server confirms anything" pattern from earlier sessions (CRM, Warehouse Stock) also present here: saving an invoice/receipt/estimate, and converting an estimate to an invoice, both showed a success toast and updated the UI optimistically *before* (or regardless of whether) the server call actually succeeded. All four save paths now properly `await` the server, show the *server-confirmed* document number (not the pre-save guess) in the success message, and show a real error if the save fails instead of silently claiming success.

### Not done this pass (full spec was much larger than this)
The submitted spec also called for: a dedicated Document Center UI (list/search/filter/archive across all three document types), a numbering-format settings screen (custom prefixes/padding/yearly-reset UI - the backend already supports arbitrary prefix and padding per business+type, just no settings UI to configure it beyond what's already in Brand Kit), a numbering audit-trail log, and richer document-relationship displays ("Created from Estimate X" on invoices, full customer document history view). None of that was touched this pass - the highest-value, most urgent thing was fixing the actual duplicate-number risk, which is a real financial/legal integrity issue, before adding more UI on top of a numbering flow that could still silently misfire. Happy to continue with the Document Center UI next if useful.

## [1.10.0] - 2026-08-15

### Scope note
The request this version addresses was a large, app-wide skeleton-loading specification. Audited what already existed, then built and wired real, page-shaped skeletons into the highest-value, genuinely-loading surfaces rather than spreading thin with shallow stubs everywhere. See "Not done this pass" below for what's honestly still open.

### Added (`src/components/Skeleton.tsx`)
Five new page-shaped composites, each modeled on the actual layout of the screen it represents (per the spec's core rule: skeleton must match final UI, not reuse one generic shape everywhere):
- `SkeletonCRM` - search + client list on the left, detail panel on the right, matching Customer CRM's real two-panel layout (previously had no skeleton at all - it wasn't even lazy-loaded).
- `SkeletonInventory` - product card grid with a stock-level bar per card, matching Warehouse Stock's real layout (previously had no skeleton at all - also wasn't lazy-loaded).
- `SkeletonBillingBuilder` - form on the left, live document preview at real A4 proportions on the right, matching the Invoice/Receipt/Estimate builder. Previously this used a generic `SkeletonTable`, which looks nothing like the builder's actual layout.
- `SkeletonReportsCharts` - stat cards plus chart-shaped (staggered bars, not a flat rectangle) placeholders, matching Reports & Wisdom. Previously reused the dashboard skeleton.
- `SkeletonAppShell` - sidebar + top banner + dashboard-shaped content area, replacing the centered spinner + "Syncing SME Ledger Node" text that previously showed during session restore/initial sync. That spinner pattern is exactly what the spec calls out to avoid - it gave no sense of the page about to appear.

### Changed (`src/App.tsx`)
- `CustomerCRM` and `InventoryManager` converted from eager imports to `lazy()` - genuine code-splitting, confirmed each now builds as its own separate chunk. Previously there was no Suspense boundary for either, so there was nowhere for a loading state to attach even if one existed.
- Billing, CRM, Warehouse Stock, and Reports tabs now use their matching page-shaped skeleton as the `Suspense` fallback instead of a generic or mismatched one.
- Session-restore/initial-sync screen now shows `SkeletonAppShell` instead of a spinner.

### Changed (`src/index.css`)
- Added `@media (prefers-reduced-motion: reduce)` handling for the shimmer/pulse animations - previously absent despite being explicitly required. Motion stops, the skeleton shapes themselves remain visible.

### Not done this pass (scope honesty, not oversight)
- **Per-component data-loading states** (as opposed to route-level code-loading, which is what's fixed above) are largely not applicable in this app's actual architecture: `App.tsx` fetches everything for a business in one batched request at login/business-switch (`api.sync.fetchAll()`), gated by the app shell skeleton above. By the time any individual tab mounts, its data already exists in memory - there generally isn't a second, separate "this one section is still loading" moment inside CRM, Inventory, or Reports for a skeleton to cover. `LoadingSwap` already exists and is already used correctly in the handful of places that *do* have their own independent fetch (`BrandKitSettings`, `ExchangeRateSettings`, `TeamManager`, `PurchaseOrderManager`, `TemplateGallery`).
- Modals/drawers, workspace-switching transitions, and form-submission button states were not audited/rebuilt this pass - most form submits already show a "Saving..." disabled-button state from earlier sessions' fixes (CRM, Inventory, Brand config), but this wasn't re-verified against the full spec's checklist.
- Did not build the full `pages/` directory structure the spec sketches (`DashboardSkeleton.tsx`, `IncomeSkeleton.tsx`, etc. as separate files) - kept the five new composites in the existing `Skeleton.tsx`, consistent with how the five pre-existing ones are organized, rather than restructuring the file layout as a side effect of this change.


## [1.9.2] - 2026-08-14

### Fixed
- Removed "Supabase Secured" badge and all "Supabase Auth" / "Postgres" mentions from the login/signup page (`AuthPortal.tsx`) - a public login page is a reasonable place for attackers to poke around, and naming your exact backend stack there is free reconnaissance for them with no benefit to you. Kept the reassuring copy ("your data is protected, row-level access controls, real database"), just without naming the specific vendor. Checked the rest of the app for the same pattern - the only other mentions of "Supabase" left are in code comments, which never reach the browser.
- Fixed a duplication bug in the sync error message from last version - it was showing `[table: businesses] [table: businesses] Could not find the table...` (the table name was being prefixed twice, once when the error was thrown, once again when caught). Now shows it once.

### Confirmed root cause (needs your action, not a code fix)
Your own screenshot's error message is now specific enough to be definitive: **`Could not find the table 'public.businesses' in the schema cache`**. This is the most fundamental table in the whole schema - if it doesn't exist, nothing else can work, which explains every symptom reported across the last several rounds (empty workspace, brand changes failing, CRM/stock "still syncing"). This confirms migrations have not been applied to your live Supabase project - having the `.sql` files in this repo isn't enough, they need to actually run against your project's database. See the note at the end of this response for exact steps.


## [1.9.1] - 2026-08-14

### Fixed - found the actual root cause via real console output
The screenshots this session showed the real Chrome console for the first time: 400 errors on `/api/document-numbering`, `/api/exchange-rates`, `/api/notifications`, `/api/payments`, and the red banner from last version correctly firing with "Failed to load your data. Please try again shortly." That last message is the actual smoking gun.

- **`src/server/routes/sync.ts`**: this route queries ~19 tables in parallel (`businesses`, `customers`, `invoices`, `inventory`, etc.) to build the whole app's initial state in one request. It was throwing the *first* Postgres/PostgREST error it hit, but only logging which table server-side (in your terminal, which you can't easily see) - the browser only ever got the generic "Failed to load your data" text. **Now the specific table name and the underlying database error are included directly in the response**, e.g. `Failed to load your data: [table: customers] Could not find the table 'public.customers' in the schema cache`. Hit Retry on the red banner and the exact cause should now be visible on screen.
- This one route failing is why `businesses` stayed empty for the whole session, which is why "Apply Brand Changes" couldn't find a business to update, and why Customer CRM / Warehouse Stock both said "still syncing" - all the same root cause as last version, just now we can see specifically *why* the sync itself was failing instead of only that it was.
- Guarded four fetches in `InvoiceReceiptBuilder.tsx` (document numbering preview x3, exchange rates) that were firing on page load with an empty `businessId` and getting 400s back - matching the empty-business-placeholder state from last version. These now simply wait for a real business to exist rather than firing prematurely and cluttering the console.

### What to do next
Hit **Retry** on the red banner and read the specific message this time - it will tell us exactly which table or permission is the problem. If it says something like `[table: customers] Could not find the table 'public.customers' in the schema cache`, that confirms migrations haven't been fully applied to your live Supabase project (see the very first session's notes on running `supabase db push` or reloading the schema cache from the Supabase dashboard).

## [1.9.0] - 2026-08-13
## [1.8.0] - 2026-08-12
## [1.7.0] - 2026-08-11
## [1.6.0] - 2026-08-10
## [1.5.0] - 2026-08-10
(See previous entries.)
