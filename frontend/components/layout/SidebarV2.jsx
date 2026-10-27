'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { Icon } from '@/components/ui/common';
import { menuSectionsForRole, navLabel } from '@/lib/navigation';

export function Sidebar({ isOpen, onClose, isCollapsed, onCollapseChange, pendingApprovals = 0 }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { tr } = useLang();

  const role = user?.role || 'member';
  const menuConfig = menuSectionsForRole(role);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        onClose();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onClose]);

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-64';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-brand-200
          transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarWidth}
        `}
        aria-label="Main navigation"
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-brand-200 overflow-hidden">
          <Link href="/dashboard" className="flex-shrink-0" aria-label={tr('app.name')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 shadow-sm ring-2 ring-brand-100 overflow-hidden">
              <img src="/logo.png" alt="" className="h-full w-full object-cover" aria-hidden="true" />
            </span>
          </Link>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="truncate text-sm font-semibold text-brand-900">{tr('app.name')}</p>
              <p className="truncate text-[10px] uppercase tracking-[0.18em] text-brand-500">{tr('app.tagline')}</p>
            </div>
          )}
          <button
            type="button"
            className="flex-shrink-0 p-1.5 rounded-lg text-brand-500 hover:bg-brand-100 transition lg:inline-flex"
            onClick={() => onCollapseChange(!isCollapsed)}
            aria-label={isCollapsed ? tr('sidebar.expand') : tr('sidebar.collapse')}
            aria-expanded={!isCollapsed}
          >
            <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4" aria-label="Main menu">
          {menuConfig.map((section) => (
            <div key={section.section}>
              {!isCollapsed && (
                <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-widest text-brand-400">
                  {navLabel(tr, section.section, section.title)}
                </p>
              )}
              <ul className="space-y-1" role="list">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const badgeCount = item.badge === 'pendingApprovals' ? pendingApprovals : 0;
                  const itemTitle = navLabel(tr, item.label, item.defaultTitle);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`
                          flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
                          ${active
                            ? 'bg-brand-700 text-white shadow-sm'
                            : 'text-brand-700 hover:bg-brand-100 hover:text-brand-900'
                          }
                          ${isCollapsed ? 'justify-center px-3' : ''}
                        `}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        title={isCollapsed ? itemTitle : undefined}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                          <Icon name={item.icon} className="h-5 w-5" />
                        </span>
                        {!isCollapsed && (
                          <>
                            <span className="truncate flex-1">{itemTitle}</span>
                            {badgeCount > 0 && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;