'use client';

import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  isActive: boolean;
  /** Whether to auto-focus the first element when trap is activated */
  autoFocus?: boolean;
  /** Whether to restore focus when trap is deactivated */
  restoreFocus?: boolean;
}

/**
 * Hook to manage focus trapping within a container element
 * Used for modals, dialogs, and other overlay components
 */
export function useFocusTrap({
  isActive,
  autoFocus = true,
  restoreFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    
    // Store the previously focused element
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement;
    }

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      const selectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]',
        'details > summary',
      ].join(', ');

      return Array.from(container.querySelectorAll(selectors)) as HTMLElement[];
    };

    // Focus the first focusable element
    if (autoFocus) {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Handle tab key to trap focus
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: moving backward
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forward
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle Escape key to close trap
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Let the parent component handle escape key
        // This is typically used to close modals
        const escapeEvent = new CustomEvent('focustrap:escape', {
          bubbles: true,
          detail: { originalEvent: event },
        });
        container.dispatchEvent(escapeEvent);
      }
    };

    // Add event listeners
    container.addEventListener('keydown', handleTabKey);
    container.addEventListener('keydown', handleEscapeKey);

    return () => {
      // Remove event listeners
      container.removeEventListener('keydown', handleTabKey);
      container.removeEventListener('keydown', handleEscapeKey);

      // Restore focus to previous element
      if (restoreFocus && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, autoFocus, restoreFocus]);

  return containerRef;
}
