import type {
  DesktopCdpToolDriver,
  SubmitGuardInput,
  SubmitGuardResult,
} from './types.js';

export function submit_guard(
  driver: DesktopCdpToolDriver,
  input: SubmitGuardInput,
): Promise<SubmitGuardResult> {
  return driver.submitGuard(input);
}
