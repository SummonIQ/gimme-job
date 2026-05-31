import type {
  DesktopCdpToolDriver,
  ScreenshotRegionInput,
  ScreenshotRegionResult,
} from './types.js';

export function screenshot_region(
  driver: DesktopCdpToolDriver,
  input: ScreenshotRegionInput,
): Promise<ScreenshotRegionResult> {
  return driver.screenshotRegion(input);
}
