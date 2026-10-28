# Technical Specification — shomiti.com Migration to Next.js 14

**WordPress → Next.js 14 (App Router) · TypeScript · Tailwind CSS**

| Field | Value |
|---|---|
| Document ID | SPEC-SHOMITI-001 |
| Version | 1.0 (Draft for review) |
| Status | Proposed |
| Date | 2026-10-24 |
| Owner | Engineering — shomiti.com |
| Reviewers | Tech lead, Treasurer-domain owner, Operations |
| Related code | `frontend/` (Next.js 14.2.5), `backend/` (Express 5 + MongoDB) |

---

## 1. Executive summary

shomiti.com today is a WordPress site. In parallel, this repository already contains a working **cooperative management application** built on Next.js 14 App Router with a separate Express/MongoDB API. The migration consolidates both into **one Next.js 14 application written in TypeScript and styled with Tailwind CSS**, so that:

1. Public/marketing content currently served by WordPress is served by the Next.js app (static/ISR, no CMS runtime in the request path).
2. The cooperative application (members, savings, dues, payments, approvals, expenses, ledger, documents, reports) keeps its current behaviour, but is type-safe end to end.
3. There is exactly one deployable frontend, one design system, one i18n layer, and one SEO surface.

The existing repository is the **source of truth for application behaviour**. WordPress is the source of truth only for **public content, URLs and media**. This document specifies how to converge them.

### 1.1 Guiding decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Keep the Express API as the system of record; do **not** move financial logic into Next.js Route Handlers | Double-entry ledger and approval invariants already exist and are tested; Next.js is the presentation tier |
| D2 | Next.js App Router with React Server Components by default | Static public pages, smaller client bundles, colocated metadata |
| D3 | TypeScript `strict: true` for all new code; incremental conversion of existing `.jsx` | Full rewrite would stall delivery; `allowJs` permits a staged cutover |
| D4 | Zod as the single schema source for forms and API boundaries | One definition → runtime validation + static types |
| D5 | Public content modelled as typed content files (MDX/JSON) at build time, not a live WordPress/headless CMS | Removes WordPress from the request path; content PRs are reviewable |
| D6 | Money is integer **paisa** everywhere; formatting only at the edge | Avoids floating-point drift in a financial product |
| D7 | WordPress URLs are redirected with a versioned map, not guessed | Protects accumulated SEO equity |

---

## 2. Scope

### 2.1 In scope

- Migration of all public WordPress pages, posts, notices, policies and media to a Next.js 14 App Router surface.
- Conversion of the existing `frontend/` JSX codebase to TypeScript (`strict`).
- A shared design system in Tailwind CSS with brand tokens (deep maroon / warm gold).
- Bilingual UI (Bengali default, English secondary) across public and authenticated surfaces.
- SEO parity: canonical URLs, metadata, Open Graph, sitemap, robots, structured data, redirects.
- Authentication, RBAC, and role-aware navigation in the unified app.
- Performance, accessibility, security and observability budgets.
- Cutover plan, rollback plan and acceptance criteria.

### 2.2 Out of scope

- Changes to accounting rules, approval policy, or interest/late-fee formulas.
- Replacing MongoDB or the Express API.
- Native mobile applications.
- Payment-gateway commercial renegotiation (SSLCommerz/bKash/Nagad/Rocket integration surface is specified, gateway onboarding is not).
- WordPress plugin functionality that has no product equivalent (e.g. third-party comment spam tooling).

### 2.3 Assumptions to validate in Phase 0

> **A1.** shomiti.com currently runs WordPress with publicly indexed pages, and inbound links/traffic exist that must be preserved.
> **A2.** WordPress hosts no financial data; member/savings data lives only in MongoDB behind the Express API.
> **A3.** Content volume is small enough (≤ 300 URLs) to migrate as reviewed content files rather than an automated CMS sync.
> **A4.** Bengali is the primary audience language; English is secondary.
> **A5.** The site is low-traffic (≤ 100 concurrent users) and may run as a single Next.js container plus one API container.
> **A6.** No WordPress user accounts need to be migrated; staff accounts are seeded in MongoDB.

Each assumption must be confirmed or amended by the output of the Phase 0 audit (§25.1). If A3 fails, escalate to the headless-CMS variant in §15.7.

---

## 3. Current state

### 3.1 WordPress legacy (to be retired)

| Area | Legacy behaviour | Migration target |
|---|---|---|
| Home / about / contact | Themed PHP templates | Static React Server Components |
| Blog / notices / news | `wp_posts` + categories | Typed MDX content collections |
| Policies & by-laws | Pages or PDF uploads | MDX pages + document vault entries |
| Media | `wp-content/uploads` | Object storage + `next/image` |
| Menus | WP nav menus | Typed navigation config (§8.6) |
| Forms | Plugin shortcodes | Server Actions + Zod validation |
| Search | WP search | Build-time index for public content; API search for app data |
| Users | `wp_users` | Not migrated; separate auth (§11) |
| Analytics | Tag-injected scripts | Consent-gated, Next.js `Script` component |
| URLs | Permalink structure | 308 redirect map (§15.3) |

### 3.2 Existing application assets (reused)

| Asset | Location | Notes |
|---|---|---|
| App Router pages (25 routes) | `frontend/app/**/page.jsx` | Converted to `.tsx` |
| Root layout & metadata | `frontend/app/layout.jsx` | Contains a defect: `import { Metadata } from 'next'` imports a type as a value |
| Shell (sidebar/topbar/search) | `frontend/components/layout/*.jsx` | `AppShell`, `SidebarV2`, `GlobalSearch`, `SearchParamSync` |
| UI primitives | `frontend/components/ui/{common,form}.jsx` | Button, Input, Select, Modal, Table, Badge, Progress, Tabs |
| Zustand auth store | `frontend/lib/auth.js` | Persisted in `sessionStorage`; cleared when the browser session ends |
| Axios client | `frontend/lib/api.js` | Error normalisation → `ApiError` |
| i18n dictionaries | `frontend/lib/i18n.js` | `en` + `bn` key/value maps (large; split during migration) |
| Role navigation | `frontend/lib/navigation.js` | Role → menu sections |
| Tailwind tokens | `frontend/tailwind.config.js` | `brand`, `gold`, Inter + Hind Siliguri |
| Design primitives | `frontend/styles/globals.css` | `.card`, `.input`, `.badge-*`, print rules |
| REST API | `backend/src/routes/index.js` | 11 mounted routers + health/system |
| Domain rules | `backend/src/config/constants.js` | Roles, permissions, schemes, ledger codes |
| Mongoose models | `backend/src/models/*.js` | 16 collections |

### 3.3 Known gaps in the current app (must be closed, not carried over)

| Gap | Evidence | Resolution |
|---|---|---|
| Dead navigation targets | `lib/navigation.js` links to `/members/add`, `/savings/my`, `/savings/my/dues`, `/documents/my`, `/expenses/create`, `/expenses/categories` — no corresponding `page.jsx` | Build the routes or remove the links (§8.4) |
| Duplicate login page | Both `/` and `/login` render a sign-in screen | `/` becomes the public marketing home; `/login` is the only auth entry |
| Type-only import as value | `app/layout.jsx` line 1 | Convert to `import type { Metadata } from 'next'` |
| Client-side-only auth gate | `AppShell` decides access after `loadSession()` resolves | Add `middleware.ts` edge check + server layout guard |
| Token in browser storage | `lib/auth.js` `persist(...)` | Session cookie (`HttpOnly`) is authoritative; store only user profile locally |
| i18n monolith | `lib/i18n.js` ≈ 1,100 lines | Split into namespaced dictionaries; keep keys stable |
| No tests on frontend | `frontend/package.json` has only `lint` | Add Vitest + Playwright (§23) |

---

## 4. Target architecture

### 4.1 Topology

