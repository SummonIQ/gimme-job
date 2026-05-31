import type {
  DesktopCdpToolDriver,
  WaitForInput,
  WaitForResult,
} from './types.js';

export function wait_for(
  driver: DesktopCdpToolDriver,
  input: WaitForInput,
): Promise<WaitForResult> {
  return driver.waitFor(input);
}
