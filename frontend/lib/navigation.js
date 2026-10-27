const ALL_ROLES = ['super_admin', 'treasurer', 'general_secretary', 'president', 'member'];
const STAFF_ROLES = ['super_admin', 'treasurer', 'general_secretary', 'president'];

/**
 * Canonical sidebar layout: every role sees the same four sections, with
 * items filtered by role. Empty sections are dropped automatically.
 */
const NAV_SECTIONS = [
  {
    section: 'nav.section.core',
    title: 'Core',
    items: [
      {
        href: '/dashboard',
        label: 'nav.dashboard',
        defaultTitle: 'Dashboard',
        icon: 'grid',
        roles: ALL_ROLES,
      },
    ],
  },
  {
    section: 'nav.section.finance',
    title: 'Finance & Operations',
    items: [
      {
        href: '/savings',
        label: 'nav.savings',
        defaultTitle: 'Savings & Schemes',
        icon: 'wallet',
        roles: ['super_admin', 'treasurer', 'general_secretary'],
      },
      {
        href: '/savings/my',
        label: 'settings.mySavings',
        defaultTitle: 'My Savings',
        icon: 'wallet',
        roles: ['member'],
      },
      {
        href: '/savings/my/schemes',
        label: 'savings.mySchemes',
        defaultTitle: 'My Schemes',
        icon: 'target',
        roles: ['member'],
      },
      {
        href: '/savings/my/dues',
        label: 'settings.dues',
        defaultTitle: 'My Dues',
        icon: 'target',
        roles: ['member'],
      },
      {
        href: '/expenses',
        label: 'nav.expenses',
        defaultTitle: 'Expenses',
        icon: 'fileText',
        roles: ['super_admin', 'treasurer', 'general_secretary'],
      },
      {
        href: '/payments',
        label: 'settings.payNow',
        defaultTitle: 'Pay Now',
        icon: 'creditCard',
        roles: ['member'],
      },
      {
        href: '/payments/offline',
        label: 'settings.submitOfflinePayment',
        defaultTitle: 'Submit Offline Payment',
        icon: 'upload',
        roles: ['member'],
      },
      {
        href: '/ledger',
        label: 'nav.ledger',
        defaultTitle: 'General Ledger',
        icon: 'bookOpen',
        roles: ['super_admin', 'treasurer'],
      },
      {
        href: '/approvals',
        label: 'nav.approvals',
        defaultTitle: 'Approvals',
        icon: 'shield',
        badge: 'pendingApprovals',
        roles: STAFF_ROLES,
      },
    ],
  },
  {
    section: 'nav.section.communication',
    title: 'Communication & Assets',
    items: [
      {
        href: '/meetings',
        label: 'nav.meetings',
        defaultTitle: 'Meetings & Notices',
        icon: 'calendar',
        roles: ['super_admin', 'general_secretary'],
      },
      {
        href: '/documents',
        label: 'nav.documents',
        defaultTitle: 'Document Vault',
        icon: 'folder',
        roles: ['super_admin', 'treasurer', 'general_secretary', 'president'],
      },
      {
        href: '/documents/my',
        label: 'settings.myDocuments',
        defaultTitle: 'My Documents',
        icon: 'folder',
        roles: ['member'],
      },
      {
        href: '/certificate',
        label: 'settings.membershipCertificate',
        defaultTitle: 'Membership Certificate',
        icon: 'award',
        roles: ['member'],
      },
    ],
  },
  {
    section: 'nav.section.system',
    title: 'System & Insights',
    items: [
      {
        href: '/members',
        label: 'nav.members',
        defaultTitle: 'Members',
        icon: 'users',
        roles: ['super_admin', 'treasurer', 'general_secretary'],
      },
      {
        href: '/users',
        label: 'nav.users',
        defaultTitle: 'Users & Roles',
        icon: 'shield',
        roles: ['super_admin'],
      },
      {
        href: '/reports',
        label: 'nav.reports',
        defaultTitle: 'Reports',
        icon: 'chart',
        roles: STAFF_ROLES,
      },
      {
        href: '/audit',
        label: 'nav.audit',
        defaultTitle: 'Audit Logs',
        icon: 'clock',
        roles: ['super_admin'],
      },
      {
        href: '/settings',
        label: 'nav.settings',
        defaultTitle: 'Settings',
        icon: 'settings',
        roles: ['super_admin', 'treasurer', 'general_secretary'],
      },
      {
        href: '/profile',
        label: 'settings.memberProfile',
        defaultTitle: 'Member Profile',
        icon: 'user',
        roles: ['member'],
      },
      {
        href: '/statement',
        label: 'statement.title',
        defaultTitle: 'Transaction Statement',
        icon: 'fileText',
        roles: ['member'],
      },
      {
        href: '/notifications',
        label: 'settings.notifications',
        defaultTitle: 'Notifications',
        icon: 'bell',
        roles: ['member'],
      },
    ],
  },
];

/**
 * Routes that stay reachable from global search even though they are no
 * longer standalone sidebar links (e.g. the dues tab inside Savings).
 */
const SEARCH_ONLY_HREFS = {
  super_admin: ['/savings/dues'],
  treasurer: ['/savings/dues'],
  general_secretary: ['/savings/dues'],
};

function resolveRole(role) {
  return ALL_ROLES.includes(role) ? role : 'member';
}

function stripRoles({ roles, ...item }) {
  return item;
}

/** Section + item list for a role, keeping only the items that role may see. */
export function menuSectionsForRole(role) {
  const resolvedRole = resolveRole(role);
  return NAV_SECTIONS.map(({ items, ...section }) => ({
    ...section,
    items: items.filter((item) => item.roles.includes(resolvedRole)).map(stripRoles),
  })).filter((section) => section.items.length > 0);
}

/** Every href a role can reach, including search-only shortcuts. */
export function searchHrefsForRole(role) {
  const resolvedRole = resolveRole(role);
  const hrefs = menuSectionsForRole(resolvedRole).flatMap((section) =>
    section.items.map((item) => item.href),
  );
  return Array.from(new Set([...hrefs, ...(SEARCH_ONLY_HREFS[resolvedRole] || [])]));
}

/** Resolve a nav label, falling back to a readable title when a key is missing. */
export function navLabel(tr, key, fallback) {
  if (key) {
    const translated = tr(key);
    if (translated && translated !== key) return translated;
  }
  if (fallback) return fallback;
  const last = String(key || '').split('.').pop() || '';
  const spaced = last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

/** Backwards-compatible per-role snapshot of the sidebar. */
export const ROLE_MENU_CONFIG = Object.fromEntries(
  ALL_ROLES.map((role) => [role, menuSectionsForRole(role)]),
);

export default ROLE_MENU_CONFIG;
