import { forwardRef } from 'react';

import type { FormErrorEntry } from '@/lib/a11y/form-utils';

type FormErrorSummaryProps = {
  errors: FormErrorEntry[];
  heading?: string;
  onSelect?: (path: string) => void;
  visible?: boolean;
};

export const FormErrorSummary = forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  ({ errors, heading = 'Please fix the following issues:', onSelect, visible = false }, ref) => {
    if (!visible || errors.length === 0) {
      return null;
    }

    return (
      <div
        aria-live="assertive"
        className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        data-testid="form-error-summary"
        ref={ref}
        role="alert"
        tabIndex={-1}
      >
        <p className="font-semibold">{heading}</p>
        <ul className="mt-2 space-y-1">
          {errors.map(error => (
            <li key={error.path}>
              <button
                className="text-left text-destructive underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
                onClick={() => onSelect?.(error.path)}
                type="button"
              >
                {error.message}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

FormErrorSummary.displayName = 'FormErrorSummary';
