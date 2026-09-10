export interface DocSection {
  id: string;
  title: string;
  category: "Product & Strategy" | "Tech Architecture" | "Growth & Economics";
  content: string;
}

export const strategistDocs: DocSection[] = [
  {
    id: "prd",
    title: "1. Premium PRD (Product Requirements Document)",
    category: "Product & Strategy",
    content: `
### Aziiki - Product Requirements Document

#### Executive Summary
Aziiki is the ultimate zero-cost, serverless-optimized financial operating system built specifically to address the informal and formal SME sector in Sub-Saharan Africa. By addressing the critical painpoints of freelancers, creative studios, micro-merchants, and boutique agencies, Aziiki provides high-end bookkeeping, invoicing, multi-business management, investments tracking, and smart AI analytics over an ultra-lightweight client database that operates flawlessly in low-connectivity situations.

#### Problem Statement
1. **Financial Disconnection**: Small businesses in Africa struggle to manage split channels of cash flow (Mobile Money, bank receipts, physical ledger notebooks, and cash drawers) in one cohesive terminal.
2. **Punitive SAAS Fees**: Bookkeeping software costing $15–$50/month eats up 5–15% of the average African freelancer's net margins.
3. **No Advisory Services**: Traditional software does not help owners invest excess Ghanaian Cedis or Nigerian Naira to dodge high inflation.

#### Strategic Vision
To empower **10 Million African Entrepreneurs** with absolute financial clarity for **FREE**, sustainable entirely on ultra-targeted, non-intrusive B2B merchant advertisements.

#### Key Features Matrix
* **Multi-Business Profiling**: Support independent ledger state, client contacts, and unique typography palettes.
* **Instant Invoicing, Receipts & Estimates**: Single-click PDF creation, direct auto-conversion, local WhatsApp templates.
* **Granular Cashbook**: Offline-first ledger capturing payment channels (e.g. MTN, Telecel, Cash, Bank Transfer).
* **High-Yield Investment & Net Worth Tracker**: Display indicators for local fixed-income vehicles (such as Ghanaian Treasury Bills).
* **Interactive AI Advisor**: Context-aware recommendations for treasury optimization.
`
  },
  {
    id: "prioritization",
    title: "2. Strategic Feature Prioritization",
    category: "Product & Strategy",
    content: `
### Feature Prioritization Framework (RICE Scoring Matrix)

To guarantee a fast launch while delivering maximum utility, Aziiki adopts a rigorous **RICE (Reach, Impact, Confidence, Effort)** prioritization roadmap:

| Core Requirement Module | Reach (1-10) | Impact (1-10) | Confidence (1-10) | Effort (1-10) | Strategic Priority |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Invoicing & Instant Receipts** | 10 | 10 | 10 | 4 | ⭐ **P0 (V1 MVP Core)** |
| **MoMo + Cash Ledger Engine** | 10 | 10 | 9 | 3 | ⭐ **P0 (V1 MVP Core)** |
| **Customer Directory & Balances** | 9 | 8 | 9 | 3 | ⭐ **P0 (V1 MVP Core)** |
| **AI CFO Advisory (Gemini)** | 8 | 9 | 8 | 5 | ⭐ **P0 (V1 MVP Core)** |
| **African Treasury Tracker** | 7 | 8 | 9 | 4 | ⚡ **P1 (V1.5 Expansion)** |
| **Inventory & Low Stock Alerts** | 6 | 7 | 9 | 5 | ⚡ **P1 (V1.5 Expansion)** |
| **Goal Tracker & Expansion Budgets**| 7 | 6 | 8 | 3 | 💤 **P2 (V2.0 Optimization)**|

#### The "Minimum Viable Product" (MVP) Boundary
As flagged by experienced fintech architects, overloading a launch with 20 half-baked features causes terminal user friction. 

Our **V1 Release (Interactive in this Sandbox!)** is focused exactly on:
1. **Clean Multi-Business Book**: Rapid swap between creative studio and fashion portfolios.
2. **MoMo & Local Tax Engine**: Seamless VAT / Flat margins calculations.
3. **Beautiful PDF Generators**: Custom-branded invoice templates.
4. **CRM Contact Index**: Storing client records and overdue balances.
5. **Generative Business Assistant**: Dynamic Gemini API integration acting as the Aziiki.
`
  },
  {
    id: "competitors",
    title: "3. Direct Competitive Analysis",
    category: "Product & Strategy",
    content: `
### competitive Landscape Audit: Aziiki vs. The World

| Competitor Metric | Wave / QuickBooks | Wave / FreshBooks | Odoo / Zoho Books | **Aziiki** |
| :--- | :--- | :--- | :--- | :--- |
| **Pricing Policy** | $25 - $150/mo subscription | Paid tiers + high add-on costs | Rigid per-app pricing models | **100% Free** (Sustainable Ad-Model) |
| **Internet Target** | High band width, slow loading | Rigid desktop-to-web requirements | Very heavy complex modular loads | **Low Internet / Offline Sync Sync** |
| **Local Currencies** | Multi-currency paid addon | Poor support for GHS & NGN | Complicated secondary ledger config | **Native GHS, NGN, KES, ZAR, USD** |
| **Primary Rails** | ACH, Stripe, credit cards only | Credit Cards, PayPal, Stripe | Standard European banking integrations | **MTN MoMo, Telecel, Orange, Wave, Cash** |
| **AI Advisor** | Basic rule-based static reports | No native generic generative advisor | Complex rigid forecast plug-ins | **Natural language Gemini CFO advisory** |

#### Why Aziiki Wins in Developing Frontiers:
Aziiki cuts out subscription gates and targets the most ubiquitous cash channels—Mobile Money (MoMo) and cash. Unlike QuickBooks which assumes standard bank statement syncs (not available for most mom-and-pop shops), Aziiki registers MoMo transfers with standard receipts.
`
  },
  {
    id: "personas",
    title: "4. Target User Personas",
    category: "Product & Strategy",
    content: `
### Target Customer Profiles (African Context)

#### Persona A: "Kofi", 28 — Creative Director & Photographer (Accra, Ghana)
* **Status**: Sole proprietor of *Kofi Media*, renting gear and hired for weddings/product campaigns.
* **Pain Points**: Generates beautiful photos but sends sloppy WhatsApp messages as "invoices". Customers take up to 90 days to pay via MoMo. Kofi forgets who owes what.
* **Fintech Goals**: Professional GHS invoice generator, automatic tracking of outstanding customer balances, reminder alerts, and converting cash profits into local 91-day Government Treasury Bills.

#### Persona B: "Amina", 34 — Fashion Brand Director (Lagos, Nigeria)
* **Status**: Oversees a modest custom clothing team of 4 tailors in Ikeja.
* **Pain Points**:Amin has variable fabric material costs (fluctuating with Naira rate changes). She manages multiple client measurements, deposits, and delivery status updates simultaneously.
* **Fintech Goals**: Multi-business partitioning (she also runs a direct model academy), robust material expense sheets, cashflow reports to track weekly margins, and visual inventories.
`
  },
  {
    id: "schema",
    title: "5. Production Database Schema",
    category: "Tech Architecture",
    content: `
### Relational PostgreSQL Schema (Supabase, RLS-enforced)

Below is the optimized **Drizzle / PostgreSQL ORM** database definition designed to maintain perfect balance isolation across multi-business accounts:

\`\`\`typescript
// Schema Definition (src/db/schema.ts)
import { pgTable, uuid, text, numeric, timestamp, varchar, integer, boolean } from 'drizzle-orm/pg-core';

// Users table managed via Supabase Auth (auth.users); profiles extend it 1:1
export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  email: text('email').notNull(),
  pinHash: varchar('pin_hash', { length: 256 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Separate entities table for multi-business operations
export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultNow(),
  ownerId: varchar('owner_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  industry: varchar('industry', { length: 100 }),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#0f172a'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0.00'),
  currencyCode: varchar('currency_code', { length: 3 }).default('GHS'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Consolidated Ledger Cashbook Bookkeeping
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultNow(),
  businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 10 }).notNull(), // 'income' | 'expense'
  category: varchar('category', { length: 100 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  paymentMethod: varchar('payment_method', { length: 50 }).default('Mobile Money'), 
  customerId: uuid('customer_id'),
  proofFilePath: text('proof_file_path'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Custom CRM profiles
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultNow(),
  businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  email: varchar('email', { length: 150 }),
  phone: varchar('phone', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
\`\`\`
`
  },
  {
    id: "architecture",
    title: "6. Full-Stack Tech Architecture",
    category: "Tech Architecture",
    content: `
### System Architecture Diagram (Core Blueprint)

\`\`\`
                     [ REACT + TAILWIND WEB / FLUTTER CUSTOM MOBILE CLIENT ]
                                        | (Offline First Sync Engine)
                                        v
                 [ NGINX REVERSE PROXY / INGRESS TRAFFIC PORT 3000 ]
                                        | 
                                        +-------------------------------------+
                                        |                                     |
                                        v                                     v
                       [ NODE / EXPRESS API LAYER ]             [ SUPABASE AUTH SERVICE ]
                                |                                     |
                                v                                     v
                [ Gemini-3.5-Flash Insights Engine ]         [ Postgres Row Level Security ]
                                |                                     |
                                +------------------+------------------+
                                                   |
                                                   v
                                  [ SUPABASE POSTGRES (RLS on every table) ]
                                       - Isolated Business Ledgers
                                       - Realtime Streams
\`\`\`

#### Architectural Strategies:
* **JSON Encryption**: All local caches in browser IndexedDB/SQLite are AES-256 encrypted prior to remote persistence syncs.
* **Lazy SDK Loading**: Our Server-Side Gemini API SDK is initialized only on active POST events, keeping background memory footprint under 90MB on Cloud Run.
`
  },
  {
    id: "mobile",
    title: "7. Mobile Architecture (Flutter)",
    category: "Tech Architecture",
    content: `
### Android / iOS Architecture: Cross-Platform Flutter Setup

To deploy Aziiki successfully as native Android & iOS codebases, we configure a secure clean system using Flutter:

* **Presentation Layer (BLoC Pattern)**: Separate Business Logic components control screen states (Loading, Error, Active) to prevent frame drops in low-end hardware.
* **Data Layer (Offline-First Hive DB)**: High-speed, lightweight key-value database storing all ledgers locally.
* **Synchronization Worker**: A background thread utilizing \`WorkManager\` (Android) and \`BackgroundFetch\` (iOS) runs sync algorithms only when Wi-Fi/Cellular connectivity is validated, preserving MoMo user battery and data. 
* **Native Bridges**: MethodChannels route biometric fingerprints, FaceID APIs, and camera scans to verify cash ledger updates safely.
`
  },
  {
    id: "api_structure",
    title: "8. Enterprise API Structure",
    category: "Tech Architecture",
    content: `
### RESTful API Contract Specification

All payloads are parsed synchronously through authentication middleware validating a \`Bearer <Supabase access token>\` against Supabase Auth, then executed through a request-scoped Postgres client so Row Level Security applies to every query.

#### A. Multi-Business Creation
* **Endpoint**: \`POST /api/businesses\`
* **Payload**:
\`\`\`json
{
  "name": "Kofi Media Services",
  "industry": "Photography",
  "currencyCode": "GHS",
  "primaryColor": "#D97706"
}
\`\`\`
* **Response**: \`201 Created\` containing the generated client-side UUID reference.

#### B. Dynamic AI Business Diagnosis
* **Endpoint**: \`POST /api/gemini/insights\`
* **Payload**: Sends total aggregated business records, cash reserves, and custom text inputs.
* **Response**: Returns categorized ratings and advisory responses.
`
  },
  {
    id: "monetization",
    title: "9. Zero-Free Monetization Strategy",
    category: "Growth & Economics",
    content: `
### Sustainable Free-Tier Strategy (B2B Marketplace)

Aziiki remains **completely free for users** while maintaining financial viability via:

#### 1. Sustainable Ad Network (Low-Intrusion B2B)
* Instead of blinking consumers banner ads, display highly non-intrusive target banners on dashboard gutters.
* **Example Partners**: GCB Bank (Ghana), MTN MoMo Merchant suites, PiggyVest (Nigeria), local corporate tax preparers, and hardware suppliers.
* **Rule**: Ads are *strictly barred* from appearing on generated invoices, receipts, and user reports.

#### 2. Local Treasury Spreads
* Facilitate mutual-funds/GHS-T-Bill acquisitions directly inside Aziiki through partnered micro-brokerages.
* Aziiki earns a minor 0.15% facilitation fee from the asset operator without touching user capital profits.

#### 3. B2B Wholesale Leads
* Connect raw photography businesses to camera equipment wholesalers, retaining affiliate referral commission on executed invoices.
`
  },
  {
    id: "launch_roadmaps",
    title: "10. Strategic MVP Launch Roadmap & Timelines",
    category: "Growth & Economics",
    content: `
### MVP Launch Plan (W-1 to W+12 Project Timeline)

#### Phase 1: Core Build (Weeks 1 - 4)
* Establish client architecture, offline indexed boxes, local storage models.
* Deliver multi-business template engines (Invoices / Receipts / Estimates).

#### Phase 2: AI Assistant & Optimization (Weeks 5 - 8)
* Interface Gemini REST routes executing custom SME cashflow analytics.
* Set custom payment workflows (MoMo / cash splits).

#### Phase 3: Accra & Lagos Beta Rollout (Weeks 9 - 10)
* Select 200 Creative Freelancers & Boutique Fashion Owners for stress-testing.
* Validate PDF export compliance inside standard WhatsApp Messenger.

#### Phase 4: Production Expansion (Weeks 11 - 12)
* Public deployment onto Android Play Store & iOS App Store.
* Initiate growth viral campaigns centered around corporate finance spreadsheet migration challenges.
`
  }
];
