# Signal — Bulk SMS Console

A consent-based bulk SMS console built on **Next.js 16** (App Router) + **shadcn/ui** (Base UI preset, "base-nova"). Mock-first architecture so providers, HLR, and payment can be swapped for real services.

## Quick start

```bash
npm install
npm run dev   # http://localhost:3000
```

Node 20+ recommended. Type-check with `npx tsc --noEmit`.

## Pages

| Path | What it does |
|---|---|
| `/` | Dashboard — account balance + Top Up, KPI stat cards, sending-trend area chart, delivery-rate radial, recent campaigns, contact groups |
| `/send` | **Send Now** — named one-off blast: message + recipient sources (groups / HLR reports / manual) + sender ID, two-step confirm with cost estimate |
| `/hlr` | **HLR Lookup** — named lookups against a mock HLR; persists as HLR reports (Excel export, history list/detail) |
| `/report` | **Reports** — per-campaign delivery report with 5-status breakdown (sent / failed / pending / invalid / unknown), Excel export |
| `/contacts` | Groups list → group detail. Create groups with bulk number import; add numbers to a group later |
| `/templates` | Message templates with `{{name}}` / `{{phone}}` placeholders |
| `/logs` | Per-message delivery records, filterable |
| `/payment` | Top Up — scaffold for ToyyibPay + crypto, balance is credited immediately by the mock |

## Architecture — read this before editing

### SMS provider abstraction
`src/lib/sms/provider.ts` defines the `SmsProvider` interface. Only `MockSmsProvider` (`mock-provider.ts`) is implemented. `getProvider()` in `src/lib/sms/index.ts` switches on `process.env.SMS_PROVIDER`. To add a real provider: implement `SmsProvider`, add a `case` to `getProvider()`.

