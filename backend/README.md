# SHOMITI Backend

REST API for the Shopnonir Somobai Somitee cooperative management system. Built with Express 5 and MongoDB, it exposes authentication, member, savings, scheme, payment, expense, approval, ledger, document, report, audit, and role management endpoints.

## Tech stack

- Node.js >= 20 (ES modules)
- Express 5
- MongoDB with Mongoose 9
- JWT authentication (httpOnly cookie + bearer token)
- bcryptjs password hashing
- express-validator request validation
- helmet, cors, express-rate-limit, morgan
- multer file uploads
- nodemailer (invite emails; JSON transport in local development)
- Tests: node:test, supertest, mongodb-memory-server

## Project structure

```
backend/
├── src/
│   ├── app.js                 # Express app, middleware, route mounting
│   ├── server.js              # startup, DB connect, role + data seeding
│   ├── config/
│   │   ├── env.js             # environment configuration + defaults
│   │   ├── db.js              # MongoDB connection helpers
│   │   └── constants.js       # roles, permissions, statuses, business rules
│   ├── controllers/           # thin request handlers
│   ├── middleware/
│   │   ├── auth.js            # JWT extraction + authenticate/optionalAuthenticate
│   │   ├── authorize.js       # requireRoles / requirePermission
│   │   ├── csrf.js            # X-Requested-With enforcement
│   │   ├── rateLimit.js       # global and login limiters
│   │   ├── upload.js          # multer configuration
│   │   ├── validate.js        # express-validator result handler
│   │   └── error.js           # notFound + errorHandler
│   ├── models/                # Mongoose schemas (User, Role, Member, savings,
│   │                          # payments, expenses, approvals, ledger, documents,
│   │                          # audit logs, counters)
│   ├── routes/                # route definitions, mounted under /api
│   ├── services/              # business logic per domain
│   ├── utils/                 # ApiError, asyncHandler, jwt, password, money,
│   │                          # pagination, sequence, audit
│   ├── validators/            # express-validator rule sets
│   └── seed/                  # standalone seed script
├── public/ops/                # operations console served at the backend root
├── tests/                     # integration tests
└── uploads/                   # uploaded documents (runtime, gitignored)
```

## Setup

```bash
cd backend
npm install
```

Create `backend/.env` (gitignored). Minimum required values:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/shomiti
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
```

Full configuration reference:

| Variable | Default (local) | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Enables production mode and stricter config checks |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/shomiti` | MongoDB connection string |
| `JWT_SECRET` | dev-only fallback locally | JWT signing secret (required in production) |
| `JWT_EXPIRES_IN` | `8h` | Access token lifetime |
| `COOKIE_NAME` | `sn_token` | Session cookie name |
| `PORT` | `4000` | HTTP port |
| `CLIENT_ORIGIN` | `http://localhost:3000,http://localhost:5173` | Comma-separated CORS allowlist |
| `FRONTEND_URL` | `http://localhost:3000` | Used in invite/reset links |
| `UPLOAD_DIR` | `uploads` | Upload directory (relative to backend root) |
| `MAX_UPLOAD_BYTES` | `5242880` | Maximum upload size (5 MB) |
| `APPROVAL_THRESHOLD_TAKA` | `10000` | Amount above which approvals are required |
| `BCRYPT_ROUNDS` | `12` | Password hash cost |
| `SERVE_FRONTEND` | `true` | Serve static files from the sibling `frontend/` directory (legacy static build; the Next.js app runs separately) |
| `MAIL_ENABLED` | `true` | Enable outgoing email |
| `MAIL_TRANSPORT` | `json` (local) / `smtp` | Nodemailer transport |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | — | SMTP credentials |
| `SMTP_FROM` | `SHOMITI <no-reply@shomiti.local>` | Sender address |
| `INVITE_TOKEN_TTL_HOURS` | `24` | Password setup link lifetime |
| `SEED_ADMIN_NAME` | `System Administrator` | Seeded super admin name |
| `SEED_ADMIN_EMAIL` | `admin@shomiti.local` | Seeded super admin email |
| `SEED_ADMIN_PHONE` | `01700000000` | Seeded super admin phone |
| `SEED_ADMIN_PASSWORD` | `Admin@12345` | Seeded super admin password |
| `SEED_TREASURER_*`, `SEED_GS_*`, `SEED_PRESIDENT_*` | see `.env` template | Seeded staff accounts |

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start with `node --watch` (auto reload) |
| `npm start` | Start once (production) |
| `npm run seed` | Seed users, savings schemes and chart of accounts |
| `npm test` | Run integration tests (`node --test`) |

