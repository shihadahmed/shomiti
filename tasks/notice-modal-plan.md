# Implementation Plan: Notice/Document Upload Modal Updates

## Overview
Update the Notice/Document upload modal with new visibility options (All Members / Specific Member), member selector for specific member visibility, public notice board visibility for all authenticated users, and targeted notification bell logic.

## Architecture Decisions
- **Database Schema**: Update Document model visibility enum from `['staff', 'member']` to `['all', 'specific']` and add `mentionedMember` field
- **Backend Service**: Update createDocument to handle new visibility logic and send targeted notifications
- **Frontend**: Update UploadModal with new visibility options, conditional member selector, and badge display on notice cards
- **Notifications**: Implement Case A (All Members - notify all except sender) and Case B (Specific Member - notify only mentioned member)

## Task List

### Phase 1: Backend Changes

#### Task 1: Update Document Model
**Description:** Update the Document schema to support new visibility options and mentioned member field
**Acceptance criteria:**
- [ ] visibility enum changed to `['all', 'specific']`
- [ ] Added `mentionedMember` field (ObjectId ref to Member)
- [ ] Migration handled gracefully (default to 'all' for existing documents)
**Verification:**
- [ ] Backend tests pass
- [ ] Model validates correctly
**Dependencies:** None
**Files:** `backend/src/models/Document.js`
**Scope:** Small

#### Task 2: Update Document Service - createDocument
**Description:** Update createDocument to handle new visibility logic and send targeted notifications
**Acceptance criteria:**
- [ ] Accepts `visibility` as 'all' or 'specific'
- [ ] Accepts `mentionedMemberId` when visibility is 'specific'
- [ ] Case A (All Members): Send notification to all active users EXCEPT sender
- [ ] Case B (Specific Member): Send notification ONLY to mentioned member's linked user (if not sender)
- [ ] Never send self-notification
- [ ] Notification link navigates to `/meetings/[id]`
**Verification:**
- [ ] Backend tests pass
- [ ] Manual test: Upload notice with All Members, verify notifications sent
- [ ] Manual test: Upload notice with Specific Member, verify notification sent only to that member
**Dependencies:** Task 1
**Files:** `backend/src/services/document.service.js`, `backend/src/services/notification.service.js`
**Scope:** Medium

#### Task 3: Update Document Service - listDocuments & getDocumentById
**Description:** Update listDocuments to not filter by visibility (public notice board) and getDocumentById to allow all authenticated users to view
**Acceptance criteria:**
- [ ] listDocuments returns all documents regardless of visibility for authenticated users
- [ ] getDocumentById allows all authenticated users to view (no visibility restrictions)
- [ ] Member filter still works when explicitly provided
**Verification:**
- [ ] Backend tests pass
- [ ] Manual test: Member can see all notices on list page
**Dependencies:** Task 1
**Files:** `backend/src/services/document.service.js`
**Scope:** Small

#### Task 4: Add Member Search Endpoint
**Description:** Add a search endpoint for members to use in the member selector dropdown
**Acceptance criteria:**
- [ ] GET `/api/members/search?q=<query>` returns matching members (code, fullName)
- [ ] Supports search by code, name, phone, email
- [ ] Returns limited results (e.g., 20)
**Verification:**
- [ ] Backend tests pass
- [ ] Frontend can use for searchable dropdown
**Dependencies:** None
**Files:** `backend/src/controllers/member.controller.js`, `backend/src/routes/member.routes.js`
**Scope:** Small

### Phase 2: Frontend Changes

#### Task 5: Update UploadModal - Visibility Options & Member Selector
**Description:** Replace VISIBILITY_OPTIONS and add conditional member selector field
**Acceptance criteria:**
- [ ] VISIBILITY_OPTIONS: 'all' (All Members, default) and 'specific' (Specific Member)
- [ ] When 'specific' selected, show searchable Member selector (displaying Member Code/ID and Name)
- [ ] Member selector uses new search endpoint
- [ ] Form validation: memberId required when visibility is 'specific'
**Verification:**
- [ ] Frontend build passes
- [ ] Manual test: Select All Members - no member selector shown
- [ ] Manual test: Select Specific Member - member selector appears and works
**Dependencies:** Task 4
**Files:** `frontend/app/meetings/page.jsx`
**Scope:** Medium

#### Task 6: Update Notice List Page - Badge Display
**Description:** Display mentioned member badge/tag on notice cards when visibility is 'specific'
**Acceptance criteria:**
- [ ] Notice cards show badge with Member Code/ID and Name when document.mentionedMember exists
- [ ] Badge styled clearly (e.g., different color, "For: MEM-001 — Shihad Bin Ahmed")
- [ ] Works for both list view and detail view
**Verification:**
- [ ] Frontend build passes
- [ ] Manual test: Upload notice for specific member, verify badge appears on card
**Dependencies:** Task 1
**Files:** `frontend/app/meetings/page.jsx`, `frontend/app/meetings/[id]/page.jsx`
**Scope:** Small

#### Task 7: Update Notice Detail Page - Member Badge
**Description:** Display mentioned member badge on notice detail page
**Acceptance criteria:**
- [ ] Detail page shows mentioned member info prominently
- [ ] Uses same styling as list page badge
**Verification:**
- [ ] Frontend build passes
- [ ] Manual test: View notice detail for specific member notice
**Dependencies:** Task 1
**Files:** `frontend/app/meetings/[id]/page.jsx`
**Scope:** Small

### Phase 3: Integration & Testing

#### Task 8: End-to-End Testing
**Description:** Test complete flow from upload to notification
**Acceptance criteria:**
- [ ] Upload notice with "All Members" - all active users except sender get notification
- [ ] Upload notice with "Specific Member" - only mentioned member gets notification
- [ ] No self-notifications sent
- [ ] Notification click navigates to `/meetings/[id]`
- [ ] All users can see all notices on list page
- [ ] Badge appears correctly for specific member notices
**Verification:**
- [ ] Manual end-to-end test
- [ ] Frontend build passes
- [ ] Backend tests pass
**Dependencies:** Tasks 1-7
**Scope:** Medium

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing documents have old visibility values | Medium | Default migration to 'all', handle both old and new values in code |
| Notification performance for "All Members" | Medium | Use bulk create, paginate if needed |
| Member search performance | Low | Limit results, add index on search fields |
| Frontend member selector UX | Low | Use existing Select component with search, or build custom |

## Open Questions
1. Should we keep backward compatibility for old 'staff'/'member' visibility values in API responses?
2. Should the member selector be a dropdown with search or a separate modal?
3. Do we need to send email/push notifications in addition to in-app bell notifications?