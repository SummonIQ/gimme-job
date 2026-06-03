import { useEffect } from 'react';

// Selectors for any HTML overlay that gets visually covered by the
// Electron BrowserViews (which are always composited above the renderer's
// HTML at the OS level). Radix UI portals everything into document.body
// with these markers:
//   - data-radix-popper-content-wrapper — DropdownMenu, Popover,
//     HoverCard, Tooltip (popper-based)
//   - role="dialog" — Dialog/Modal/Drawer
//   - data-state="open" cmdk command palette popup
const OVERLAY_SELECTORS = [
  '[data-radix-popper-content-wrapper]',
  '[role="dialog"][data-state="open"]',
  '[data-radix-portal] [data-state="open"]',
] as const;

/**
 * Installs a MutationObserver on document.body that counts open Radix
 * overlays and tells main to collapse both BrowserViews while any are
 * visible. Without this, dropdown menus / popovers that extend into the
 * Training BrowserView area get covered by it.
 *
 * Mount once at the top of the desktop renderer tree.
 */
export function useBrowserViewOverlayGuard(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const shell = window.gimmeJobDesktop?.shell;
    if (!shell?.setRendererOverlayActive) return;

    let lastActive = false;
    const setActive = (active: boolean) => {
      if (active === lastActive) return;
      lastActive = active;
      void shell.setRendererOverlayActive(active);
    };

    const countOpenOverlays = (): number => {
      let total = 0;
      for (const selector of OVERLAY_SELECTORS) {
        total += document.querySelectorAll(selector).length;
      }
      return total;
    };

    const reevaluate = () => {
      setActive(countOpenOverlays() > 0);
    };

    const observer = new MutationObserver(reevaluate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });

    // One-shot initial check in case an overlay was already open at mount.
    reevaluate();

    return () => {
      observer.disconnect();
      // Make sure we don't leave the views hidden on unmount.
      if (lastActive) {
        lastActive = false;
        void shell.setRendererOverlayActive(false);
      }
    };
  }, []);
}
