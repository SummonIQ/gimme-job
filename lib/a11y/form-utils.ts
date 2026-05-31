import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormReturn,
} from 'react-hook-form';

export type FormErrorEntry = {
  message: string;
  path: string;
};

function isFieldError(value: unknown): value is { message?: string } {
  return Boolean(value) && typeof value === 'object' && 'message' in (value as Record<string, unknown>);
}

export function flattenFormErrors<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  parentPath = '',
): FormErrorEntry[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (!value) {
      return [];
    }

    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if (isFieldError(value)) {
      const message = value.message
        ? String(value.message)
        : `Please check the ${currentPath.split('.').slice(-1)[0]} field`;
      return [
        {
          message,
          path: currentPath,
        },
      ];
    }

    if (typeof value === 'object') {
      return flattenFormErrors(value as FieldErrors<TFieldValues>, currentPath);
    }

    return [];
  });
}

export function findFirstErrorPath<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  parentPath = '',
): string | undefined {
  for (const [key, value] of Object.entries(errors)) {
    if (!value) {
      continue;
    }

    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if (isFieldError(value)) {
      return currentPath;
    }

    if (typeof value === 'object') {
      const nested = findFirstErrorPath(value as FieldErrors<TFieldValues>, currentPath);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

export function useFormErrorHandling<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
) {
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [shouldShowSummary, setShouldShowSummary] = useState(false);
  const errors = form.formState.errors;

  const errorEntries = useMemo(
    () => flattenFormErrors<TFieldValues>(errors),
    [errors],
  );

  useEffect(() => {
    if (errorEntries.length === 0) {
      setShouldShowSummary(false);
    }
  }, [errorEntries.length]);

  useEffect(() => {
    if (shouldShowSummary && errorEntries.length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errorEntries.length, shouldShowSummary]);

  const handleInvalid = useCallback(
    (invalidErrors: FieldErrors<TFieldValues>) => {
      const firstPath = findFirstErrorPath<TFieldValues>(invalidErrors);
      if (firstPath) {
        form.setFocus(firstPath as Path<TFieldValues>);
      }
      setShouldShowSummary(true);
    },
    [form],
  );

  const focusField = useCallback(
    (path: string) => {
      form.setFocus(path as Path<TFieldValues>);
    },
    [form],
  );

  return {
    errorEntries,
    errorSummaryRef,
    focusField,
    handleInvalid,
    showSummary: shouldShowSummary && errorEntries.length > 0,
  };
}
