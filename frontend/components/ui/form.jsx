'use client';

import React, { forwardRef } from 'react';
import { Icon, Button, EmptyState, LoadingSpinner, Select, SearchInput, Pagination } from './common';

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, id, className = '', rows = 3, ...props },
  ref,
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`input resize-y ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
      {error && <p className="field-error" role="alert">{error}</p>}
      {hint && !error && <p className="hint">{hint}</p>}
    </div>
  );
});

export function FormSection({ title, description, children, className = '' }) {
  return (
    <fieldset className={`rounded-2xl border border-brand-200 bg-white p-5 ${className}`}>
      {(title || description) && (
        <legend className="px-1">
          <span className="text-sm font-semibold text-brand-900">{title}</span>
          {description && <span className="ml-2 text-xs text-brand-500">{description}</span>}
        </legend>
      )}
      {children}
    </fieldset>
  );
}

export function FormActions({ children }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-200 pt-4">
      {children}
    </div>
  );
}

export function FilterBar({ children }) {
  return <div className="mb-5 flex flex-wrap items-center gap-3">{children}</div>;
}
