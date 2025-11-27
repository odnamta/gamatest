'use client';

import { forwardRef, TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
}

/**
 * Textarea component with light/dark mode support.
 * Requirements: 4.4, 4.5 - WCAG AA contrast ratios maintained in both modes.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, name, error, className = '', ...props }, ref) => {
    const textareaId = `textarea-${name}`;

    return (
      <div className="w-full">
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          {label}
        </label>
        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-y min-h-[100px] ${
            error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
          } ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${textareaId}-error`}
            className="mt-1 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
