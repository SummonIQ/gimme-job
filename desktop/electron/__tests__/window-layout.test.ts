import { describe, expect, it } from 'vitest';

import {
  calculateDesktopLayout,
  DESKTOP_APP_HEADER_HEIGHT,
  DESKTOP_BROWSER_BAR_HEIGHT,
  DESKTOP_RESIZE_HANDLE_WIDTH,
  DESKTOP_STATUS_BAR_HEIGHT,
  DESKTOP_TAB_BAR_HEIGHT,
  DESKTOP_TOOLBAR_HEIGHT,
} from '../window-layout';

describe('calculateDesktopLayout', () => {
  it('leaves the React sidebar visible, keeps ATS visible, and hides the app BrowserView offscreen', () => {
    const layout = calculateDesktopLayout({ height: 900, width: 1440 });
    const sidebarTopChrome = DESKTOP_APP_HEADER_HEIGHT;
    const assistTopChrome =
      DESKTOP_APP_HEADER_HEIGHT +
      DESKTOP_BROWSER_BAR_HEIGHT +
      DESKTOP_TAB_BAR_HEIGHT;
    const expectedSidebarHeight =
      900 - sidebarTopChrome - DESKTOP_STATUS_BAR_HEIGHT;
    const expectedAssistHeight =
      900 - assistTopChrome - DESKTOP_STATUS_BAR_HEIGHT;

    expect(layout.sidebar).toMatchObject({
      height: expectedSidebarHeight,
      x: 0,
      y: sidebarTopChrome,
    });
    expect(layout.sidebar.width).toBeGreaterThan(0);
    expect(layout.main).toMatchObject({
      height: 1,
      width: 1,
      x: -10_000,
      y: 0,
    });
    expect(layout.assist.x).toBe(
      layout.sidebar.width + DESKTOP_RESIZE_HANDLE_WIDTH,
    );
    expect(layout.assist.y).toBe(assistTopChrome);
    expect(layout.assist.height).toBe(expectedAssistHeight);
    expect(layout.assist.width).toBeGreaterThan(0);
  });

  it('respects explicit visible panel sizes when calculating view bounds', () => {
    const layout = calculateDesktopLayout(
      { height: 900, width: 1440 },
      { assist: 25, main: 45, sidebar: 30 },
    );

    expect(layout.sidebar.width).toBeGreaterThan(layout.assist.width);
    expect(layout.main.width).toBe(1);
  });
});
