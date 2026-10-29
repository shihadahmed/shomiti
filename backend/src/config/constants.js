export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  TREASURER: 'treasurer',
  GENERAL_SECRETARY: 'general_secretary',
  PRESIDENT: 'president',
  MEMBER: 'member',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const STAFF_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.TREASURER,
  ROLES.GENERAL_SECRETARY,
  ROLES.PRESIDENT,
]);

/** Roles allowed to move money / approve financial requests. */
export const FINANCE_ROLES = Object.freeze([ROLES.SUPER_ADMIN, ROLES.TREASURER]);

/** Roles allowed to approve pending requests (must be a different user than requester). */
export const APPROVER_ROLES = Object.freeze([ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT]);

/** Executive roles (can assign executive roles to others) */
export const EXECUTIVE_ROLES = Object.freeze([ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT]);

export const MEMBER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  RESIGNED: 'resigned',
});

export const MEMBER_STATUS_VALUES = Object.freeze(Object.values(MEMBER_STATUS));

/** User account lifecycle status (onboarding / KYC / approval). */
export const USER_STATUS = Object.freeze({
  INVITED: 'invited',
  PENDING_KYC: 'pending_kyc',
  UNDER_REVIEW: 'under_review',
  ACTIVE: 'active',
  REJECTED: 'rejected',
});

export const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUS));

/** Statuses that block access to the app until the profile is cleared. */
export const KYC_BLOCKED_STATUSES = Object.freeze([
  USER_STATUS.PENDING_KYC,
  USER_STATUS.UNDER_REVIEW,
  USER_STATUS.REJECTED,
]);

/** In-app notification types (bell icon). */
export const NOTIFICATION_TYPE = Object.freeze({
  PROFILE_SUBMITTED: 'profile_submitted',
  ACCOUNT_APPROVED: 'account_approved',
  ACCOUNT_REJECTED: 'account_rejected',
  SYSTEM: 'system',
});

export const NOTIFICATION_TYPE_VALUES = Object.freeze(Object.values(NOTIFICATION_TYPE));

export const SAVINGS_TYPES = Object.freeze({
  MONTHLY: 'monthly',
  HALF_YEARLY: 'half_yearly',
  ONE_TIME: 'one_time',
});

export const SAVINGS_TYPE_VALUES = Object.freeze(Object.values(SAVINGS_TYPES));

export const SAVINGS_TYPE_LABELS = Object.freeze({
  monthly: { en: 'Monthly', bn: 'মাসিক' },
  half_yearly: { en: 'Half-Yearly', bn: 'আর্ধবার্ষিক' },
  one_time: { en: 'One-Time', bn: 'একবারে' },
});

export const SAVINGS_DUE_STATUS = Object.freeze({
  DUE: 'due',
  OVERDUE: 'overdue',
  PAID: 'paid',
  CANCELLED: 'cancelled',
});

export const SAVINGS_DUE_STATUS_VALUES = Object.freeze(Object.values(SAVINGS_DUE_STATUS));

export const SAVINGS_ACCOUNT_TYPES = Object.freeze({
  GENERAL: 'general',
  FIXED: 'fixed',
  RECURRING: 'recurring',
  SHARE: 'share',
});

export const SAVINGS_ACCOUNT_TYPE_VALUES = Object.freeze(Object.values(SAVINGS_ACCOUNT_TYPES));

export const TRANSACTION_TYPES = Object.freeze({
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  ADJUSTMENT: 'adjustment',
  INTEREST: 'interest',
  FEE: 'fee',
});

export const TRANSACTION_TYPE_VALUES = Object.freeze(Object.values(TRANSACTION_TYPES));

export const TRANSACTION_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  POSTED: 'posted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

export const TRANSACTION_STATUS_VALUES = Object.freeze(Object.values(TRANSACTION_STATUS));

export const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  BKASH: 'bkash',
  NAGAD: 'nagad',
  ROCKET: 'rocket',
  BANK_TRANSFER: 'bank_transfer',
  SSLCCOMMERZ: 'sslcommerz',
});

export const PAYMENT_METHOD_VALUES = Object.freeze(Object.values(PAYMENT_METHODS));

