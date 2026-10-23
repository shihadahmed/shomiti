'use client';

import React, { ReactNode, forwardRef, useState, useRef, useEffect } from 'react';
import { t, getLang } from '@/lib/i18n';
import {
  LayoutGrid,
  Users,
  Wallet,
  Shield,
  FileText,
  Book,
  Target,
  Plus,
  Search,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  Upload,
  Trash2,
  PencilLine,
  CircleAlert,
  Calendar,
  Phone,
  MapPin,
  Globe,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Eye,
  Banknote,
  TrendingUp,
  Clock,
  Funnel,
  CircleX,
  Camera,
  Check,
  Lock,
  User,
  CreditCard,
  Star,
  Bell,
  Settings,
  Info,
  LoaderCircle,
} from 'lucide-react';

const ICONS = {
  dashboard: LayoutGrid, users: Users, wallet: Wallet, shield: Shield,
  file: FileText, book: Book, target: Target, plus: Plus,
  search: Search, logout: LogOut, menu: Menu, close: X,
  chevronRight: ChevronRight, chevronLeft: ChevronLeft, chevronDown: ChevronDown,
  download: Download, upload: Upload, trash: Trash2, edit: PencilLine,
  alert: CircleAlert, calendar: Calendar, phone: Phone, mapPin: MapPin,
  globe: Globe, refresh: RefreshCw, arrowLeft: ArrowLeft, arrowRight: ArrowRight,
  eye: Eye, banknote: Banknote, trendingUp: TrendingUp, clock: Clock,
  filter: Funnel, xCircle: CircleX, camera: Camera, check: Check,
  lock: Lock, user: User, creditCard: CreditCard, award: Star,
  bell: Bell, settings: Settings, info: Info,
};

const BOLD_ICONS = new Set([
  'plus', 'close', 'chevronRight', 'chevronLeft',
  'chevronDown', 'arrowLeft', 'arrowRight', 'check',
]);

export function Icon({ name, className = 'h-5 w-5', strokeWidth }) {
  const Component = ICONS[name] || CircleAlert;
  const weight = strokeWidth ?? (BOLD_ICONS.has(name) ? 2 : 1.8);
  return (
    <span className={`inline-flex items-center justify-center ${className}`} aria-hidden="true">
      <Component width="100%" height="100%" strokeWidth={weight} />
    </span>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    active: 'badge-green', posted: 'badge-green', approved: 'badge-green', completed: 'badge-green', confirmed: 'badge-green', ok: 'badge-green',
    pending: 'badge-amber', pending_approval: 'badge-amber', suspended: 'badge-amber', defaulted: 'badge-red',
    initiated: 'badge-amber', rejected: 'badge-red', failed: 'badge-red', resigned: 'badge-red',
    cancelled: 'badge-slate', inactive: 'badge-slate', closed: 'badge-slate', refunded: 'badge-blue',
    due: 'badge-amber', overdue: 'badge-red', paid: 'badge-green',
    draft: 'badge-slate', pending_treasurer: 'badge-blue', pending_gs: 'badge-amber', pending_president: 'badge-amber',
  };
  return <span className={`badge ${styles[status] || 'badge-slate'}`}>{t(`status.${status}`)}</span>;
}

