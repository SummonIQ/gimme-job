import { describe, expect, it } from 'vitest';

import {
  calculateDesktopLayout,
  DESKTOP_SIDEBAR_WIDTH,
} from '../window-layout';

describe('calculateDesktopLayout', () => {
  it('leaves the React sidebar visible and allocates both BrowserViews', () => {
    const layout = calculateDesktopLayout({ height: 900, width: 1440 });

    expect(layout.sidebar).toMatchObject({
      height: 900,
      width: DESKTOP_SIDEBAR_WIDTH,
      x: 0,
      y: 0,
    });
    expect(layout.main.x).toBe(DESKTOP_SIDEBAR_WIDTH);
    expect(layout.main.width).toBeGreaterThan(0);
    expect(layout.assist.x).toBeGreaterThan(layout.main.x);
    expect(layout.assist.width).toBeGreaterThan(0);
  });
});