export const PAYMENT_METHOD_LABELS = Object.freeze({
  cash: { en: 'Cash', bn: 'নগদ' },
  bkash: { en: 'bKash', bn: 'বিকাশ' },
  nagad: { en: 'Nagad', bn: 'নগদ (Nagad)' },
  rocket: { en: 'Rocket', bn: 'রকেট' },
  bank_transfer: { en: 'Bank Transfer', bn: 'ব্যাংক স্থানান্তর' },
  sslcommerz: { en: 'SSLCommerz', bn: 'এসএসএলকমার্জ' },
});

/** Ledger asset account used for each payment method. */
export const PAYMENT_METHOD_ACCOUNTS = Object.freeze({
  cash: '1000',
  bkash: '1020',
  nagad: '1030',
  rocket: '1040',
  bank_transfer: '1010',
  sslcommerz: '1010',
});

export const PAYMENT_STATUS = Object.freeze({
  INITIATED: 'initiated',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
});

export const PAYMENT_STATUS_VALUES = Object.freeze(Object.values(PAYMENT_STATUS));

export const EXPENSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_TREASURER: 'pending_treasurer',
  PENDING_GS: 'pending_gs',
  PENDING_PRESIDENT: 'pending_president',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const EXPENSE_STATUS_VALUES = Object.freeze(Object.values(EXPENSE_STATUS));

export const EXPENSE_STATUS_ORDER = Object.freeze([
  EXPENSE_STATUS.DRAFT,
  EXPENSE_STATUS.PENDING_TREASURER,
  EXPENSE_STATUS.PENDING_GS,
  EXPENSE_STATUS.PENDING_PRESIDENT,
  EXPENSE_STATUS.APPROVED,
  EXPENSE_STATUS.REJECTED,
]);

export const EXPENSE_APPROVAL_ROLES = Object.freeze({
  [EXPENSE_STATUS.PENDING_TREASURER]: [ROLES.TREASURER, ROLES.SUPER_ADMIN],
  [EXPENSE_STATUS.PENDING_GS]: [ROLES.GENERAL_SECRETARY, ROLES.SUPER_ADMIN],
  [EXPENSE_STATUS.PENDING_PRESIDENT]: [ROLES.PRESIDENT, ROLES.SUPER_ADMIN],
});

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

export const APPROVAL_STATUS_VALUES = Object.freeze(Object.values(APPROVAL_STATUS));

export const APPROVAL_ENTITY = Object.freeze({
  SAVINGS_DUE: 'savings_due',
  EXPENSE: 'expense',
});

export const APPROVAL_ENTITY_VALUES = Object.freeze(Object.values(APPROVAL_ENTITY));

export const DOCUMENT_CATEGORIES = Object.freeze({
  RECEIPT: 'receipt',
  MEETING: 'meeting',
  RESOLUTION: 'resolution',
  NOTICE: 'notice',
  CERTIFICATE: 'certificate',
  PHOTO: 'photo',
  POLICY: 'policy',
  MEMBER: 'member',
  OTHER: 'other',
});

export const DOCUMENT_CATEGORY_VALUES = Object.freeze(Object.values(DOCUMENT_CATEGORIES));

export const ACCOUNT_CODES = Object.freeze({
  CASH: '1000',
  BANK: '1010',
  BKASH: '1020',
  NAGAD: '1030',
  ROCKET: '1040',
  MEMBER_SAVINGS_PAYABLE: '2000',
  MEMBER_SHARE_CAPITAL: '2100',
  GENERAL_FUND: '3000',
  MEMBERSHIP_FEE_INCOME: '4000',
  SERVICE_CHARGE_INCOME: '4100',
  ADMIN_EXPENSE: '5000',
  INTEREST_EXPENSE: '5100',
});

export const SCHEME_FREQUENCIES = Object.freeze(['monthly', 'weekly']);

export const FINANCIAL_TXN_TYPES = Object.freeze([
  TRANSACTION_TYPES.DEPOSIT,
  TRANSACTION_TYPES.WITHDRAWAL,
]);

export const CURRENCY = 'BDT';

/** Fixed business rules */
export const BUSINESS_RULES = Object.freeze({
  MONTHLY_PRINCIPAL_PAISA: 1000000, // ৳10,000
  HALF_YEARLY_PRINCIPAL_PAISA: 5000000, // ৳50,000
  LATE_FEE_PERCENT: 5, // 5%
  MONTHLY_DUE_DAY: 20, // 20th of month
  HALF_YEARLY_CYCLES: [
    { month: 6, day: 30 },   // June 30
    { month: 12, day: 31 },  // December 31
  ],
  RECEIPT_PREFIX: 'SNN-RCP',
});