export const Button = forwardRef(
  ({ variant = 'primary', size = 'md', loading, loadingLabel, children, className = '', disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
    const variants = {
      primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900',
      secondary: 'border border-brand-200 bg-white text-brand-950 hover:bg-brand-50 active:bg-brand-100',
      ghost: 'text-brand-700 hover:bg-brand-100',
      danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
    };
    const sizes = {
      sm: 'rounded-lg px-3 py-1.5 text-xs',
      md: 'rounded-xl px-4 py-2.5 text-sm',
      lg: 'rounded-xl px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        )}
        {!loading && children}
        {loading && <span>{loadingLabel || t('common.saving')}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';

export const Input = forwardRef(
  ({ label, error, hint, className = '', id, icon, trailingIcon, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="label">{label}</label>}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-brand-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`input ${error ? 'input-error' : ''} ${className} ${icon ? 'pl-11' : ''} ${trailingIcon ? 'pr-11' : ''}`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {trailingIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-brand-400">
              {trailingIcon}
            </div>
          )}
        </div>
        {error && <p id={`${inputId}-error`} className="field-error" role="alert">{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="hint">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
  if (!isOpen) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div
        className={`modal-panel slide-up ${widths[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-brand-200 px-5 py-4 sm:px-6">
          <h2 id="modal-title" className="text-lg font-semibold text-brand-900">{title}</h2>
          <button type="button" className="btn-icon -mr-1 text-brand-400 hover:bg-brand-100 hover:text-brand-600" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-brand-200 bg-brand-50/60 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-brand-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'file', title, description }) {
  return (
    <div className="empty-state">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-400">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-brand-900">{title || t('common.noData')}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-brand-500">{description}</p>}
    </div>
  );
}

export function StatCard({ label, value, icon, sub, tone = 'brand', href }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700',
    gold: 'bg-brand-100 text-brand-900',
    sky: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  const content = (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-brand-500">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.brand}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  if (href) return <a href={href} className="block transition hover:-translate-y-0.5">{content}</a>;
  return content;
}

export function LoadingSpinner({ size = 'md' }) {
  const sizes = { sm: 'h-5 w-5', md: 'h-7 w-7', lg: 'h-10 w-10' };
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-brand-400">
        <LoaderCircle className={`${sizes[size]} animate-spin`} />
        <p className="text-sm">{t('common.loading')}</p>
      </div>
    </div>
  );
}

export function FilterBar({ children }) {
  return <div className="mb-5 flex flex-wrap items-center gap-3">{children}</div>;
}

export function SearchInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input pl-9"
        autoComplete="off"
      />
    </div>
  );
}

export const Select = forwardRef(function Select(
  { label, error, hint, id, children, options, className = '', ...props },
  ref,
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && <label htmlFor={selectId} className="label">{label}</label>}
      <select
        ref={ref}
        id={selectId}
        className={`input ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      >
        {children}
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="field-error" role="alert">{error}</p>}
      {hint && !error && <p className="hint">{hint}</p>}
    </div>
  );
});

export function formatMoney(value, opts) {
  const locale = getLang() === 'bn' ? 'bn-BD' : 'en-BD';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BDT',
    notation: opts?.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts?.compact ? 1 : 2,
    minimumFractionDigits: opts?.compact ? 0 : 0,
  }).format(value / 100);
}

export function formatDate(value, opts) {
  if (!value) return t('common.na');
  const date = new Date(value);
  if (isNaN(date.getTime())) return t('common.na');
  const locale = getLang() === 'bn' ? 'bn-BD' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(opts?.time ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function Pagination({ meta, onPage, className = '' }) {
  if (!meta || !meta.total) return null;
  const { page = 1, pages = 1, total = 0, limit = 20 } = meta;
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-brand-200 px-5 py-4 ${className}`}>
      <p className="text-sm text-brand-600">{`${from}–${to} / ${total}`}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page">
          <Icon name="chevronLeft" className="h-4 w-4" />
        </Button>
        <span className="min-w-[72px] text-center text-sm text-brand-600">{page} / {pages}</span>
        <Button variant="secondary" size="sm" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} aria-label="Next page">
          <Icon name="chevronRight" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export const Tabs = ({ value, onChange, children }) => (
  <div className="flex border-b border-brand-200 mb-6">
    {React.Children.map(children, (child) =>
      React.isValidElement(child) && (
        <button
          type="button"
          key={child.props.value}
          className={`px-4 py-2 text-sm font-medium rounded-t-xl transition ${
            value === child.props.value
              ? 'bg-brand-700 text-white'
              : 'text-brand-700 hover:bg-brand-100'
          }`}
          onClick={() => onChange(child.props.value)}
        >
          {child.props.children}
        </button>
      )
    )}
  </div>
);

export const Tab = ({ value, children }) => children;

// Dropdown Component
export function Dropdown({ trigger, items, className = '' }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 origin-top-right rounded-xl border border-brand-200 bg-white py-1 shadow-lg animate-fade-in" role="menu">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`w-full px-3 py-2 text-left text-sm ${item.className || ''} ${item.disabled ? 'text-brand-300 cursor-not-allowed' : 'text-brand-700 hover:bg-brand-50'}`}
              onClick={() => {
                if (!item.disabled && item.onClick) item.onClick();
                setOpen(false);
              }}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Tooltip Component
export function Tooltip({ content, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef(null);

  return (
    <div ref={tooltipRef} className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div
          className={`absolute z-50 px-2 py-1 text-[10px] font-medium text-white bg-brand-900 rounded shadow-lg whitespace-nowrap animate-fade-in
            ${position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-1' : ''}
            ${position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-1' : ''}
            ${position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-1' : ''}
            ${position === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-1' : ''}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Table Components
export function Table({ children, className = '' }) {
  return <div className={`overflow-hidden rounded-xl border border-brand-200 bg-white ${className}`}><table className="min-w-full divide-y divide-brand-200">{children}</table></div>;
}

export function TableHeader({ children }) {
  return <thead className="bg-brand-50/80">{children}</thead>;
}

export function TableBody({ children }) {
  return <tbody className="divide-y divide-brand-200 bg-white">{children}</tbody>;
}

export function TableRow({ children, className = '', ...props }) {
  return <tr className={className} {...props}>{children}</tr>;
}

export function TableCell({ children, className = '', colSpan, ...props }) {
  return <td className={`px-4 py-3 text-sm ${className}`} colSpan={colSpan} {...props}>{children}</td>;
}

// Badge variants
export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-brand-100 text-brand-700 border border-brand-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    danger: 'bg-red-50 text-red-700 border border-red-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    info: 'bg-blue-50 text-blue-700 border border-blue-100',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}

// Progress Component
export function Progress({ value = 0, max = 100, showLabel = false, label, className = '', color = 'brand' }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    brand: 'bg-brand-700',
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-brand-600">{label || (showLabel ? `${Math.round(percentage)}%` : '')}</span>
        {showLabel && label && <span className="text-xs text-brand-500 font-mono">{value} / {max}</span>}
      </div>
      <div className="h-2 bg-brand-100 rounded-full overflow-hidden">
        <div
          className={`${colors[color] || colors.brand} h-full rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// Checkbox Component
export function Checkbox({ checked = false, indeterminate = false, onChange, disabled = false, className = '', ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={`inline-flex items-center cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition disabled:cursor-not-allowed"
        {...props}
      />
    </label>
  );
}

// Textarea Component (re-export from form for convenience)
export { Textarea } from './form';

// Avatar Component
export function Avatar({ name, src, size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };
  const initials = name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold ring-2 ring-brand-100 ${sizes[size]} ${className}`}
      aria-label={name}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// FormatDate Component
export function FormatDate({ date, showTime = false, className = '' }) {
  if (!date) {
    return <span className={`text-sm text-brand-400 ${className}`}>—</span>;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return <span className={`text-sm text-brand-400 ${className}`}>—</span>;
  }
  const locale = typeof window !== 'undefined' && document.documentElement.lang === 'bn' ? 'bn-BD' : 'en-GB';
  const formatted = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
  return <span className={`text-sm text-brand-700 font-mono ${className}`}>{formatted}</span>;
}