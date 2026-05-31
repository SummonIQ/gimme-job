import type { DesktopCdpToolDriver, FillInput, FillResult } from './types.js';

export function fill(
  driver: DesktopCdpToolDriver,
  input: FillInput,
): Promise<FillResult> {
  return driver.fill(input);
}
