import type {
  CookiesSetInput,
  CookiesSetResult,
  DesktopCdpToolDriver,
} from './types.js';

export function cookies_set(
  driver: DesktopCdpToolDriver,
  input: CookiesSetInput,
): Promise<CookiesSetResult> {
  return driver.cookiesSet(input);
}
