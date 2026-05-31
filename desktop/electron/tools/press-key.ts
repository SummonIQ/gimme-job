import type {
  DesktopCdpToolDriver,
  PressKeyInput,
  PressKeyResult,
} from './types.js';

export function press_key(
  driver: DesktopCdpToolDriver,
  input: PressKeyInput,
): Promise<PressKeyResult> {
  return driver.pressKey(input);
}
