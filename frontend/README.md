# SHOMITI Frontend

Next.js 14 App Router client for the Shopnonir Somobai Somitee cooperative management system. Provides a bilingual (Bangla/English) interface for staff and members: dashboard, members, savings and schemes, expenses, approvals, ledger, documents, meetings, reports, audit logs, user and role management.

## Tech stack

- Next.js 14 (App Router, JavaScript)
- React 18
- Tailwind CSS
- Zustand (auth store)
- Axios (API client)
- lucide-react icons
- react-toastify notifications
- date-fns formatting

## Project structure

```
frontend/
├── app/                       # App Router pages
│   ├── dashboard/
│   ├── members/
│   ├── savings/               # savings, dues, config, my/schemes
│   ├── schemes/
│   ├── expenses/
│   ├── approvals/
│   ├── ledger/
│   ├── documents/
│   ├── meetings/
│   ├── reports/
│   ├── audit/
│   ├── users/
│   ├── roles/
│   ├── settings/
│   ├── payments/              # member portal: pay now, offline payment
│   ├── profile/
│   ├── statement/
│   ├── certificate/
│   ├── notifications/
│   ├── login/
│   └── reset-password/
├── components/
│   ├── layout/
│   │   ├── AppShell.jsx       # session guard, header, footer, toaster
│   │   ├── SidebarV2.jsx      # role-aware sidebar
│   │   ├── GlobalSearch.jsx   # page + record search
│   │   └── SearchParamSync.jsx
│   └── ui/
│       ├── common.jsx         # Icon, Button, Table, Modal, Badge, ...
│       ├── form.jsx           # form sections and actions
│       ├── RoleModal.jsx
│       └── UserEditModal.jsx
├── lib/
│   ├── api.js                 # Axios client + interceptors
│   ├── auth.js                # Zustand auth store and helpers
│   ├── i18n.js                # Bangla/English dictionaries
│   ├── navigation.js          # role-filtered sidebar configuration
│   ├── useApi.js              # data fetching hook
│   └── useLang.js             # translation hook
├── styles/
├── public/
├── next.config.js             # /api rewrite proxy
└── tailwind.config.js
```

## Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Start the dev server:

```bash
npm run dev
```

The app runs on http://localhost:3000. API calls to `/api/*` are proxied to the backend using the rewrite in `next.config.js`, and the Axios client also sends credentials and the CSRF header.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run Next.js ESLint (prompts initial setup if no config exists) |

## Authentication and session

- Login posts to `/auth/login` with `{ identifier, password }` and receives a JWT; the backend also sets the `sn_token` httpOnly cookie.
- `lib/auth.js` keeps the authenticated user in a Zustand store (`loadSession`, `login`, `logout`, `hasRole`, permission helpers).
- `AppShell` loads the session on mount and redirects unauthenticated visitors to `/login?next=...`.
- A `401` response triggers the `session-expired` event handled by the shell.

## API client

`lib/api.js` provides `apiClient` (`get`, `post`, `patch`, `delete`, `upload`) with:

- `baseURL` from `NEXT_PUBLIC_API_URL` (default `/api`)
- `withCredentials: true`
- `X-Requested-With: XMLHttpRequest` header (required by backend CSRF middleware)
- `Accept-Language` set from the active locale
- normalized `ApiError` objects with `status`, `code`, `message`, `details`

`lib/useApi.js` wraps GET requests with loading/error state, pagination query params, and a `reload()` helper.

## Sidebar navigation

`lib/navigation.js` defines one canonical four-section layout. Items are filtered by role, and sections with no visible items are dropped automatically:

1. **Core** — Dashboard
2. **Finance & Operations** — Savings & Schemes, Expenses, General Ledger, Approvals (pending badge)
3. **Communication & Assets** — Meetings & Notices, Document Vault
4. **System & Insights** — Members, Users & Roles, Reports, Audit Logs, Settings

Role visibility (staff):

| Item | super_admin | treasurer | general_secretary | president |
| --- | --- | --- | --- | --- |
| Dashboard | yes | yes | yes | yes |
| Savings & Schemes | yes | yes | yes | no |
| Expenses | yes | yes | yes | no |
| General Ledger | yes | yes | no | no |
| Approvals | yes | yes | yes | yes |
| Meetings & Notices | yes | no | yes | no |
| Document Vault | yes | yes | yes | yes |
| Members | yes | yes | yes | no |
| Users & Roles | yes | no | no | no |
| Reports | yes | yes | yes | yes |
| Audit Logs | yes | no | no | no |
| Settings | yes | yes | yes | no |

The `member` role gets its own items inside the same four sections (my savings, my schemes, my dues, pay now, offline payment, my documents, certificate, profile, statement, notifications).

Labels resolve through `navLabel()`, which falls back to a readable title when a translation key is missing, so raw keys never appear in the UI. Collapsed sidebar state is handled by `AppShell` and `SidebarV2` (icon-only mode with tooltips).

## Internationalization

- `lib/i18n.js` holds the full Bangla (`bn`, default) and English (`en`) dictionaries.
- `lib/useLang.js` exposes `tr(key, params)` and `setLang`.
- The language switcher lives in the profile menu; the choice is persisted and broadcast through a `languagechange` event.

## Page map

| Route | Purpose |
| --- | --- |
| `/dashboard` | KPIs, recent transactions, quick actions |
| `/members` | Member registry (add/edit/suspend) |
| `/savings` | Savings accounts and transactions |
| `/savings/dues` | Due list and collection |
| `/savings/config` | Savings configuration |
| `/schemes` | Savings schemes and enrollments |
| `/expenses` | Expense requests and categories |
| `/approvals` | Pending approvals and slip verification |
| `/ledger` | Chart of accounts and journal entries |
| `/documents` | Document vault |
| `/meetings` | Meetings, notices and resolutions |
| `/reports` | Financial reports and exports |
| `/audit` | Audit trail |
| `/users` | Staff and member accounts |
| `/roles` | Custom roles and permissions |
| `/settings` | General settings, user management, audit |
| `/payments`, `/payments/offline` | Member payments |
| `/profile`, `/statement`, `/certificate`, `/notifications` | Member portal |
| `/login`, `/reset-password` | Authentication |

## Production build

```bash
npm run build
npm run start
```

Run the frontend and backend as separate services in production. The backend `SERVE_FRONTEND` option only serves static files from the frontend directory; it does not replace the Next.js server.