> A **scheduled remote agent** is queued to add `MmdSmartProvider` (research mmdsmart's API + draft the integration). Check open PRs on the repo.

### In-memory store
`src/lib/store.ts` is the entire database — a `globalThis`-attached object that survives Next.js dev HMR but resets when the dev process restarts. Seed: 10 contacts in 3 groups, 3 templates, 4 historical campaigns, ~80 message logs, 2 HLR reports, SGD 128.50 balance.

When persisting to a real DB: each function body becomes a query. Schemas are in `src/lib/types.ts` (`Contact`, `Template`, `Campaign`, `MessageLog`, `HlrReport`).

### Phone parsing — single source of truth
`src/lib/phone.ts`:
- `PHONE_RE = /^\+?[0-9]{6,15}$/`
- `normalizePhone(raw)` — strips spaces/parens/dashes
- `classifyPhones(arr)` — server-side dedupe + valid/invalid split
- `parsePhoneList(text)` — client-side parser for textareas (returns `{ all, valid, invalid }`)

**Don't reimplement.** Send Now, create-group, /api/send, /api/hlr, /api/contacts all use these.

### HLR mock
`src/lib/hlr.ts` is deterministic per number — same input always yields the same telco/country/MCC-MNC. Country detection by prefix: +65 SG (Singtel / StarHub / M1 / Simba), +60 MY (Maxis / CelcomDigi / U Mobile), +62 ID, +63 PH, else generic. ~8% of valid-format numbers are marked "absent" (registered-but-not-reachable), ~14% "ported".

### Billing
`Db.balance` in SGD. `addBalance(amount)` credits. `/api/balance` GET, `/api/topup` POST. Send Now's cost is **estimate-only** (`PRICE_PER_SEGMENT = 0.0395` in `src/app/send/page.tsx`); sending does NOT decrement the balance — wire that in if you need real billing.

### Status taxonomy (fixed)
- `MessageStatus`: `sent | failed | pending | invalid | unknown` — `StatusPill` and the report breakdowns depend on this exact set
- `CampaignStatus`: `draft | sending | completed | failed`
- `SubscriptionStatus`: `subscribed | unsubscribed`

### SMS segmenting
`smsSegments(text)` in `src/app/send/page.tsx`. Any character with `charCodeAt > 127` → UCS-2 (70 chars/segment). Pure ASCII → GSM-7 (160 chars/segment). The right-corner counter on the message box reflects this live.

## File map

```
src/
  app/
    page.tsx              dashboard
    send/page.tsx         Send Now (compose → review → send)
    hlr/page.tsx          HLR Lookup + reports history
    report/page.tsx       campaign reports list/detail
    contacts/             groups list + [group] detail + create-group dialog
    templates/page.tsx
    logs/page.tsx
    payment/page.tsx      top-up form
    layout.tsx            root layout — fonts, dark class, sidebar, Toaster
    globals.css           theme tokens, background atmosphere, scrollbar
    api/                  REST endpoints (see below)
  components/
    app-sidebar.tsx       nav with motion-animated active indicator
    page-header.tsx       sticky page title; optional backHref / action slot
    status-pill.tsx       colored status badge (5 statuses)
    stat-card.tsx         dashboard stat tile (animated count-up)
    animated-number.tsx   count-up motion helper
    ui/                   shadcn (Base UI preset) primitives
  lib/
    sms/                  SmsProvider abstraction + MockSmsProvider
    hlr.ts                mock HLR service (deterministic)
    phone.ts              shared phone parsing
    store.ts              in-memory store
    types.ts              domain types
    api.ts                tiny client fetch helpers (apiGet, apiPost)
    utils.ts              shadcn cn()
```

## API routes

| Route | Methods | Notes |
|---|---|---|
| `/api/groups` | GET, POST | list groups w/ counts; create group + import numbers |
| `/api/contacts` | GET, POST | GET `?group=` returns contacts; POST adds numbers to a group |
| `/api/templates` | GET, POST | list / create |
| `/api/campaigns` | GET | list (created by `/api/send`, not POST'd directly) |
| `/api/send` | POST | `{ name, message, contacts, senderId? }` — runs the blast, persists campaign + logs |
| `/api/logs` | GET | `?campaignId=` for one campaign, else all |
| `/api/hlr` | POST | `{ name, numbers }` — runs lookup, persists HLR report |
| `/api/hlr/reports` | GET | list of HLR reports |
| `/api/hlr/export` | GET | `?id=` — xlsx (Summary + Numbers sheets) |
| `/api/report/download` | GET | `?campaignId=` — xlsx campaign report (Summary + Recipients) |
| `/api/balance` | GET | current SGD balance |
| `/api/topup` | POST | `{ amount, method: "toyyibpay" | "crypto" }` — credits immediately (mock) |

## Mocks vs real — swap list

| Mock | Where | Plug in |
|---|---|---|
| `MockSmsProvider` | `src/lib/sms/mock-provider.ts` | Real gateway — implement `SmsProvider`, add case in `getProvider()` |
| HLR | `src/lib/hlr.ts` | Real HLR API (Twilio Lookup etc.) — same `HlrResult` shape |
| Store | `src/lib/store.ts` | Real DB — keep signatures, swap bodies |
| Top up | `src/app/api/topup/route.ts` | Real gateway redirect + webhook → `addBalance()` |
| Pricing | `PRICE_PER_SEGMENT` in `src/app/send/page.tsx` | Pull from provider's rate card |

## Gotchas

- **Next.js 16** with Turbopack. Bundled docs at `node_modules/next/dist/docs/` (see project's `AGENTS.md` — APIs differ from Next 13/14). Page `params`/`searchParams` are Promises; await them.
- **shadcn here is the Base UI preset** ("base-nova"), not Radix. Components use `render={<X/>}` instead of `asChild`. `<Button>` rendered as a link needs `nativeButton={false}`. Search existing usages for the pattern.
- **In-memory store** only persists within one Node process. Restarting `npm run dev` reseeds — not a bug.
- **Send Now sends ALL submitted numbers** (group + HLR-valid + manual incl. malformed) so `/api/send` re-classifies them and counts invalid into the campaign report. Don't pre-filter on the client.
- **Group names are the key** (no group IDs). Renaming would orphan a group's contacts.
- **`.claude/launch.json`** has Windows-absolute paths for node — for the preview tool only, doesn't affect `npm run dev`. Adjust if you use the same launch config elsewhere.

## Conventions

- Pages are mostly client components fetching from `/api/*`.
- Type-check after meaningful changes: `npx tsc --noEmit`. Avoid `any`; prefer narrowing existing unions over inventing new statuses.
- UI text in English; the dark-console aesthetic uses Bricolage Grotesque (display), Hanken Grotesk (sans), Geist Mono (numbers/IDs).
- Status colors: success = emerald, warning = amber, destructive = rose, primary accent = cyan. See `globals.css` tokens.