## Startup and seeding

`src/server.js` performs the following on boot:

1. Connects to MongoDB.
2. Initializes default system roles (if the role collection is empty).
3. Seeds default users (only if missing), fixed savings schemes and the chart of accounts.
4. Starts the HTTP server.

Seeding is idempotent: existing users are never overwritten. Deleting a user and restarting the backend recreates the default account with the password from `.env`.

## API overview

Base URL: `http://localhost:4000/api`

| Prefix | Domain |
| --- | --- |
| `/auth` | Login, logout, session, password change/setup, user management |
| `/members` | Member registry and profiles |
| `/savings` | Savings accounts, transactions, dues, payment slips |
| `/schemes` | Savings schemes and enrollments |
| `/approvals` | Pending approval requests and slip verification |
| `/expenses` | Expense requests, categories, multi-tier approval |
| `/ledger` | Chart of accounts, journal entries, adjustments |
| `/documents` | Document vault upload/download/metadata |
| `/dashboard` | Aggregated dashboard metrics |
| `/audit` | Security audit trail |
| `/roles` | Role and permission management |

Operational endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health probe (DB status, uptime, mode) |
| GET | `/api/system` | System snapshot |
| GET | `/api/system/stream` | Server-sent events for live status |
| POST | `/api/system/refresh-db` | Force database health refresh |

The backend root (`/`) serves the operations console from `public/ops`.

### Authentication

```http
POST /api/auth/login
Content-Type: application/json
X-Requested-With: XMLHttpRequest

{ "identifier": "admin@shomiti.local", "password": "Admin@12345" }
```

`identifier` accepts an email or phone number. A successful response sets the `sn_token` httpOnly cookie and returns:

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "...", "role": "super_admin" },
    "token": "eyJ..."
  }
}
```

Every mutating request must include the `X-Requested-With: XMLHttpRequest` header, otherwise the API responds with `CSRF_HEADER_REQUIRED`.

### Response shape

Success:

```json
{ "success": true, "data": { }, "meta": { "total": 0, "page": 1, "limit": 20, "pages": 0 } }
```

Error:

```json
{ "success": false, "error": { "code": "INVALID_CREDENTIALS", "message": "...", "details": [] } }
```

### Roles and permissions

System roles: `super_admin`, `president`, `general_secretary`, `treasurer`, `member`.

Permissions are granular (`members.view`, `members.edit`, `savings.configure`, `expenses.approve_tier1`, `ledger.adjust`, `roles.assign`, `reports.audit_logs`, ...) and are stored on the `Role` collection. Middleware `authenticate` validates the JWT, `requireRoles` checks role membership, and `requirePermission` checks granular permissions.

Super Admin protections:

- A `super_admin` account cannot be deleted (self-deletion is also blocked).
- The `super_admin` role cannot be deleted; all system-locked roles are protected from deletion.
- The `super_admin` role is excluded from role listings.
- The `super_admin` role cannot be assigned through the user role-update endpoint.

## Testing

```bash
npm test
```

Tests use `node:test` with `supertest` and `mongodb-memory-server`, so no external database is required for the suite.

## Troubleshooting

- **`INVALID_CREDENTIALS` for a seeded account** — the user already exists with an older password. Seeding does not overwrite passwords; delete the user and restart, or reset the password through the API.
- **CORS errors** — add the frontend origin to `CLIENT_ORIGIN` (comma-separated).
- **`CSRF_HEADER_REQUIRED`** — include `X-Requested-With: XMLHttpRequest` in the request.
- **Database connection failures** — verify `MONGODB_URI` and, for Atlas, the IP allowlist.
