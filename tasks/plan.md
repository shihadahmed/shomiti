# Implementation Plan: Complete All Placeholder Pages

## Overview
Implement all 13 currently placeholder/missing pages so the entire application is functional. Pages fall into two groups: **Member self-service** (what logged-in members see) and **Staff/Finance** (what treasurer, GS, president, super_admin see).

## Architecture Decisions
- **Vertical slicing**: Build one complete page (backend API + frontend UI) at a time
- **Reuse existing backend**: Leverage existing controllers/services where possible (`myDues`, `myTransactions`, `myDocuments`)
- **New backend where needed**: Add controllers/routes for missing functionality (certificates, statements, reports, payments, schemes, meetings, config)
- **Permission-based**: All new routes respect RBAC (`savings.view_own`, `documents.view_own`, `reports.view_own_statement`, `payments.create_own`, etc.)
- **Consistent patterns**: Follow existing code patterns (asyncHandler, services, validators, i18n)

## Task List

### Phase 1: Member Self-Service Pages (High Impact)

#### Task 1: `/savings/my` - Member Savings Dashboard
**Description:** Landing page for members showing their savings accounts, total balance, recent dues, and quick action to pay dues.
**Acceptance criteria:**
- [ ] Shows member's savings accounts with balances
- [ ] Shows upcoming/overdue dues count
- [ ] Links to `/savings/my/dues` and `/savings/my/schemes`
- [ ] Respects `savings.view_own` permission
**Verification:**
- [ ] Backend test: `npm --prefix backend test`
- [ ] Frontend build: `npm --prefix frontend run build`
- [ ] Manual: Login as member, see dashboard
**Dependencies:** None
**Files:** `backend/src/controllers/savings.controller.js`, `backend/src/routes/savings.routes.js`, `frontend/app/savings/my/page.jsx`
**Scope:** Medium

#### Task 2: `/savings/my/dues` - Member Dues List (Page Exists, Hook Up)
**Description:** The page exists at `/savings/dues/page.jsx` but needs to be accessible at `/savings/my/dues` for members. Backend route `/savings/my/dues` already exists.
**Acceptance criteria:**
- [ ] Member can access `/savings/my/dues` and see only their dues
- [ ] Pay button works (POST `/savings/dues/:id/pay` with idempotency)
- [ ] Shows status badges (due, overdue, paid)
- [ ] Respects `savings.view_own` and `payments.create_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member pays a due
**Dependencies:** None (backend exists)
**Files:** `frontend/app/savings/my/dues/page.jsx` (new route file), `frontend/lib/navigation.js` (enable href)
**Scope:** Small

#### Task 3: `/savings/my/schemes` - Member Enrolled Schemes
**Description:** Show member's enrolled savings schemes with details (interest rate, maturity, balance).
**Acceptance criteria:**
- [ ] New backend route `GET /savings/my/schemes` (or `/schemes/my-enrollments`)
- [ ] Shows scheme name, type, interest rate, start date, current balance
- [ ] Links to scheme details
- [ ] Respects `savings.view_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member sees enrolled schemes
**Dependencies:** Task 1 (savings controller pattern)
**Files:** `backend/src/controllers/savings.controller.js`, `backend/src/routes/savings.routes.js`, `backend/src/services/savings.service.js` (new function), `frontend/app/savings/my/schemes/page.jsx`
**Scope:** Medium

#### Task 4: `/documents/my` - Member Documents (Page Missing, Backend Exists)
**Description:** Backend route `/documents/my` exists (`myDocuments` controller). Need frontend page.
**Acceptance criteria:**
- [ ] Member sees documents shared with them (visibility: member)
- [ ] Can download documents
- [ ] Respects `documents.view_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member views shared documents
**Dependencies:** None (backend exists)
**Files:** `frontend/app/documents/my/page.jsx`, `frontend/lib/navigation.js` (enable href)
**Scope:** Small

#### Task 5: `/profile` - Member Profile
**Description:** Member views/edits their profile info (name, phone, email, address, nominee, photo). Links to KYC flow.
**Acceptance criteria:**
- [ ] Shows member details from Member model
- [ ] Edit button for allowed fields (uses existing KYC update flow)
- [ ] Shows KYC status badge
- [ ] Photo upload (Cloudinary)
- [ ] Respects `members.view_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member views/edits profile
**Dependencies:** Existing KYC service
**Files:** `frontend/app/profile/page.jsx`, `backend/src/controllers/member.controller.js` (if needed), `frontend/lib/navigation.js`
**Scope:** Medium

#### Task 6: `/certificate` - Membership/Savings Certificates
**Description:** Generate and download PDF certificates (membership, savings balance).
**Acceptance criteria:**
- [ ] Member can generate membership certificate (PDF)
- [ ] Member can generate savings certificate (PDF)
- [ ] Certificate includes member name, code, date, seal placeholder
- [ ] Respects `documents.certificates_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member downloads certificate
**Dependencies:** Task 5 (member data)
**Files:** `backend/src/controllers/certificate.controller.js` (new), `backend/src/routes/certificate.routes.js` (new), `backend/src/services/certificate.service.js` (new, PDF generation), `frontend/app/certificate/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Large (PDF generation)

