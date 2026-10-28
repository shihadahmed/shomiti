# SHOPNONIR SOMOBAI SOMITEE (SHOMITI)

A full-stack cooperative management system for member records, savings, dues, schemes, payments, expenses, multi-level approvals, double-entry ledger, documents, reports, audit trails, and role-based access control.

The project is split into two applications:

| App | Stack | README |
| --- | --- | --- |
| `backend/` | Node.js 20, Express 5, MongoDB (Mongoose 9), JWT, bcrypt | [backend/README.md](backend/README.md) |
| `frontend/` | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand, Axios | [frontend/README.md](frontend/README.md) |

Detailed technical design: [docs/TECHNICAL-SPEC.md](docs/TECHNICAL-SPEC.md)

## Features

- Member registry with NID, nominee and status lifecycle
- Savings accounts, fixed schemes, due generation and late fees
- Payments (cash, bKash, Nagad, Rocket, bank transfer, SSLCommerz placeholders)
- Multi-tier expense approval workflow (Treasurer -> General Secretary -> President)
- Double-entry general ledger with chart of accounts
- Document vault with upload, categories and member certificates
- Dashboard, financial reports, CSV/PDF export
- Full audit trail for security-sensitive actions
- Granular RBAC with system and custom roles
- Bilingual UI (Bangla default, English toggle)
- Super Admin protection: account cannot be deleted, role cannot be deleted and stays hidden from role lists

## Repository layout

```
shomiti/
├── backend/                 # Express REST API + MongoDB models
│   ├── src/
│   │   ├── config/          # env, database, constants
│   │   ├── controllers/     # request handlers
│   │   ├── middleware/      # auth, authorize, csrf, rate limit, upload, errors
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # business logic
│   │   ├── utils/           # helpers (jwt, password, audit, money, ...)
│   │   ├── validators/      # express-validator rule sets
│   │   └── seed/            # manual seed script
│   ├── public/ops/          # backend operations console
│   └── tests/               # node:test + supertest integration tests
├── frontend/                # Next.js App Router client
│   ├── app/                 # route pages
│   ├── components/          # layout, ui, modals
│   ├── lib/                 # api client, auth store, i18n, navigation
│   └── public/              # static assets
├── docs/                    # technical specification
└── package.json             # root helper scripts
```

## Prerequisites

- Node.js >= 20
- MongoDB (Atlas cluster or a local MongoDB instance)
- npm

## Quick start

1. Install all dependencies:

   ```bash
   npm run install:all
   ```

2. Configure environment files:

   - `backend/.env` — copy values from the documented template inside the file and set at minimum:
     - `MONGODB_URI`
     - `JWT_SECRET`
     - `PORT` (default `4000`)
     - `CLIENT_ORIGIN` (default `http://localhost:3000`)
   - `frontend/.env`:
     - `NEXT_PUBLIC_API_URL=http://localhost:4000/api`

3. Seed the database (optional — the backend also seeds on startup):

   ```bash
   npm run seed
   ```

4. Start the backend (port 4000):

   ```bash
   npm run dev
   ```

5. Start the frontend (port 3000) in a second terminal:

   ```bash
   npm --prefix frontend run dev
   ```

6. Open http://localhost:3000 and sign in with a seeded account (see below).

## Root scripts

| Script | Description |
| --- | --- |
| `npm run install:all` | Install backend and frontend dependencies |
| `npm run dev` | Start the backend in watch mode |
| `npm start` | Start the backend in production mode |
| `npm run build` | Build the frontend for production |
| `npm run seed` | Run the backend seed script |
| `npm test` | Run backend tests |
| `npm run setup` | Install everything and build the frontend |

## Default seeded accounts

The backend creates these users on startup if they do not already exist (values are configurable through `SEED_*` environment variables):

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@shomiti.local` | `Admin@12345` |
| Treasurer | `treasurer@shomiti.local` | `Treasurer@12345` |
| General Secretary | `gs@shomiti.local` | `GS@12345` |
| President | `president@shomiti.local` | `President@12345` |

Change all passwords immediately after the first sign-in.

Note: seeding only creates missing users. If an account exists with an old password, it will not be overwritten. To reset it, delete the user from MongoDB and restart the backend, or use the password reset endpoint.

## Roles and access

| Role | Scope |
| --- | --- |
| `super_admin` | Full access to all modules, users, roles, ledger adjustments and audit logs. Cannot be deleted; the role is hidden from role management. |
| `president` | Final expense approval, documents, reports |
| `general_secretary` | Expense approval tier 2, members, meetings, documents, reports |
| `treasurer` | Savings, dues, payments, expenses tier 1, ledger, reports |
| `member` | Member portal: own profile, savings, dues, payments, documents, statement |

Permissions are granular (`members.view`, `savings.configure`, `roles.assign`, ...) and are enforced by backend middleware. The frontend sidebar renders the same four sections for every staff role, filtering items by role.

## Security notes

- Authentication uses a JWT stored in an httpOnly cookie (`sn_token`), with a bearer token also returned by the login endpoint.
- All mutating API calls require the `X-Requested-With: XMLHttpRequest` header (CSRF mitigation).
- Rate limiting is applied globally and to login/password endpoints.
- Passwords are hashed with bcrypt (`BCRYPT_ROUNDS`, default 12).
- Helmet security headers and an explicit CORS allowlist are enabled.
- Never commit `.env` files or real credentials.
