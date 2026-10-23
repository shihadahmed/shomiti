export const ROLE_MENU_CONFIG = {
  super_admin: [
    { section: 'nav.dashboard', items: [{ href: '/dashboard', label: 'nav.dashboard', icon: 'dashboard' }] },
    { section: 'nav.members', items: [{ href: '/members', label: 'nav.members', icon: 'users' }, { href: '/members/add', label: 'members.add', icon: 'plus' }] },
    { section: 'nav.users', items: [{ href: '/users', label: 'nav.users', icon: 'users' }] },
    { section: 'nav.savings', items: [{ href: '/savings', label: 'savings.title', icon: 'wallet' }, { href: '/savings/dues', label: 'savings.dueTitle', icon: 'target' }, { href: '/savings/config', label: 'admin.savingsConfig', icon: 'settings' }] },
    { section: 'nav.approvals', items: [{ href: '/approvals', label: 'approvals.title', icon: 'shield', badge: 'pendingApprovals' }] },
    { section: 'nav.expenses', items: [{ href: '/expenses', label: 'expenses.title', icon: 'calendar' }, { href: '/expenses/categories', label: 'expenses.categories', icon: 'target' }] },
    { section: 'nav.ledger', items: [{ href: '/ledger', label: 'ledger.title', icon: 'book' }] },
    { section: 'nav.meetings', items: [{ href: '/meetings', label: 'nav.meetings', icon: 'calendar' }] },
    { section: 'nav.documents', items: [{ href: '/documents', label: 'documents.title', icon: 'file' }] },
    { section: 'nav.reports', items: [{ href: '/reports', label: 'nav.reports', icon: 'file' }] },
    { section: 'nav.audit', items: [{ href: '/audit', label: 'nav.audit', icon: 'file' }] },
    { section: 'nav.system', items: [{ href: '/settings', label: 'nav.system', icon: 'settings' }] },
  ],
  treasurer: [
    { section: 'nav.dashboard', items: [{ href: '/dashboard', label: 'nav.dashboard', icon: 'dashboard' }] },
    { section: 'nav.members', items: [{ href: '/members', label: 'nav.members', icon: 'users' }, { href: '/members/add', label: 'members.add', icon: 'plus' }] },
    { section: 'nav.savings', items: [{ href: '/savings', label: 'savings.title', icon: 'wallet' }, { href: '/savings/dues', label: 'savings.dueTitle', icon: 'target' }, { href: '/savings/config', label: 'admin.savingsConfig', icon: 'settings' }] },
    { section: 'nav.approvals', items: [{ href: '/approvals', label: 'approvals.title', icon: 'shield', badge: 'pendingApprovals' }] },
    { section: 'nav.expenses', items: [{ href: '/expenses', label: 'expenses.title', icon: 'calendar' }, { href: '/expenses/create', label: 'expenses.create', icon: 'plus' }, { href: '/expenses/categories', label: 'expenses.categories', icon: 'target' }] },
    { section: 'nav.ledger', items: [{ href: '/ledger', label: 'ledger.title', icon: 'book' }] },
    { section: 'nav.documents', items: [{ href: '/documents', label: 'documents.title', icon: 'file' }] },
    { section: 'nav.reports', items: [{ href: '/reports', label: 'nav.reports', icon: 'file' }] },
    { section: 'nav.system', items: [{ href: '/settings', label: 'nav.system', icon: 'settings' }] },
  ],
  general_secretary: [
    { section: 'nav.dashboard', items: [{ href: '/dashboard', label: 'nav.dashboard', icon: 'dashboard' }] },
    { section: 'nav.members', items: [{ href: '/members', label: 'nav.members', icon: 'users' }] },
    { section: 'nav.savings', items: [{ href: '/savings', label: 'savings.title', icon: 'wallet' }, { href: '/savings/dues', label: 'savings.dueTitle', icon: 'target' }] },
    { section: 'nav.approvals', items: [{ href: '/approvals', label: 'approvals.title', icon: 'shield', badge: 'pendingApprovals' }] },
    { section: 'nav.expenses', items: [{ href: '/expenses', label: 'expenses.title', icon: 'calendar' }] },
    { section: 'nav.documents', items: [{ href: '/documents', label: 'documents.title', icon: 'file' }] },
    { section: 'nav.meetings', items: [{ href: '/meetings', label: 'nav.meetings', icon: 'calendar' }] },
    { section: 'nav.reports', items: [{ href: '/reports', label: 'nav.reports', icon: 'file' }] },
    { section: 'nav.system', items: [{ href: '/settings', label: 'nav.system', icon: 'settings' }] },
  ],
  president: [
    { section: 'nav.dashboard', items: [{ href: '/dashboard', label: 'nav.dashboard', icon: 'dashboard' }] },
    { section: 'nav.approvals', items: [{ href: '/approvals', label: 'approvals.title', icon: 'shield', badge: 'pendingApprovals' }] },
    { section: 'nav.documents', items: [{ href: '/documents', label: 'documents.title', icon: 'file' }] },
    { section: 'nav.reports', items: [{ href: '/reports', label: 'nav.reports', icon: 'file' }] },
  ],
  member: [
    { section: 'nav.dashboard', items: [{ href: '/dashboard', label: 'nav.dashboard', icon: 'dashboard' }] },
    { section: 'nav.profile', items: [{ href: '/profile', label: 'settings.memberProfile', icon: 'user' }] },
    { section: 'nav.savings', items: [{ href: '/savings/my', label: 'settings.mySavings', icon: 'wallet' }, { href: '/savings/my/schemes', label: 'savings.mySchemes', icon: 'target' }, { href: '/savings/my/dues', label: 'settings.dues', icon: 'target' }] },
    { section: 'nav.payments', items: [{ href: '/payments', label: 'settings.payNow', icon: 'creditCard' }, { href: '/payments/offline', label: 'settings.submitOfflinePayment', icon: 'upload' }] },
    { section: 'nav.documents', items: [{ href: '/documents/my', label: 'settings.myDocuments', icon: 'file' }, { href: '/certificate', label: 'settings.membershipCertificate', icon: 'award' }] },
    { section: 'nav.reports', items: [{ href: '/statement', label: 'statement.title', icon: 'file' }] },
    { section: 'nav.settings', items: [{ href: '/notifications', label: 'settings.notifications', icon: 'bell' }] },
  ],
};

export function menuSectionsForRole(role) {
  return ROLE_MENU_CONFIG[role] || ROLE_MENU_CONFIG.member;
}

export default ROLE_MENU_CONFIG;
