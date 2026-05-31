import type {
  DesktopCdpToolDriver,
  NavigateInput,
  NavigateResult,
} from './types.js';

export function navigate(
  driver: DesktopCdpToolDriver,
  input: NavigateInput,
): Promise<NavigateResult> {
  return driver.navigate(input);
}