```
                    ┌──────────────────────────────────────────┐
   Browser  ───────▶│  Next.js 14 (App Router, TypeScript)     │
                    │  • Public pages  (SSG / ISR)             │
                    │  • Auth app     (RSC + Client islands)   │
                    │  • Route Handlers (BFF: /api/*)          │
                    └───────────────┬──────────────────────────┘
                                    │ server-to-server (JWT, HttpOnly cookie)
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │  Express 5 API  (/api/*)                 │
                    │  • Auth, RBAC, validation                │
                    │  • Savings, dues, payments, expenses     │
                    │  • Double-entry ledger, approvals        │
                    └───────────────┬──────────────────────────┘
                                    │ Mongoose
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │  MongoDB (replica set in production)     │
                    └──────────────────────────────────────────┘

   Object storage (S3-compatible) ── uploaded documents, member photos, media
```

### 4.2 Deployment units

| Unit | Runtime | Scaling | Stateless |
|---|---|---|---|
| `web` | Next.js 14 Node server (`next start`) | Horizontal, N ≥ 1 | Yes |
| `api` | Express 5 (`node src/server.js`) | Horizontal, N ≥ 1 | Yes (files in object storage) |
| `db` | MongoDB 6+ replica set | Vertical first | — |
| `storage` | S3-compatible bucket | Managed | — |

Next.js must **not** own the database connection. There is no Mongoose import anywhere under `frontend/`.

### 4.3 Request flows

**Public page (SSG/ISR)**
`GET /about` → Next.js static output (no API call) → HTML streamed from CDN cache → hydration only for interactive islands.

**Authenticated page (RSC)**
`GET /dashboard` → `middleware.ts` verifies session cookie shape → `app/(app)/layout.tsx` calls `getSession()` → redirect to `/login?next=…` when absent → RSC fetches `GET ${API_URL}/dashboard/summary` with `credentials` forwarded server-side → renders HTML → client islands hydrate (charts, tables, modals).

**Mutation**
Client form → Server Action (or typed API call) → Express endpoint validates + applies domain rules → returns `{ data }` or `{ error }` → Server Action `revalidatePath()` → UI updates via `useOptimistic`/router refresh.

**Payment slip upload**
Client → signed multipart POST → Express `multer` → object storage → `Payment` document in `pending` → treasury queue (`/approvals`).

---

## 5. Technology stack

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Framework | Next.js | 14.2.x | App Router, RSC, Server Actions, built-in image/font optimisation |
| UI runtime | React | 18.3.x | Required by Next 14; `useOptimistic`, Suspense streaming |
| Language | TypeScript | 5.4+ | `strict`, `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS | 3.4.x | Existing token set; utility consistency |
| Variants helper | `class-variance-authority` + `tailwind-merge` | latest | Type-safe component variants (replaces string concatenation) |
| Validation | Zod | 3.x | Shared form + API schemas |
| Server data | native `fetch` (RSC) | — | Built-in dedupe + revalidate tags |
| Client data | TanStack Query | 5.x | Caching, retries, optimistic updates for tables |
| Client state | Zustand | 5.x | Already in use; limited to UI/session-profile state |
| Forms | React Hook Form + `@hookform/resolvers/zod` | 7.x | Uncontrolled inputs, low re-render cost |
| Tables | TanStack Table | 8.x | Sorting/filtering/pagination for ledger & members |
| Charts | Recharts | 2.x | Dashboard trend, fund positions |
| Icons | lucide-react | latest | Already in use |
| Toasts | react-hot-toast | 2.x | Already in use |
| Dates | date-fns | 3.x | Already in use; `Intl` for display |
| Testing | Vitest, Testing Library, Playwright | latest | Unit + E2E |
| Lint/format | ESLint (`next/core-web-vitals`), Prettier, `prettier-plugin-tailwindcss` | latest | Consistency |
| API | Express | 5.3.x | Unchanged |
| ODM | Mongoose | 9.x | Unchanged |
| Auth | `jsonwebtoken`, `bcryptjs` (12 rounds) | current | Unchanged |

**Explicitly rejected:** CRA/Vite SPA (loses SSR/SEO), Pages Router (no RSC), CSS-in-JS runtime (bundle cost), WordPress-as-headless in the live request path (availability coupling).

---

## 6. TypeScript adoption

### 6.1 Principles

1. **No `any` in new code.** `@typescript-eslint/no-explicit-any` is an error. Prefer `unknown` + narrowing.
2. **Types flow from schemas, not from hand-written duplicates.** A Zod schema is defined once; the type is `z.infer<typeof Schema>`.
3. **API types are generated or declared once** in `src/types/api.ts` and imported by both client and forms.
4. **Conversion is mechanical first, strict second.** Convert `.jsx` → `.tsx` with `allowJs` + `strict: false`, then enable strict per directory.

### 6.2 `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 6.3 Conversion order

| Step | Scope | Gate |
|---|---|---|
| 1 | `lib/api.ts`, `lib/auth.ts`, `lib/types.ts` | `tsc --noEmit` clean |
| 2 | `components/ui/*` | Props interfaces documented; no `any` |
| 3 | `components/layout/*` | Shell renders identically |
| 4 | `app/layout.tsx`, `app/(public)/**` | Public pages type-clean |
| 5 | `app/(app)/**` route-by-route | Each route passes its Playwright smoke test |
| 6 | Flip `allowJs: false`; delete `jsconfig.json` | `tsc --noEmit` clean repo-wide |

### 6.4 Representative types

```ts
export type Role = 'super_admin' | 'treasurer' | 'general_secretary' | 'president' | 'member';

export type MemberStatus = 'active' | 'inactive' | 'suspended' | 'resigned';
export type SavingsType = 'monthly' | 'half_yearly' | 'one_time';
export type TransactionType = 'deposit' | 'withdrawal' | 'adjustment' | 'interest' | 'fee';
export type TransactionStatus = 'pending_approval' | 'posted' | 'rejected' | 'cancelled';

export interface SessionUser {
  id: string;
  name: string;
  nameBn?: string;
  email?: string;
  phone: string;
  role: Role;
  memberId?: string | null;
  permissions: PermissionKey[];
}

/** Money is always integer paisa. ৳10,000 => 1_000_000 */
export type Paisa = number & { readonly __brand: 'Paisa' };

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}
```

### 6.5 API envelope types