/**
 * Permission Matrix - Granular RBAC permissions organized by category
 * Each permission follows format: category.action
 */
export const PERMISSION_CATEGORIES = Object.freeze([
  {
    key: 'members',
    label: { en: 'Member Management', bn: 'সদস্য ব্যবস্থাপনা' },
    permissions: [
      { key: 'members.view', label: { en: 'View Members', bn: 'সদস্য দেখুন' }, description: { en: 'View member list and profiles', bn: 'সদস্য তালিকা ও প্রোফাইল দেখুন' } },
      { key: 'members.create', label: { en: 'Create Member', bn: 'সদস্য তৈরি' }, description: { en: 'Add new members', bn: 'নতুন সদস্য যোগ করুন' } },
      { key: 'members.edit', label: { en: 'Edit Member', bn: 'সদস্য সম্পাদনা' }, description: { en: 'Edit member details', bn: 'সদস্যের বিবরণ সম্পাদনা করুন' } },
      { key: 'members.suspend', label: { en: 'Suspend/Archive Member', bn: 'সদস্য স্থগিত/আর্কাইভ' }, description: { en: 'Suspend or archive members', bn: 'সদস্য স্থগিত বা আর্কাইভ করুন' } },
    ],
  },
  {
    key: 'savings',
    label: { en: 'Savings & Dues', bn: 'সঞ্চয় ও বকেয়া' },
    permissions: [
      { key: 'savings.view', label: { en: 'View Savings', bn: 'সঞ্চয় দেখুন' }, description: { en: 'View savings accounts and transactions', bn: 'সঞ্চয় হিসাব ও লেনদেন দেখুন' } },
      { key: 'savings.configure', label: { en: 'Configure Rates', bn: 'রেট কনফিগার' }, description: { en: 'Configure savings rates and dues', bn: 'সঞ্চয় রেট ও বকেয়া কনফিগার করুন' } },
      { key: 'savings.trigger_dues', label: { en: 'Trigger Dues', bn: 'বকেয়া ট্রিগার' }, description: { en: 'Generate and trigger savings dues', bn: 'সঞ্চয় বকেয়া তৈরি ও চালু করুন' } },
    ],
  },
  {
    key: 'payments',
    label: { en: 'Payments', bn: 'পেমেন্ট' },
    permissions: [
      { key: 'payments.view', label: { en: 'View Payments', bn: 'পেমেন্ট দেখুন' }, description: { en: 'View payment records and history', bn: 'পেমেন্ট রেকর্ড ও ইতিহাস দেখুন' } },
      { key: 'payments.online_logs', label: { en: 'Online Logs', bn: 'অনলাইন লগ' }, description: { en: 'View online payment gateway logs', bn: 'অনলাইন পেমেন্ট গেটওয়ে লগ দেখুন' } },
      { key: 'payments.verify_slips', label: { en: 'Verify Manual Slips', bn: 'ম্যানুয়াল স্লিপ যাচাই' }, description: { en: 'Approve/reject manual bank slip uploads', bn: 'ম্যানুয়াল ব্যাংক স্লিপ অনুমোদন/প্রত্যাখ্যান' } },
      { key: 'payments.reject_slips', label: { en: 'Reject Slips', bn: 'স্লিপ প্রত্যাখ্যান' }, description: { en: 'Reject payment slips with reason', bn: 'কারণ সহ পেমেন্ট স্লিপ প্রত্যাখ্যান' } },
    ],
  },
  {
    key: 'expenses',
    label: { en: 'Expenses', bn: 'ব্যয়' },
    permissions: [
      { key: 'expenses.create', label: { en: 'Create Expense', bn: 'ব্যয় তৈরি' }, description: { en: 'Create new expense requests', bn: 'নতুন ব্যয় অনুরোধ তৈরি' } },
      { key: 'expenses.approve_tier1', label: { en: 'Tier-1 Approval (Treasurer)', bn: 'টিয়ার-১ অনুমোদন (তহবিলদার)' }, description: { en: 'First level expense approval', bn: 'প্রথম স্তরের ব্যয় অনুমোদন' } },
      { key: 'expenses.approve_tier2', label: { en: 'Tier-2 Approval (GS)', bn: 'টিয়ার-২ অনুমোদন (সা.স.)' }, description: { en: 'Second level expense approval', bn: 'দ্বিতীয় স্তরের ব্যয় অনুমোদন' } },
      { key: 'expenses.approve_tier3', label: { en: 'Tier-3 Approval (President)', bn: 'টিয়ার-৩ অনুমোদন (সভাপতি)' }, description: { en: 'Final level expense approval', bn: 'চূড়ান্ত স্তরের ব্যয় অনুমোদন' } },
    ],
  },
  {
    key: 'ledger',
    label: { en: 'Ledger & Accounting', bn: 'খতিয়ান ও হিসাবরক্ষণ' },
    permissions: [
      { key: 'ledger.view', label: { en: 'View Ledger', bn: 'খতিয়ান দেখুন' }, description: { en: 'View general ledger and chart of accounts', bn: 'সাধারণ খতিয়ান ও হিসাব চার্ট দেখুন' } },
      { key: 'ledger.adjust', label: { en: 'Manual Adjustment (Super Admin)', bn: 'ম্যানুয়াল সমন্বয় (সূপার অ্যাডমিন)' }, description: { en: 'Create manual journal adjustments', bn: 'ম্যানুয়াল জার্নাল সমন্বয় তৈরি' } },
    ],
  },
  {
    key: 'meetings',
    label: { en: 'Meetings & Notices', bn: 'সভাসমূহ ও নোটিশ' },
    permissions: [
      { key: 'meetings.create', label: { en: 'Create Meeting', bn: 'সভার তৈরি' }, description: { en: 'Schedule and create meetings', bn: 'সভার সময়নির্ধারণ ও তৈরি' } },
      { key: 'meetings.upload_resolution', label: { en: 'Upload Resolution', bn: 'রেজোলিউশন আপলোড' }, description: { en: 'Upload meeting resolutions and minutes', bn: 'সভার রেজোলিউশন ও মিনিটস আপলোড' } },
      { key: 'meetings.publish_notice', label: { en: 'Publish Notice', bn: 'নোটিশ প্রকাশ' }, description: { en: 'Publish notices to members', bn: 'সদস্যদের কাছে নোটিশ প্রকাশ' } },
    ],
  },
  {
    key: 'documents',
    label: { en: 'Documents', bn: 'নথিপত্র' },
    permissions: [
      { key: 'documents.upload', label: { en: 'Upload Documents', bn: 'নথি আপলোড' }, description: { en: 'Upload documents to vault', bn: 'ভান্ডারে নথি আপলোড' } },
      { key: 'documents.delete', label: { en: 'Delete/Archive Documents', bn: 'নথি মুছুন/আর্কাইভ' }, description: { en: 'Delete or archive documents', bn: 'নথি মুছুন বা আর্কাইভ করুন' } },
      { key: 'documents.certificates', label: { en: 'Manage Certificates', bn: 'সার্টিফিকেট পরিচালনা' }, description: { en: 'Generate and manage membership certificates', bn: 'সদস্য সার্টিফিকেট তৈরি ও পরিচালনা' } },
    ],
  },
  {
    key: 'reports',
    label: { en: 'Reports & Audit', bn: 'রিপোর্ট ও অডিট' },
    permissions: [
      { key: 'reports.view_financial', label: { en: 'View Financial Reports', bn: 'আর্থিক রিপোর্ট দেখুন' }, description: { en: 'View collection, dues, expense reports', bn: 'আদায়, বকেয়া, ব্যয় রিপোর্ট দেখুন' } },
      { key: 'reports.export', label: { en: 'Export CSV/PDF', bn: 'CSV/PDF এক্সপোর্ট' }, description: { en: 'Export reports to CSV or PDF', bn: 'রিপোর্ট CSV বা PDF-এ এক্সপোর্ট' } },
      { key: 'reports.audit_logs', label: { en: 'View System Audit Logs', bn: 'সিস্টেম অডিট লগ দেখুন' }, description: { en: 'View security audit trail', bn: 'নিরাপত্তা অডিট ট্রেইল দেখুন' } },
    ],
  },
  {
    key: 'roles',
    label: { en: 'Role Management', bn: 'রোল ব্যবস্থাপনা' },
    permissions: [
      { key: 'roles.view', label: { en: 'View Roles', bn: 'রোল দেখুন' }, description: { en: 'View all roles and permissions', bn: 'সব রোল ও পারমিশন দেখুন' } },
      { key: 'roles.create', label: { en: 'Create Role', bn: 'রোল তৈরি' }, description: { en: 'Create new custom roles', bn: 'নতুন কাস্টম রোল তৈরি' } },
      { key: 'roles.update', label: { en: 'Update Role', bn: 'রোল আপডেট' }, description: { en: 'Modify role permissions and metadata', bn: 'রোল পারমিশন ও মেটাডেটা পরিবর্তন' } },
      { key: 'roles.delete', label: { en: 'Delete Role', bn: 'রোল মুছুন' }, description: { en: 'Delete custom roles (not system-locked)', bn: 'কাস্টম রোল মুছুন (সিস্টেম-লকড না)' } },
      { key: 'roles.assign', label: { en: 'Assign Role', bn: 'রোল অ্যাসাইন' }, description: { en: 'Assign/change roles for users', bn: 'ব্যবহারকারীদের জন্য রোল বাদল/নিযুক্ত করুন' } },
    ],
  },
  {
    key: 'users',
    label: { en: 'User Accounts', bn: 'ব্যবহারকারী অ্যাকাউন্ট' },
    permissions: [
      { key: 'users.manage_kyc', label: { en: 'Manage KYC / Profile Approval', bn: 'KYC / প্রোফাইল অনুমোদন পরিচালনা' }, description: { en: 'Review, approve or reject member profile and KYC submissions', bn: 'সদস্যের প্রোফাইল ও KYC জমাদেলি পর্যালোচনা, অনুমোদন বা প্রত্যাখ্যান করা' } },
    ],
  },
]);

