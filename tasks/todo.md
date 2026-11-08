# Task List: Complete All Placeholder Pages

## Phase 1: Member Self-Service Pages

- [ ] **Task 1**: `/savings/my` - Member Savings Dashboard
  - Backend: Add `mySavingsDashboard` controller + route
  - Frontend: `frontend/app/savings/my/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 2**: `/savings/my/dues` - Member Dues List (enable existing)
  - Frontend: `frontend/app/savings/my/dues/page.jsx` (copy from savings/dues)
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 3**: `/savings/my/schemes` - Member Enrolled Schemes
  - Backend: Add `mySchemes` controller + route + service function
  - Frontend: `frontend/app/savings/my/schemes/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 4**: `/documents/my` - Member Documents (enable existing backend)
  - Frontend: `frontend/app/documents/my/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 5**: `/profile` - Member Profile
  - Frontend: `frontend/app/profile/page.jsx`
  - Backend: Reuse member/KYC services
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 6**: `/certificate` - Membership/Savings Certificates (PDF)
  - Backend: New controller, route, service (PDF generation)
  - Frontend: `frontend/app/certificate/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 7**: `/statement` - Transaction Statement (PDF/CSV)
  - Backend: New controller, route, service
  - Frontend: `frontend/app/statement/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 8**: `/payments` - Member Payment Initiation
  - Frontend: `frontend/app/payments/page.jsx`
  - Backend: Reuse payDue service
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

- [ ] **Task 9**: `/payments/offline` - Submit Offline Payment Slip
  - Frontend: `frontend/app/payments/offline/page.jsx`
  - Backend: Reuse payment slip services
  - Enable nav: `frontend/lib/navigation.js` (remove disabled)

### Checkpoint: Phase 1 Complete
- [ ] All member self-service pages work end-to-end
- [ ] `npm --prefix backend test` passes
- [ ] `npm --prefix frontend run build` succeeds
- [ ] No 404s for member role

## Phase 2: Staff/Finance Pages

- [ ] **Task 10**: `/reports` - Financial Reports Dashboard
  - Backend: New controller, route, service (multiple report types)
  - Frontend: `frontend/app/reports/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled for staff roles)

- [ ] **Task 11**: `/audit` - Audit Logs (enable existing)
  - Frontend: Update `frontend/app/audit/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled for super_admin)

- [ ] **Task 12**: `/meetings` - Meetings & Notices
  - Backend: New model, controller, route, service
  - Frontend: `frontend/app/meetings/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled for GS/super_admin)

- [ ] **Task 13**: `/savings/config` - Savings Configuration
  - Backend: New model, controller, route, service
  - Frontend: `frontend/app/savings/config/page.jsx`
  - Enable nav: `frontend/lib/navigation.js` (remove disabled for treasurer/super_admin)

### Checkpoint: Phase 2 Complete
- [ ] All staff pages work end-to-end
- [ ] `npm --prefix backend test` passes
- [ ] `npm --prefix frontend run build` succeeds
- [ ] No 404s for staff roles

### Checkpoint: Full Implementation Complete
- [ ] All 13 pages implemented and accessible
- [ ] All permissions enforced via RBAC
- [ ] i18n keys added (EN/BN) for all new UI text
- [ ] Ready for production deployment

---

**Notes:**
- Each task follows vertical slicing: complete backend + frontend for one page
- Dependencies: Tasks 2,4,8,9 depend on existing backend; Tasks 1,3,5,6,7 need new backend
- Run verification after each task
- Update `frontend/lib/navigation.js` to remove `disabled: true` for each page when ready