```ts
export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

`ApiError` (already thrown by `lib/api.js`) gains a discriminated `code` union so `translateError()` can be exhaustive.

---

## 7. Repository layout

```
shomiti/
├─ frontend/                      # Next.js 14 app (becomes `web/` in Phase 2)
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ (public)/             # marketing, notices, policies — SSG/ISR
│  │  │  │  ├─ page.tsx           # home
│  │  │  │  ├─ about/page.tsx
│  │  │  │  ├─ notices/[slug]/page.tsx
│  │  │  │  ├─ policies/[slug]/page.tsx
│  │  │  │  └─ contact/page.tsx
│  │  │  ├─ (auth)/login/page.tsx
│  │  │  ├─ (app)/                # authenticated shell
│  │  │  │  ├─ layout.tsx
│  │  │  │  ├─ dashboard/page.tsx
│  │  │  │  └─ …                  # see §8.3
│  │  │  ├─ api/                  # BFF route handlers (only where needed)
│  │  │  ├─ layout.tsx
│  │  │  ├─ sitemap.ts
│  │  │  ├─ robots.ts
│  │  │  └─ not-found.tsx
│  │  ├─ components/
│  │  │  ├─ ui/                   # design-system primitives
│  │  │  ├─ layout/               # shell, sidebar, topbar, search
│  │  │  ├─ members/ savings/ approvals/ expenses/ ledger/ documents/ …
│  │  ├─ content/                 # MDX notice/policy collections
│  │  ├─ lib/
│  │  │  ├─ api.ts  auth.ts  session.ts  i18n/  navigation.ts
│  │  │  ├─ money.ts  dates.ts  permissions.ts
│  │  ├─ schemas/                 # Zod schemas per domain
│  │  ├─ types/                   # api.ts, domain.ts
│  │  └─ styles/globals.css
│  ├─ public/                     # logo.png, favicon.png, site.webmanifest
│  ├─ middleware.ts
│  ├─ next.config.mjs
│  ├─ tailwind.config.ts
│  ├─ tsconfig.json
│  └─ package.json
├─ backend/                       # unchanged Express API
├─ docs/
└─ package.json                   # workspace scripts
```

**Rule:** `frontend/` must not import from `backend/`. Shared constants that must agree (roles, permission keys, payment methods) are duplicated deliberately and guarded by a contract test that compares `backend/src/config/constants.js` values against `frontend/src/lib/permissions.ts`.

---

## 8. Routing specification

### 8.1 Route groups

| Group | Layout | Rendering | Auth |
|---|---|---|---|
| `(public)` | Marketing header/footer | SSG + ISR (`revalidate = 3600`) | None |
| `(auth)` | Centered card | Static shell + client form | Redirect if already signed in |
| `(app)` | Sidebar + topbar shell | RSC, dynamic per user | Required; role-gated |

`(public)` and `(app)` never share a layout. This keeps the marketing bundle free of the application shell (≈ 40 kB JS saved).

### 8.2 Public routes to build

| Path | Source | Rendering | Notes |
|---|---|---|---|
| `/` | Home | SSG | Value proposition, fund transparency summary (aggregate only), notices preview |
| `/about` | About the cooperative | SSG | Registration no., mission, committee |
| `/notices` | Notice index | ISR 300s | Paginated list |
| `/notices/[slug]` | Notice detail | SSG via `generateStaticParams` | `generateMetadata` per notice |
| `/policies` | Policy index | SSG | By-laws, savings rules, expense policy |
| `/policies/[slug]` | Policy detail | SSG | Print-friendly |
| `/contact` | Contact + office hours | SSG | Server Action form → email/queue |
| `/login` | Sign in | Static shell | Only auth entry point |
| `/sitemap.xml` | `app/sitemap.ts` | Static | Includes public routes only |
| `/robots.txt` | `app/robots.ts` | Static | Disallow `/dashboard`, `/members`, … |

### 8.3 Authenticated routes

Legend — **R** = required roles. `SA` super_admin, `T` treasurer, `GS` general_secretary, `P` president, `M` member.

| Path | Purpose | R | Data dependencies |
|---|---|---|---|
| `/dashboard` | Role-specific KPI dashboard | all | `/dashboard/summary`, `/dashboard/trend` |
| `/members` | Member registry, search, filter | SA T GS P | `/members` |
| `/members/add` | Create member | SA T | `POST /members` |
| `/members/[id]` | Member profile, accounts, nominees | SA T GS P | `/members/:id` |
| `/members/[id]/edit` | Edit member | SA T GS | `PATCH /members/:id` |
| `/users` | User administration | SA | `/users` |
| `/roles` | Role & permission matrix | SA | `/roles` |
| `/savings` | Transactions ledger view | SA T GS P | `/savings/transactions` |
| `/savings/dues` | Dues generation & payment | SA T GS | `/savings/dues` |
| `/savings/config` | Scheme configuration | SA T | `/schemes` |
| `/savings/my` | Member's own savings | M | `/savings/me` |
| `/savings/my/dues` | Member's dues + pay | M | `/savings/me/dues` |
| `/savings/my/schemes` | Member's enrollments | M | `/schemes/me` |
| `/payments` | Online payment initiation | M | `/payments` |
| `/payments/offline` | Bank slip upload | M | `POST /payments/slip` |
| `/approvals` | Approval centre (slips + requests) | SA T GS P | `/approvals`, `/approvals/slips` |
| `/expenses` | Expense list & 3-tier workflow | SA T GS P | `/expenses` |
| `/expenses/create` | New expense request | SA T GS | `POST /expenses` |
| `/expenses/categories` | Expense categories | SA T | `/expenses/categories` |
| `/ledger` | Chart of accounts, journal, trial balance | SA T GS P | `/ledger/accounts`, `/ledger/entries` |
| `/meetings` | Meetings, agenda, resolutions | SA T GS P | `/meetings` |
| `/documents` | Document vault (staff) | SA T GS P | `/documents` |
| `/documents/my` | Member-visible documents | M | `/documents/me` |
| `/reports` | Collection/overdue/late-fee/income-expense | SA T GS P | `/reports/*` |
| `/audit` | Security audit trail | SA P | `/audit` |
| `/certificate` | Membership certificate (print/PDF) | M | `/members/me/certificate` |
| `/statement` | Member statement (date range, PDF) | M | `/savings/me/statement` |
| `/notifications` | Alerts: dues, approvals, notices | all | `/notifications` |
| `/profile` | Own profile & password | all | `/auth/me` |
| `/settings` | System/account settings | SA + all (account tab) | `/settings` |

### 8.4 Routes referenced but missing

Create the route or delete the nav entry — **never ship a 404 from the sidebar**. Tracking table:

| Missing route | Referenced in | Action |
|---|---|---|
| `/members/add` | `navigation.js` | Create (form = Members form in create mode) |
| `/savings/my` | `navigation.js` (member) | Create |
| `/savings/my/dues` | `navigation.js` (member) | Create |
| `/documents/my` | `navigation.js` (member) | Create |
| `/expenses/create` | `navigation.js` (treasurer) | Create |
| `/expenses/categories` | `navigation.js` (super_admin, treasurer) | Create |

### 8.5 `not-found` and error boundaries

- `app/not-found.tsx` — branded 404, links to `/` and `/dashboard`.
- `app/(app)/error.tsx` — client boundary with retry; never leaks stack traces.
- `app/(public)/error.tsx` — static apology + contact link.
- `app/global-error.tsx` — last resort, reports to observability.

### 8.6 Navigation model

`src/lib/navigation.ts` exports a typed config:

```ts
export interface NavItem { href: Route; label: I18nKey; icon: IconName; badge?: 'pendingApprovals'; }
export interface NavSection { section: I18nKey; items: NavItem[]; }
export const ROLE_MENU: Record<Role, NavSection[]>;
```

Guarantees enforced by tests:
1. Every `href` resolves to a real page (build a manifest from the filesystem at test time).
2. Every `label` exists in both `en` and `bn` dictionaries.
3. A member never sees a staff section.

---

## 9. Rendering, caching and data fetching

### 9.1 Rules

1. **Server Components by default.** Add `'use client'` only for: event handlers, browser APIs, local state, or third-party client-only libraries.
2. **No data fetching in client components** unless it is user-triggered (search-as-you-type, pagination clicks) or live (approval badge polling).
3. **Financial data is never cached across users.** Any fetch that includes a session cookie sets `cache: 'no-store'`.
4. **Public content is cached aggressively** and revalidated by tag.
5. **Mutations go through Server Actions** or explicit typed API calls, followed by `revalidateTag`/`revalidatePath`.

### 9.2 Caching matrix

| Surface | Strategy | Revalidate | Tag |
|---|---|---|---|
| Public home | Static | 1 h | `content:home` |
| Notices list | ISR | 5 min | `content:notices` |
| Notice detail | SSG | on publish | `notice:{slug}` |
| Policies | SSG | on publish | `policy:{slug}` |
| Dashboard KPIs | Dynamic (`no-store`) | — | — |
| Members / savings / ledger | Dynamic | — | — |
| Reference data (schemes, categories, accounts) | `fetch` with `next: { revalidate: 300, tags: ['ref:…'] }` | 5 min | `ref:schemes` etc. |
| Member photo / doc thumbnails | `next/image` + CDN | immutable, hashed URL | — |

### 9.3 Server Actions

| Action | Endpoint | Invalidates |
|---|---|---|
| `loginAction` | `POST /auth/login` | redirect `/dashboard` |
| `logoutAction` | `POST /auth/logout` | redirect `/login` |
| `createMemberAction` | `POST /members` | `members` |
| `recordDepositAction` | `POST /savings/transactions` | `savings`, `dashboard` |
| `payDueAction` | `POST /savings/dues/:id/pay` | `dues`, `savings` |
| `decideApprovalAction` | `POST /approvals/:id/decide` | `approvals`, `dashboard` |
| `createExpenseAction` | `POST /expenses` | `expenses` |
| `uploadDocumentAction` | `POST /documents` | `documents` |
| `contactAction` | internal queue | — |

Every action: parse with Zod → call API → map `ApiError` to a field-level result → never throw raw errors to the client.

### 9.4 Loading and streaming

- Route-level `loading.tsx` with skeletons matching final layout (no layout shift).
- Suspense boundaries around slow panels (trend chart, audit table).
- Tables stream rows; filters render immediately.

---

## 10. Data access layer

### 10.1 Client wrapper (`src/lib/api.ts`)

Preserve current semantics:

- Base URL `NEXT_PUBLIC_API_URL` (default `/api`).
- `withCredentials: true`.
- `X-Requested-With: XMLHttpRequest` (required by backend CSRF middleware).
- `Accept-Language` from active locale.
- Non-2xx → typed `ApiError` with `{ status, code, message, details }`.
- `401` → dispatch `session-expired` once, then redirect to `/login?next=`.

### 10.2 Server-side fetch (`src/lib/server-api.ts`)

```ts
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { tags?: string[]; revalidate?: number } = {}
): Promise<T>;
```

- Reads the session cookie via `cookies()` and forwards it as `Cookie`.
- Throws `ApiError` on non-2xx; RSC boundaries convert it to error UI.
- **Never** called from a Client Component.

### 10.3 Pagination contract

Request: `?page=1&limit=20&sort=-createdAt`. Response:

```json
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 137, "pages": 7 } }
```

Client `Pagination` component (`common.jsx`) already consumes `meta.total`. Keep this contract stable.

### 10.4 Money contract

| Layer | Representation |
|---|---|
| API / DB | Integer paisa (`1000000` = ৳10,000) |
| Form input | Decimal taka string, parsed by `parseTakaToPaisa()` |
| Display | `formatMoney()` → `৳10,000.00` with `Intl.NumberFormat('bn-BD' \| 'en-BD')` |
| Ledger | Integer paisa; debit total must equal credit total per entry |

Rules: no `parseFloat` outside `money.ts`; all rounding is explicit (`Math.round`) and covered by unit tests.

---

## 11. Authentication and authorization

### 11.1 Token flow (target)

1. `POST /auth/login { identifier, password }` → API returns user + sets `sn_token` **HttpOnly, Secure, SameSite=Lax** cookie.
2. Next.js `middleware.ts` checks cookie presence for `(app)` paths → redirect to `/login?next=<path>` if absent.
3. `app/(app)/layout.tsx` calls `getSession()` (server) → `GET /auth/me` → `SessionUser` or redirect.
4. Client receives only the profile (no token). `localStorage` keeps **UI preferences** (locale, sidebar state), not credentials.
5. `401` from any call → clear session → redirect with `next`.

> Migration note: `lib/auth.js` currently persists `token` in `sessionStorage`. Removing that is a **security fix**, not a refactor. Cookie must be `HttpOnly` so XSS cannot exfiltrate a session.

### 11.2 Roles

`super_admin`, `treasurer`, `general_secretary`, `president`, `member`.

### 11.3 Permission matrix (source: `backend/src/config/constants.js`)

| Permission | SA | P | GS | T | M |
|---|:--:|:--:|:--:|:--:|:--:|
| `members.view` | ✓ | ✓ | ✓ | ✓ | — |
| `members.create` | ✓ | — | — | ✓ | — |
| `members.edit` | ✓ | — | ✓ | ✓ | — |
| `members.suspend` | ✓ | — | — | — | — |
| `savings.view` | ✓ | ✓ | ✓ | ✓ | — |
| `savings.configure` | ✓ | — | — | ✓ | — |
| `savings.trigger_dues` | ✓ | — | — | ✓ | — |
| `payments.view` | ✓ | ✓ | ✓ | ✓ | — |
| `payments.verify_slips` | ✓ | — | — | ✓ | — |
| `payments.reject_slips` | ✓ | — | — | ✓ | — |
| `payments.online_logs` | ✓ | ✓ | — | ✓ | — |
| `expenses.create` | ✓ | — | ✓ | ✓ | — |
| `expenses.approve_tier1` | ✓ | — | — | ✓ | — |
| `expenses.approve_tier2` | ✓ | — | ✓ | — | — |
| `expenses.approve_tier3` | ✓ | ✓ | — | — | — |
| `ledger.view` | ✓ | ✓ | ✓ | ✓ | — |
| `ledger.adjust` | ✓ | — | — | — | — |
| `meetings.create` | ✓ | ✓ | ✓ | — | — |
| `meetings.upload_resolution` | ✓ | ✓ | ✓ | — | — |
| `meetings.publish_notice` | ✓ | ✓ | ✓ | ✓ | — |
| `documents.upload` | ✓ | — | ✓ | ✓ | — |
| `documents.delete` | ✓ | — | ✓ | — | — |
| `documents.certificates` | ✓ | ✓ | ✓ | — | — |
| `reports.view_financial` | ✓ | ✓ | ✓ | ✓ | — |
| `reports.export` | ✓ | ✓ | ✓ | ✓ | — |
| `reports.audit_logs` | ✓ | ✓ | — | — | — |
| Member-scope (`*_own`) | — | — | — | — | ✓ |

### 11.4 Enforcement layers

| Layer | Enforces | Failure mode |
|---|---|---|
| `middleware.ts` | Session presence | Redirect |
| `(app)/layout.tsx` | Session validity, role gate for section | Redirect / 403 page |
| Server Action | Permission check before API call | Field error |
| Express API | Authoritative `authorize()` + ownership checks | `403 FORBIDDEN` |
| UI | Hides actions the user cannot perform | — |

UI hiding is **cosmetic only**; every mutation is re-checked server-side.

### 11.5 Password policy

8–72 characters, ≥ 1 letter + ≥ 1 digit, bcrypt cost 12. Reject the 1,000 most common passwords in the Zod schema. `mustChangePassword` forces a change on next login. Sessions invalidate via `tokenVersion` on password change.

### 11.6 Session lifetime

Cookie is a browser session cookie (no `Max-Age`/`Expires`), so it is cleared when the browser closes. `Remember me` is not supported. Idle timeout warning at 25 min (client), hard expiry at 30 min for financial actions.

---

## 12. Domain model

All collections use `timestamps: true`. IDs are Mongo `ObjectId`. Money fields end in `Paisa`.

### 12.1 `users`

| Field | Type | Notes |
|---|---|---|
| `name` | string(120) | required |
| `email` | string | sparse unique, lowercased |
| `phone` | string | unique, required |
| `passwordHash` | string | `select: false` |
| `role` | enum | indexed |
| `member` | ObjectId → Member | null for staff |
| `isActive` | bool | default true |
| `mustChangePassword` | bool | |
| `tokenVersion` | number | `select: false` |
| `lastLoginAt`, `passwordChangedAt` | Date | |

Serialisation strips `passwordHash`, `tokenVersion`, `__v`.

### 12.2 `members`

Identity (`name`, `nameBn`, `fatherName`, `motherName`, `spouseName`, `nid`, `dob`, `photoUrl`), contact (`phone`, `email`, `address{village,postOffice,upazila,district}`), cooperative (`memberCode`, `joinDate`, `status`, `shareCount`, `notes`), `nominees[]` (`name`, `phone`, `nid`, `relation`, `percentage` — must total 100).

### 12.3 Savings domain

| Collection | Key fields |
|---|---|
| `savingsschemes` | `savingsType`, `name`, `nameBn`, `description`, `principalPaisa`, `lateFeePercent`, `frequency`, `installments`, `graceDays`, `isActive` |
| `schemeenrollments` | `member`, `scheme`, `enrollmentNo`, `startDate`, `status`, `nextDueDate` |
| `savingsaccounts` | `member`, `accountNo`, `type` (general/fixed/recurring/share), `balancePaisa` |
| `savingstransactions` | `member`, `account`, `type`, `amountPaisa`, `method`, `reference`, `receiptNo`, `status`, `createdBy`, `approvedBy`, `postedAt` |
| `savingsdues` | `member`, `scheme`, `period`, `dueNo`, `principalPaisa`, `lateFeePaisa`, `totalPaisa`, `dueDate`, `status` |

### 12.4 Finance domain

| Collection | Key fields |
|---|---|
| `payments` | `member`, `due`, `amountPaisa`, `method`, `status`, `gatewayRef`, `slipUrl`, `verifiedBy`, `rejectionReason` |
| `expenses` | `title`, `category`, `amountPaisa`, `payee`, `description`, `attachmentUrl`, `status`, `approvals[]` |
| `ledgeraccounts` | `code`, `name`, `type` (asset/liability/equity/income/expense), `isSystem` |
| `journalentries` | `entryNo`, `date`, `description`, `source`, `lines[]` (`account`, `debitPaisa`, `creditPaisa`), `postedBy` |
| `approvalrequests` | `entity` (savings_due/expense), `entityId`, `requestNo`, `requestedBy`, `amountPaisa`, `status`, `decisions[]` |

### 12.5 Governance and platform

| Collection | Key fields |
|---|---|
| `documents` | `title`, `category`, `fileUrl`, `mimeType`, `sizeBytes`, `member`, `visibility` (staff/member/public), `uploadedBy` |
| `roles` | `name`, `description`, `permissions[]`, `isSystemLocked` |
| `auditlogs` | `actor`, `action`, `entity`, `entityId`, `diff`, `ip`, `userAgent`, `createdAt` |
| `counters` | `key`, `seq` — atomic sequence for receipt/enrollment/entry numbers |

### 12.6 Index requirements

| Collection | Index | Purpose |
|---|---|---|
| `users` | `{ phone: 1 }` unique, `{ email: 1 }` sparse unique | Login |
| `members` | `{ memberCode: 1 }` unique, `{ status: 1, createdAt: -1 }`, text on `name/nameBn/phone/nid` | Search |
| `savingstransactions` | `{ member: 1, createdAt: -1 }`, `{ status: 1 }`, `{ receiptNo: 1 }` unique | Lists, queues |
| `savingsdues` | `{ member: 1, status: 1, dueDate: 1 }`, `{ member: 1, period: 1 }` unique | Dues |
| `journalentries` | `{ date: -1 }`, `{ entryNo: 1 }` unique, `{ 'lines.account': 1 }` | Trial balance |
| `auditlogs` | `{ createdAt: -1 }`, `{ actor: 1, createdAt: -1 }` | Audit UI |
| `documents` | `{ category: 1, createdAt: -1 }`, `{ member: 1 }` | Vault |

---

## 13. Business rules (normative)

### 13.1 Fixed savings schemes

| Scheme | Principal | Due date | Late fee |
|---|---|---|---|
| Monthly | ৳10,000 (`1_000_000` paisa) | 20th of each month | 5% after due date |
| Half-yearly | ৳50,000 (`5_000_000` paisa) | 30 June and 31 December | 5% after due date |
| One-time | Ad hoc (≥ ৳1) | None | 0% |

Rules:

- **BR-1** Dues are generated idempotently per `(member, scheme, period)`; re-running generation must not duplicate.
- **BR-2** `lateFeePaisa = round(principalPaisa × lateFeePercent / 100)` applied once the due date has passed.
- **BR-3** Partial payment of a due is rejected; the payable amount is `principal + lateFee`.
- **BR-4** A paid due produces exactly one `SavingsTransaction` (type `deposit`) and one journal entry.
- **BR-5** A withdrawal may not exceed the account's `balancePaisa`, evaluated transactionally at posting.
- **BR-6** Cash deposits and **all** withdrawals require approval before posting (see §13.4).
- **BR-7** Receipt numbers follow `SNN-RCP-<year>-<seq>` via the `counters` collection.

### 13.2 Chart of accounts

| Code | Account | Type |
|---|---|---|
| 1000 | Cash | asset |
| 1010 | Bank | asset |
| 1020 | bKash | asset |
| 1030 | Nagad | asset |
| 1040 | Rocket | asset |
| 2000 | Member Savings Payable | liability |
| 2100 | Member Share Capital | equity |
| 3000 | General Fund | equity |
| 4000 | Membership Fee Income | income |
| 4100 | Service Charge Income | income |
| 5000 | Admin Expense | expense |
| 5100 | Interest Expense | expense |

Payment method → asset account: `cash→1000`, `bank_transfer|sslcommerz→1010`, `bkash→1020`, `nagad→1030`, `rocket→1040`.

**BR-8** Every journal entry must satisfy `Σ debit = Σ credit` and have ≥ 2 lines. Enforced in the service layer **and** by a pre-save validator.

### 13.3 Expense approval (3-tier)

```
draft ──submit──▶ pending_treasurer ──▶ pending_gs ──▶ pending_president ──▶ approved
                        │                   │                  │
                        └──── reject ───────┴──────────────────┴──▶ rejected
```

- **BR-9** A user may not approve their own request (`requestedBy !== actor`).
- **BR-10** Only the role mapped to the current stage may decide (`EXPENSE_APPROVAL_ROLES`).
- **BR-11** Rejection requires a non-empty comment.
- **BR-12** `approved` posts one journal entry (debit expense account, credit asset account).

### 13.4 Approval policy

| Trigger | Requirement |
|---|---|
| Cash deposit | 1 approver, not the recorder |
| Withdrawal (any amount) | 1 approver, not the recorder |
| Deposit ≥ `APPROVAL_THRESHOLD_TAKA` (default ৳10,000) | 2 distinct approvers |
| Manual journal adjustment | `super_admin` only, audit-logged |

### 13.5 Audit

- **BR-13** Every state change on Member, Transaction, Payment, Expense, JournalEntry, Role, User writes an `AuditLog` with actor, entity, action, and a field-level diff.
- **BR-14** Audit logs are append-only; no update/delete route exists.

### 13.6 Rounding and time zone

- All amounts integer paisa.
- Storage in UTC; display in `Asia/Dhaka` (UTC+6).
- "Today's collection" is computed against the Dhaka business day, not server-local midnight.

---

## 14. API specification

Base path `/api`. All responses are `{ data }` or `{ error: { code, message, details? } }`.

### 14.1 Auth — `/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/login` | public | `{ identifier, password }` → user + cookie |
| POST | `/logout` | session | Clears cookie |
| GET | `/me` | session | Current user |
| POST | `/change-password` | session | `{ currentPassword, newPassword }` |

Rate limit: 5 login attempts / 15 min / IP+identifier.

### 14.2 Members — `/members`

`GET /` (search, `status`, pagination) · `POST /` · `GET /:id` · `PATCH /:id` · `POST /:id/photo` · `GET /:id/statement` · `GET /me` · `PATCH /me`.

### 14.3 Savings — `/savings`

`GET /transactions` · `POST /transactions` · `GET /transactions/:id` · `POST /transactions/:id/approve` · `GET /dues` · `POST /dues/generate` · `POST /dues/:id/pay` · `GET /me` · `GET /me/dues` · `GET /me/statement`.

### 14.4 Schemes — `/schemes`

`GET /` · `POST /` · `PATCH /:id` · `POST /:id/enroll` · `GET /:id/enrollments` · `GET /me`.

### 14.5 Approvals — `/approvals`

`GET /` · `GET /slips` · `POST /:id/decide` · `GET /:id`.

### 14.6 Expenses — `/expenses`

`GET /` · `POST /` · `GET /:id` · `PATCH /:id` · `POST /:id/submit` · `POST /:id/decide` · `GET /categories`.

### 14.7 Payments — `/payments`

`GET /` · `POST /initiate` · `POST /slip` (multipart) · `GET /:id` · `POST /:id/verify` · `POST /:id/reject`.

### 14.8 Ledger — `/ledger`

`GET /accounts` · `GET /entries` · `GET /trial-balance` · `POST /adjustments` (super_admin).

### 14.9 Documents — `/documents`

`GET /` · `POST /` (multipart) · `GET /:id/download` · `DELETE /:id` · `GET /me`.

### 14.10 Dashboard, reports, audit, roles, health

`GET /dashboard/summary` · `GET /dashboard/trend` · `GET /reports/collection` · `GET /reports/overdue` · `GET /reports/late-fee` · `GET /reports/income-expense` · `GET /reports/export?format=csv|pdf` · `GET /audit` · `GET /roles` · `POST /roles` · `PATCH /roles/:id` · `DELETE /roles/:id` · `GET /health` · `GET /system` · `GET /system/stream` (SSE).

### 14.11 Error codes

| HTTP | `code` | UI treatment |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Field errors from `details` |
| 401 | `INVALID_CREDENTIALS`, `SESSION_EXPIRED` | Form error / redirect |
| 403 | `FORBIDDEN`, `CORS_DENIED` | "No permission" state |
| 404 | `NOT_FOUND` | Empty state |
| 409 | `DUPLICATE`, `STATE_CONFLICT` | Inline warning |
| 422 | `BUSINESS_RULE_VIOLATION` | Explains the rule breached |
| 429 | `RATE_LIMITED` | Retry-after message |
| 500 | `INTERNAL_ERROR` | Generic + correlation ID |

---

## 15. WordPress content migration

### 15.1 Content inventory (Phase 0 deliverable)

Produce `docs/content-inventory.csv` with one row per URL:

```
url,type,status,title,lang,updated_at,word_count,featured_image,inbound_links,action,target
```

`action ∈ {keep, merge, redirect, retire}`. `target` is the Next.js path.

### 15.2 Content model

```
src/content/
├─ notices/2026-10-annual-general-meeting.mdx
├─ policies/savings-and-dues.mdx
└─ policies/expense-approval.mdx
```

Frontmatter schema (Zod-validated at build):

```ts
export const Frontmatter = z.object({
  title: z.string(),
  titleBn: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  category: z.enum(['notice', 'policy', 'news']),
  summary: z.string().max(200),
  coverImage: z.string().optional(),
  visibility: z.enum(['public', 'members']).default('public'),
  draft: z.boolean().default(false),
});
```

A build fails on invalid frontmatter — content errors cannot reach production.

### 15.3 Redirect map

`next.config.mjs` reads `docs/redirects.json`, generated from the inventory:

```json
[
  { "source": "/2024/06/annual-meeting/", "destination": "/notices/annual-meeting-2024", "permanent": true },
  { "source": "/wp-content/uploads/:path*", "destination": "/media/:path*", "permanent": true },
  { "source": "/feed/", "destination": "/notices/rss.xml", "permanent": true },
  { "source": "/?p=:id", "destination": "/", "permanent": true }
]
```

Rules:

- 308 for all content moves; never 302.
- Redirect chains must be ≤ 1 hop (CI check).
- `wp-admin`, `wp-login.php`, `xmlrpc.php` → 410 Gone.
- Redirect table is capped at 1,000 entries; beyond that, normalise.

### 15.4 Metadata

`generateMetadata()` per route: title template `%s · স্বপ্ননীড় সমবায় সমিতি`, description ≤ 160 chars, canonical (absolute), `alternates.languages` for bn/en, Open Graph (1200×630) and Twitter card. Notice pages additionally emit `Article` JSON-LD; the organisation home emits `Organization` + `NGO`-style `Organization` with `address` and `foundingDate`.

### 15.5 Sitemap and robots

- `app/sitemap.ts` enumerates `(public)` routes + all published notices/policies with `lastModified` and locale alternates.
- `app/robots.ts` allows `(public)`, disallows `(app)` prefixes and `/api/`.
- Preview deployments send `X-Robots-Tag: noindex`.

### 15.6 Forms

| Form | Handler | Anti-abuse |
|---|---|---|
| Contact | Server Action → rate-limited queue | Honeypot + 3/hour/IP + Zod |
| Membership enquiry | Server Action | Same |
| Login | API | 5/15 min + lockout message |

No WordPress plugin survives; no `mail()` from the web tier.

### 15.7 Headless-CMS contingency

If A3 is false (> 300 URLs or non-technical editors must publish daily), keep the same Next.js surface but swap the content layer for a headless CMS (Sanity/Strapi) behind `src/lib/content.ts`:

```ts
export interface ContentRepository {
  listNotices(page: number): Promise<Paginated<Notice>>;
  getNotice(slug: string): Promise<Notice | null>;
  listPolicies(): Promise<Policy[]>;
}
```

Only this module changes; routes and components are unaffected. Decide before Phase 3.

---

## 16. Media migration

1. Enumerate `wp-content/uploads` from the inventory; export originals with checksums.
2. Upload to object storage under `media/<yyyy>/<mm>/<sha256>.<ext>` (content-addressed → immutable caching).
3. Rewrite references in MDX via a codemod; verify zero 404s with a link checker.
4. Images render through `next/image` with explicit `width`/`height` or `fill` + sized container. No CLS.
5. Formats: serve AVIF/WebP; keep originals for documents (PDF retain as-is).
6. Documents (policies, resolutions) move to the vault (`documents` collection) and are linked, not duplicated.
7. Retire WP media only after 90 days of clean access logs.

Size limits: image ≤ 5 MB, document ≤ 5 MB, allowed MIME (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, Word/Excel). Verify magic bytes, not just `Content-Type`.

---

## 17. Internationalization

| Aspect | Decision |
|---|---|
| Default locale | `bn` (`<html lang="bn">`) |
| Secondary | `en` |
| Mechanism | Key-based dictionaries in `src/lib/i18n/{bn,en}.ts`, typed `I18nKey` union |
| Switching | Cookie `lang` + `router.refresh()`; no URL prefix (avoids redirect churn for SEO) |
| Content | Public content carries `title`/`titleBn`; UI prefers locale, falls back to the other |
| Numbers | `Intl.NumberFormat('bn-BD')` renders Bengali numerals; `en-BD` renders Latin |
| Dates | `Intl.DateTimeFormat` with `Asia/Dhaka`; Bengali month names for `bn` |
| Currency | `৳` prefix in bn, `BDT` suffix in en tables |
| Fonts | `next/font` self-hosted Inter + Hind Siliguri; `html[lang=bn]` uses Hind Siliguri |
| Typing | `tr(key, params)` rejects unknown keys at compile time |

Deliverable: `scripts/i18n-audit.ts` fails CI when a key is missing in either locale or unused for both.

---

## 18. Design system

### 18.1 Tokens (from `tailwind.config.js`)

| Token | Hex | Usage |
|---|---|---|
| `brand.50` | `#FDFBF7` | Page background |
| `brand.100` | `#F7EEDD` | Tint surface |
| `brand.200` | `#E2C475` | Borders |
| `brand.300` | `#D4AF37` | Gold accent |
| `brand.700` | `#6B1D2F` | Primary actions |
| `brand.800` | `#531322` | Hover |
| `brand.900` | `#3D0D18` | Pressed |
| `brand.950` | `#2D151B` | Text |

Semantic aliases to add: `--surface`, `--surface-muted`, `--border`, `--text`, `--text-muted`, `--primary`, `--primary-hover`, `--accent`, `--danger`, `--success`, `--warning`. Components consume aliases, never raw palette values, so a rebrand is one file.

### 18.2 Component inventory (target)

`Button` (primary/secondary/ghost/danger × sm/md/lg, loading), `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Field` (label + hint + error), `Modal`, `Drawer`, `Tabs`, `Table` (+ `Toolbar`, `Pagination`, `EmptyState`), `Badge`/`StatusBadge`, `Card`, `StatCard`, `Progress`, `Avatar`, `Tooltip`, `Dropdown`, `Toast`, `Skeleton`, `DateRangePicker`, `MoneyInput`, `ConfirmDialog`, `PrintLayout`.

### 18.3 Rules

- No ad-hoc colour classes in feature code; use tokens.
- Minimum touch target 44×44 px.
- Focus ring visible on every interactive element (`focus-visible:ring-2`).
- Dark mode is **not** in scope for v1; tokens are structured to allow it later.
- Print styles (receipts, certificates, statements) are first-class: `@media print` hides chrome, expands the panel.

---

## 19. Accessibility (WCAG 2.2 AA)

| Requirement | Implementation |
|---|---|
| Landmarks | `header`, `nav`, `main`, `footer` in shell; one `h1` per page |
| Focus order | Sidebar → topbar → main; skip-link as first tab stop |
| Keyboard | All menus/modals dismissible with `Esc`; `aria-expanded`/`aria-haspopup` set |
| Forms | Every input has a `<label>`; errors linked with `aria-describedby` and `role="alert"` |
| Tables | `<th scope="col">`; caption or `aria-label` |
| Contrast | ≥ 4.5:1 body, ≥ 3:1 large text — gold on maroon verified |
| Motion | `prefers-reduced-motion` disables `reveal-up`/`slide-up` |
| Language | `lang` set per document and per `<span lang="en">` when inline |
| Status messages | Toasts in a polite live region; approvals confirmed with text, not colour alone |

Gate: axe-core zero critical violations on every route in CI.

---

## 20. Performance budgets

| Metric | Budget (mobile, p75) | Measured by |
|---|---|---|
| LCP | ≤ 2.0 s | Lighthouse CI |
| INP | ≤ 200 ms | field/RUM |
| CLS | ≤ 0.05 | Lighthouse CI |
| TTFB (public, cached) | ≤ 200 ms | synthetic |
| JS shipped, public page | ≤ 120 kB gzip | `next build` report |
| JS shipped, app shell | ≤ 260 kB gzip | `next build` report |
| Route chunk regression | +10 kB fails PR | bundle analyser diff |
| Images | AVIF/WebP, `sizes` set, no upscaling | review |

Techniques: RSC-first, dynamic import for charts/PDF, `next/font`, `next/image`, no client-side data fetching on first paint, `loading.tsx` skeletons to stabilise CLS.

---

## 21. Security

| Control | Specification |
|---|---|
| Transport | HTTPS only; HSTS `max-age=31536000; includeSubDomains; preload` |
| Session | `HttpOnly; Secure; SameSite=Lax` session cookie (cleared on browser close) |
| CSRF | `X-Requested-With` custom header requirement (already enforced) + SameSite cookie + Origin allowlist |
| CSP | `default-src 'self'`; no `unsafe-eval`; `style-src 'self' 'unsafe-inline'` only if required by Tailwind runtime (should be none); `frame-ancestors 'self'` |
| Headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal |
| Rate limiting | Global 300/15 min/IP; login 5/15 min; uploads 20/h/user |
| Input validation | Zod at the edge **and** `express-validator` at the API |
| Authorisation | Per-route role check + ownership check on every `/:id` |
| Uploads | MIME + magic-byte check, size cap, randomised names, no execution path, served from a separate origin or signed URL |
| Secrets | Environment only; `JWT_SECRET` ≥ 32 random bytes; boot fails if missing in production |
| XSS | No `dangerouslySetInnerHTML` except sanitised MDX output; MDX compiled at build |
| Dependency hygiene | `npm audit --omit=dev` in CI, Dependabot, lockfile committed |
| Logging | Never log passwords, tokens, NID, or full account numbers |
| PII | NID masked in lists (`••••••••1234`); full value only on the member detail screen for authorised roles |
| Audit | Immutable audit trail for every financial mutation |

Threat notes: the previous `localStorage` token storage is an XSS-exfiltration risk and is removed by D6/§11.

---

## 22. Observability

| Signal | Tool | Notes |
|---|---|---|
| Errors (server) | Sentry (or OpenTelemetry collector) | Include `requestId`; scrub PII |
| Errors (client) | Sentry browser SDK | Sample 10% |
| RUM | `web-vitals` → endpoint | LCP/INP/CLS per route |
| Structured logs | JSON to stdout | `{ level, requestId, userId?, route, durationMs, status }` |
| Health | `GET /api/health`, `GET /api/system` | Used by load balancer |
| Uptime | External probe every 60 s | Alerts to on-call |
| Audit | MongoDB `auditlogs` | Retained ≥ 7 years (cooperative records) |

Alerts: 5xx rate > 1% for 5 min; p95 latency > 1 s for 10 min; login failure spike; ledger imbalance (must page immediately); disk/storage > 80%.

**Ledger invariant monitor:** a scheduled job recomputes `Σ debit − Σ credit` for the last 30 days and pages if non-zero. This is the single most important financial safety net.

---

## 23. Testing strategy

| Level | Tool | Coverage target | Scope |
|---|---|---|---|
| Unit | Vitest | ≥ 80% on `lib/` + `schemas/` | money, dates, permissions, formatting, Zod schemas |
| Component | Vitest + Testing Library | Critical primitives | Button, Input, Modal, Table, StatusBadge, MoneyInput |
| Integration (API) | `node --test` + supertest + mongodb-memory-server | ≥ 85% on services | Auth, savings posting, dues generation, approvals, ledger balance |
| E2E | Playwright | Every route + 8 critical journeys | Login, record deposit, approve withdrawal, pay due, submit expense through 3 tiers, upload slip, generate certificate, export report |
| Contract | Vitest | 100% of shared enums | `constants.js` ↔ `permissions.ts` |
| Accessibility | `@axe-core/playwright` | Zero critical | All routes |
| Visual | Playwright snapshots | Key components | Buttons, tables, receipts (print) |

Critical E2E journeys must run against a seeded database and assert **ledger balance after each financial action** — UI green is not sufficient evidence that money moved correctly.

---

## 24. Environments and CI/CD

### 24.1 Environments

| Env | Web | API | DB | Purpose |
|---|---|---|---|---|
| Local | `next dev :3000` | `node --watch :4000` | `mongodb://127.0.0.1:27017/shomiti` | Development |
| Preview | Vercel preview / container per PR | Staging API | Staging DB (anonymised) | Review, noindex |
| Staging | `staging.shomiti.com` | Staging API | Staging DB | UAT, content sign-off |
| Production | `shomiti.com` | `api.shomiti.com` (or same-origin `/api` proxy) | Replica set + backups | Live |

### 24.2 Pipeline

```
PR → lint + typecheck + unit + build (bundle-budget check) + e2e (smoke)
   → preview deploy → visual + a11y diff
merge to main → build image → migrate nothing (no DB migrations in web)
   → deploy staging → e2e full → manual approval → deploy production (blue/green)
```

Gates (must pass to merge):
1. `tsc --noEmit` clean.
2. ESLint clean, zero warnings.
3. Unit + integration tests green.
4. Playwright critical journeys green.
5. Bundle budget respected.
6. `i18n-audit` clean.
7. Redirect-map lint (no chains, no 404 targets).

### 24.3 Configuration (`frontend`)

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | `/api` (proxied) or `https://api.shomiti.com/api` |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://shomiti.com` |
| `API_INTERNAL_URL` | server | `http://api:4000/api` |
| `SESSION_COOKIE_NAME` | no | `sn_token` |
| `NEXT_PUBLIC_PAYMENT_GATEWAY` | no | `sslcommerz` |
| `SENTRY_DSN` | no | — |

`backend` keeps its existing configuration surface (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `UPLOAD_DIR`, `APPROVAL_THRESHOLD_TAKA`, `BCRYPT_ROUNDS`, seed variables) with `CLIENT_ORIGIN` updated to the new hosts.

### 24.4 Proxy

`next.config.mjs` keeps a rewrite so `/api/*` proxies to the API and cookies stay first-party:

```js
async rewrites() {
  const base = (process.env.API_INTERNAL_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
  return [{ source: '/api/:path*', destination: `${base}/api/:path*` }];
}
```

Same-origin means `SameSite=Lax` cookies work without `Domain` gymnastics and CORS is unnecessary in production.

---

## 25. Migration execution plan

### 25.1 Phase 0 — Audit and baseline (1 week)

- Crawl WordPress: URLs, status codes, titles, meta descriptions, inbound links, top pages.
- Export media manifest with checksums.
- Confirm/deny A1–A6.
- Baseline current app: Lighthouse, route list, auth behaviour, seed data.
- **Exit:** `content-inventory.csv`, `redirects.json` draft, signed-off assumptions.

### 25.2 Phase 1 — Foundations (1 week)

- `tsconfig.json`, ESLint/Prettier, Tailwind config as TS.
- Route groups, `middleware.ts`, typed API client, Zod infra.
- Design-system primitives converted to TS.
- Sentence: app still runs exactly as today, but typed.
- **Exit:** build green, all 25 existing routes render, no visual diff.

### 25.3 Phase 2 — Public site (2 weeks)

- Home, about, notices, policies, contact.
- MDX pipeline with frontmatter validation.
- Metadata, sitemap, robots, JSON-LD, OG images.
- Redirect map wired.
- **Exit:** staging public site passes a11y/perf budgets and a crawl finds zero broken internal links and zero 404s from the redirect map.

### 25.4 Phase 3 — Application TypeScript conversion (2–3 weeks)

- Convert `(app)` routes in the order of §6.3, each behind its Playwright smoke test.
- Replace `localStorage` token with cookie session.
- Delete `/`-as-login duplication; `/` becomes public home.
- Build the 6 missing routes (§8.4).
- **Exit:** `allowJs: false`, zero `any`, all critical journeys green.

### 25.5 Phase 4 — Content cutover (1 week) and Phase 5 — Hardening (1 week)

- Freeze WordPress editing; final content sync; DNS/TLS prep.
- Load test (k6: 200 VU, read-heavy, 5 min).
- Security review, dependency audit, backup/restore drill.
- **Exit:** signed runbook, rollback rehearsed in staging.

### 25.6 Cutover sequence (production)

| T# | Step | Owner | Verify |
|---|---|---|---|
| T-7d | Freeze WP content edits; announce | Ops | Change log closed |
| T-1d | Final staging deploy; full e2e | Eng | Green |
| T-0 06:00 | Snapshot DB + media | Eng | Checksums match |
| T-0 07:00 | Deploy Next.js; switch DNS/CDN | Eng | `/` 200, `/login` 200 |
| T-0 07:15 | Smoke: 10 URLs + login + deposit read-only | Eng | Pass |
| T-0 08:00 | Enable 308 redirects; submit sitemap | Eng | GSC accepted |
| T-0 +24h | Monitor 5xx, 404s, LCP, login failures | Eng | Within budgets |
| T+7d | Keep WP read-only at `old.shomiti.com` | Ops | No traffic |
| T+30d | Decommission WP, revoke credentials | Ops | Archived backup |

### 25.7 Rollback

Trigger conditions: 5xx > 5% for 10 min, login unavailable, ledger imbalance, data loss.
Steps: repoint DNS/CDN to the WP origin (≤ 15 min, DNS TTL 300 s), disable new writes if any migration touched data (none should), post-incident review within 48 h. **No database rollback is expected** because the migration does not alter financial data.

---

## 26. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | SEO loss from bad redirects | Medium | High | Inventory-driven map, chain lint, GSC monitoring, 30-day watch |
| R2 | Financial regression during TS conversion | Low | Critical | No logic rewrites; ledger-balance assertions in E2E; invariant monitor |
| R3 | `localStorage` token removal breaks existing sessions | High (once) | Medium | One-time forced re-login at cutover; communicate |
| R4 | Bengali text rendering/line-height issues | Medium | Medium | Hind Siliguri self-hosted; visual snapshots per locale |
| R5 | Missing routes surfaced by typed nav test | High | Low | Build them (§8.4) |
| R6 | Scope creep into accounting changes | Medium | High | Change-control; accounting changes need separate spec |
| R7 | Content editors blocked by MDX workflow | Medium | Medium | Templates + PR review SLA; escalate to §15.7 |
| R8 | Server Action misuse leaking privileged data | Low | High | RSC-only API calls; code review checklist; no server modules imported into client |
| R9 | Time-zone drift in "today" figures | Medium | Medium | Dhaka-boundary tests in unit suite |
| R10 | Backup restore never tested | Medium | Critical | Quarterly restore drill; documented RTO ≤ 4 h, RPO ≤ 24 h |

---

## 27. Acceptance criteria

The migration is complete when **all** of the following hold:

**Functional**
1. Every URL in `content-inventory.csv` resolves to a 200 or an intentional 308 to a 200.
2. All 25 existing routes plus 6 missing routes exist, are reachable, and are role-correct.
3. Login, logout, session expiry, and forced password change work through the cookie flow.
4. Every CRUD action available before the migration is available after it.
5. Bengali and English render without missing keys (`i18n-audit` clean).

**Financial integrity**
6. Recording a deposit, paying a due, and approving an expense each produce a balanced journal entry (`Σ debit = Σ credit`).
7. Dues generation is idempotent: running twice produces zero duplicates.
8. Partial payment of a due is rejected with an explanatory message.
9. A user cannot approve their own request.
10. Audit log contains an entry for every financial mutation performed during the E2E suite.

**Quality**
11. Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 on public pages.
12. axe-core: zero critical violations on every route.
13. Zero TypeScript errors, zero ESLint warnings, zero `any` in `src/`.
14. Unit ≥ 80%, API service ≥ 85%, all critical E2E journeys green.
15. JS budgets met (§20).

**Operational**
16. Blue/green deploy and rollback rehearsed in staging.
17. Backup restore drill completed with verified row counts.
18. Ledger invariant monitor running and alerting to a real channel.
19. Runbook published: deploy, rollback, restore, rotate secrets.
20. WordPress decommissioned with an archived, checksummed backup.

---

## Appendix A — Route/component traceability

| Today | Target | Change |
|---|---|---|
| `app/page.jsx` (login) | `app/(public)/page.tsx` (home) | Replaced; login moves to `(auth)` |
| `app/login/page.jsx` | `app/(auth)/login/page.tsx` | Kept, typed |
| `app/dashboard/page.jsx` | `app/(app)/dashboard/page.tsx` | Kept, typed, RSC data |
| `app/members/page.jsx` | `app/(app)/members/page.tsx` | Kept + detail/edit/create |
| `app/savings/**` | `app/(app)/savings/**` | Kept + `/savings/my*` |
| `app/schemes/page.jsx` | `app/(app)/savings/config` merge | Decide: scheme config lives under savings |
| `app/approvals/page.jsx` | `app/(app)/approvals/page.tsx` | Kept |
| `app/expenses/page.jsx` | `app/(app)/expenses/**` | Kept + create/categories |
| `app/ledger/page.jsx` | `app/(app)/ledger/page.tsx` | Kept |
| `app/documents/page.jsx` | `app/(app)/documents/**` | Kept + `/documents/my` |
| `app/meetings|reports|audit|users|roles|settings|profile|statement|certificate|notifications` | `app/(app)/…` | Kept, typed |
| `components/layout/AppShell.jsx` | `app/(app)/layout.tsx` + shell components | Split server/client |
| `lib/auth.js` | `lib/auth.ts` + `lib/session.ts` | Cookie session |
| `lib/i18n.js` | `lib/i18n/{bn,en}.ts` | Split, typed keys |
| `jsconfig.json` | `tsconfig.json` | Removed |

## Appendix B — Definition of Done (per route)

- [ ] `.tsx`, no `any`, props typed
- [ ] Server Component unless interactivity requires otherwise
- [ ] `loading.tsx` and `error.tsx` present
- [ ] Role gate enforced in layout **and** API
- [ ] All strings via `tr()`; keys present in bn + en
- [ ] Empty, loading, error, and permission-denied states designed
- [ ] Keyboard navigable; axe clean
- [ ] Works at 360 px, 768 px, 1280 px
- [ ] Playwright smoke test
- [ ] Money via `formatMoney`; dates via `formatDate` (Dhaka)
- [ ] No console errors or hydration warnings

## Appendix C — Glossary

| Term | Meaning |
|---|---|
| Somiti | Cooperative society |
| Bazar/period | Savings cycle used for due generation |
| Paisa | 1/100 of a taka; the only stored money unit |
| Due | A scheduled savings obligation for a member and period |
| Slip | Uploaded proof of an offline bank/mobile-wallet payment |
| Tier | One of three sequential expense approval stages |
| RSC | React Server Component |
| BFF | Backend-for-frontend: the Next.js layer that talks to the API |

---

**End of specification.** Changes to §13 (business rules) or §11.3 (permission matrix) require written approval from the Treasurer-domain owner and the Tech Lead, because they alter financial or access behaviour rather than presentation.