/** Flattened list of all permission keys */
export const ALL_PERMISSIONS = Object.freeze(
  PERMISSION_CATEGORIES.flatMap(cat => cat.permissions.map(p => p.key))
);

/** Default system roles with their permissions */
export const DEFAULT_SYSTEM_ROLES = Object.freeze([
  {
    name: 'super_admin',
    description: 'Full system access including all financial operations, member management, and system configuration.',
    isSystemLocked: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'president',
    description: 'Final approval authority for expenses and strategic decisions. Oversees meetings and resolutions.',
    isSystemLocked: true,
    permissions: [
      'members.view',
      'savings.view',
      'payments.view',
      'payments.online_logs',
      'expenses.approve_tier3',
      'ledger.view',
      'meetings.create',
      'meetings.upload_resolution',
      'meetings.publish_notice',
      'documents.view',
      'documents.certificates',
      'reports.view_financial',
      'reports.export',
      'reports.audit_logs',
      'users.manage_kyc',
    ],
  },
  {
    name: 'general_secretary',
    description: 'Approves expenses, manages documents, and oversees meetings. Second-tier expense approval.',
    isSystemLocked: true,
    permissions: [
      'members.view',
      'members.edit',
      'savings.view',
      'payments.view',
      'expenses.create',
      'expenses.approve_tier2',
      'ledger.view',
      'meetings.create',
      'meetings.upload_resolution',
      'meetings.publish_notice',
      'documents.upload',
      'documents.delete',
      'documents.certificates',
      'reports.view_financial',
      'reports.export',
      'users.manage_kyc',
    ],
  },
  {
    name: 'treasurer',
    description: 'Manages savings, dues, payments, expenses, and financial reporting. First-tier expense approval and payment verification.',
    isSystemLocked: true,
    permissions: [
      'members.view',
      'members.create',
      'members.edit',
      'savings.view',
      'savings.configure',
      'savings.trigger_dues',
      'payments.view',
      'payments.online_logs',
      'payments.verify_slips',
      'payments.reject_slips',
      'expenses.create',
      'expenses.approve_tier1',
      'ledger.view',
      'meetings.publish_notice',
      'documents.upload',
      'reports.view_financial',
      'reports.export',
      'users.manage_kyc',
    ],
  },
  {
    name: 'member',
    description: 'Standard member portal access - own profile, dues, payments, statements, and public fund info.',
    isSystemLocked: true,
    permissions: [
      'members.view_own',
      'savings.view_own',
      'payments.view_own',
      'payments.create_own',
      'documents.view_own',
      'documents.certificates_own',
      'reports.view_own_statement',
    ],
  },
]);

/** Role type labels for UI */
export const ROLE_TYPES = Object.freeze({
  SYSTEM_LOCKED: 'system_locked',
  CUSTOM: 'custom',
});