#### Task 7: `/statement` - Transaction Statement
**Description:** Member views and downloads their transaction statement (date range, PDF/CSV).
**Acceptance criteria:**
- [ ] Date range picker (from/to)
- [ ] Shows transactions in table (date, type, amount, balance)
- [ ] Download as PDF and CSV
- [ ] Running balance column
- [ ] Respects `reports.view_own_statement`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member downloads statement
**Dependencies:** Existing `myTransactions` backend
**Files:** `backend/src/controllers/statement.controller.js` (new), `backend/src/routes/statement.routes.js` (new), `backend/src/services/statement.service.js` (new), `frontend/app/statement/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Medium

#### Task 8: `/payments` - Member Payment Initiation
**Description:** Member initiates online payment (bKash/Nagad/Rocket/Bank) for dues.
**Acceptance criteria:**
- [ ] Shows member's pending dues with "Pay" button
- [ ] Online payment flow (redirect to payment gateway or mock)
- [ ] Idempotency key handling
- [ ] Respects `payments.create_own` and `savings.view_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member initiates payment
**Dependencies:** Task 2 (dues list), existing `payDue` service
**Files:** `frontend/app/payments/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Medium

#### Task 9: `/payments/offline` - Submit Offline Payment Slip
**Description:** Member uploads payment slip (cash/bank deposit) for verification.
**Acceptance criteria:**
- [ ] Form: select due, upload slip image, enter reference, method
- [ ] Submits to backend (creates payment slip with `pending_verification`)
- [ ] Shows submitted slips with status
- [ ] Respects `payments.create_own`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Member uploads slip, staff verifies
**Dependencies:** Existing `listPaymentSlips`, `verifyPayment` services
**Files:** `frontend/app/payments/offline/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Small

### Phase 2: Staff/Finance Pages

#### Task 10: `/reports` - Financial Reports Dashboard
**Description:** Staff views financial reports (collection, overdue, income-expense, member statements).
**Acceptance criteria:**
- [ ] Report categories: Collection, Overdue, Late Fee, Income-Expense, Export
- [ ] Date range filters
- [ ] View on screen + download CSV/PDF
- [ ] Respects `reports.view_financial`, `reports.export`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Staff generates reports
**Dependencies:** Existing dashboard service, ledger service
**Files:** `backend/src/controllers/report.controller.js` (new), `backend/src/routes/report.routes.js` (new), `backend/src/services/report.service.js` (new), `frontend/app/reports/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Large

#### Task 11: `/audit` - Audit Logs (Page Exists, Backend Exists)
**Description:** Page exists but disabled. Backend `/audit` route exists. Enable for super_admin.
**Acceptance criteria:**
- [ ] Super admin sees audit logs with filters (user, action, date)
- [ ] Pagination works
- [ ] Respects `reports.audit_logs`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Super admin views audit logs
**Dependencies:** None (both exist)
**Files:** `frontend/app/audit/page.jsx` (update), `frontend/lib/navigation.js` (enable href for super_admin)
**Scope:** XS

#### Task 12: `/meetings` - Meetings & Notices
**Description:** GS/Super admin create meetings, upload resolutions, publish notices.
**Acceptance criteria:**
- [ ] List meetings with status (scheduled, completed, cancelled)
- [ ] Create meeting form (title, date, time, agenda, attendees)
- [ ] Upload resolution PDF for completed meetings
- [ ] Publish notice to members (notification)
- [ ] Respects `meetings.create`, `meetings.upload_resolution`, `meetings.publish_notice`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: GS creates meeting, uploads resolution
**Dependencies:** Notification service exists
**Files:** `backend/src/controllers/meeting.controller.js` (new), `backend/src/routes/meeting.routes.js` (new), `backend/src/services/meeting.service.js` (new), `backend/src/models/Meeting.js` (new), `frontend/app/meetings/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Large

#### Task 13: `/savings/config` - Savings Configuration
**Description:** Treasurer/Super admin configure savings rates, late fees, due generation settings.
**Acceptance criteria:**
- [ ] Configure interest rates per scheme type
- [ ] Configure late fee rules (percentage, grace period)
- [ ] Configure due generation schedule
- [ ] Respects `savings.configure`
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Manual: Treasurer updates rates
**Dependencies:** Scheme service, savings service
**Files:** `backend/src/controllers/savingsConfig.controller.js` (new), `backend/src/routes/savingsConfig.routes.js` (new), `backend/src/services/savingsConfig.service.js` (new), `backend/src/models/SavingsConfig.js` (new), `frontend/app/savings/config/page.jsx`, `frontend/lib/navigation.js`
**Scope:** Medium

### Checkpoint: After Phase 1 (Tasks 1-9)
- [ ] All member self-service pages work end-to-end
- [ ] Backend tests pass (45+)
- [ ] Frontend build succeeds
- [ ] No 404s for member role

### Checkpoint: After Phase 2 (Tasks 10-13)
- [ ] All staff pages work end-to-end
- [ ] Backend tests pass
- [ ] Frontend build succeeds
- [ ] No 404s for staff roles

### Checkpoint: Complete
- [ ] All 13 pages implemented and accessible
- [ ] All permissions enforced
- [ ] i18n keys added for all new UI text
- [ ] Ready for production deployment

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF generation complexity (certificates, statements) | High | Use existing PDF library (pdfkit/jsPDF), start with simple templates |
| Payment gateway integration | High | Mock gateway for now, design interface for real integration later |
| Report query performance | Medium | Add indexes, use aggregation pipelines, paginate |
| Meeting/notice notification delivery | Medium | Reuse existing notification service, add email template |
| Schema migrations for new models (Meeting, SavingsConfig) | Low | Create models with mongoose, auto-index on startup |

## Open Questions
1. **Payment gateway**: Use mock/sandbox for bKash/Nagad/Rocket, or integrate real APIs?
2. **PDF library**: Prefer `pdfkit` (server-side) or `jsPDF` (client-side)?
3. **Reports**: Which specific reports are needed? (Collection, Overdue, Late Fee, Income-Expense, Member Statement, Export CSV/PDF)
4. **Certificate template**: Should membership certificate include QR code for verification?
5. **Statement format**: PDF + CSV both needed, or one is enough?

---

*Tasks tracked in `tasks/todo.md`*