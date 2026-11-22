# Task List: Notice/Document Upload Modal Updates

## Phase 1: Backend Changes

- [x] **Task 1**: Update Document Model
  - Change visibility enum to `['all', 'specific']`
  - Add `mentionedMember` field (ObjectId ref to Member)
  - File: `backend/src/models/Document.js`

- [x] **Task 2**: Update Document Service - createDocument
  - Handle new visibility logic ('all' vs 'specific')
  - Accept `mentionedMemberId` when visibility is 'specific'
  - Case A (All Members): Notify all active users EXCEPT sender
  - Case B (Specific Member): Notify ONLY mentioned member's linked user (if not sender)
  - Never send self-notification
  - Notification link: `/meetings/[id]`
  - Files: `backend/src/services/document.service.js`

- [x] **Task 3**: Update Document Service - listDocuments & getDocumentById
  - listDocuments: Return all documents for authenticated users (public notice board)
  - getDocumentById: Allow all authenticated users to view (no visibility restrictions)
  - Populate mentionedMember field
  - Added mentionedMemberId filter support
  - File: `backend/src/services/document.service.js`

- [x] **Task 4**: Member Search Endpoint (Already Exists)
  - GET `/api/members/options` returns matching members (code, fullName, phone)
  - Search by code, name, phone
  - Limit results to 50
  - Files: Already implemented in `backend/src/services/member.service.js` and `backend/src/controllers/member.controller.js`

- [x] **Task 4b**: Update myDocuments endpoint
  - Filter by mentionedMemberId instead of old visibility
  - Files: `backend/src/controllers/document.controller.js`

## Phase 2: Frontend Changes

- [x] **Task 5**: Update UploadModal - Visibility Options & Member Selector
  - VISIBILITY_OPTIONS: 'all' (All Members, default) and 'specific' (Specific Member)
  - Conditional member selector when 'specific' selected
  - Member selector uses `/api/members/options` search endpoint with debounced search
  - Form validation: memberId required when visibility is 'specific'
  - File: `frontend/app/meetings/page.jsx`

- [x] **Task 6**: Update Notice List Page - Badge Display
  - Show mentioned member badge on notice cards when document.mentionedMember exists
  - Badge shows "For: MEM-001 — Shihad Bin Ahmed" with amber styling
  - File: `frontend/app/meetings/page.jsx`

- [x] **Task 7**: Update Notice Detail Page - Member Badge
  - Show mentioned member badge on detail page in metadata row
  - File: `frontend/app/meetings/[id]/page.jsx`

## Phase 3: Integration & Testing

- [x] **Task 8**: End-to-End Testing (Verified via Build & Tests)
  - Backend tests: 45/45 pass
  - Frontend build: Successful
  - All acceptance criteria implemented

---

## Summary of Changes

### Backend
1. **Document Model** (`backend/src/models/Document.js`):
   - Changed `visibility` enum from `['staff', 'member']` to `['all', 'specific']` with default `'all'`
   - Added `mentionedMember` field (ObjectId ref to Member)

2. **Document Service** (`backend/src/services/document.service.js`):
   - Updated `createDocument` to validate `mentionedMemberId` when visibility is 'specific'
   - Added `sendDocumentNotifications` function:
     - Case A (All Members): Notifies all active users EXCEPT the sender
     - Case B (Specific Member): Notifies ONLY the mentioned member's linked user (if not sender)
     - Never sends self-notifications
     - Notification links point to `/meetings/[id]`
   - Updated `listDocuments`:
     - Removed visibility filtering (public notice board)
     - Added `mentionedMemberId` filter support
     - Populates `mentionedMember` field
   - Updated `getDocumentById`:
     - Removed visibility restrictions (all authenticated users can view)
     - Populates `mentionedMember` field

3. **Document Controller** (`backend/src/controllers/document.controller.js`):
   - Updated `myDocuments` to filter by `mentionedMemberId` instead of old visibility

### Frontend
1. **Upload Modal** (`frontend/app/meetings/page.jsx`):
   - Updated `VISIBILITY_OPTIONS` to 'All Members' (default) and 'Specific Member'
   - Added conditional searchable member selector using `/api/members/options`
   - Added debounced search with loading state
   - Added form validation for required member when visibility is 'specific'
   - Default visibility set to 'all'

2. **Notice List Page** (`frontend/app/meetings/page.jsx`):
   - Added mentioned member badge in metadata row (amber styling)
   - Badge shows "For: MEM-001 — Shihad Bin Ahmed" with user-check icon

3. **Notice Detail Page** (`frontend/app/meetings/[id]/page.jsx`):
   - Added mentioned member badge in top metadata row (amber styling)
   - Consistent with list page design

### Key Business Logic Implemented
✅ **Visibility Options**: "All Members" (default) and "Specific Member"
✅ **Conditional Member Selector**: Appears only when "Specific Member" selected
✅ **Public Notice Board**: All authenticated users see all notices
✅ **Mentioned Member Badge**: Displayed on cards and detail page for specific-member notices
✅ **Notification Logic**:
   - Case A (All Members): All active users EXCEPT sender get notification
   - Case B (Specific Member): ONLY mentioned member's linked user gets notification (if not sender)
   - No self-notifications ever
   - Notification click navigates to `/meetings/[id]`