import type { ClickInput, ClickResult, DesktopCdpToolDriver } from './types.js';

export function click(
  driver: DesktopCdpToolDriver,
  input: ClickInput,
): Promise<ClickResult> {
  return driver.click(input);
}
