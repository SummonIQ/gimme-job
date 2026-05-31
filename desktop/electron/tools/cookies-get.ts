import type {
  CookiesGetInput,
  CookiesGetResult,
  DesktopCdpToolDriver,
} from './types.js';

export function cookies_get(
  driver: DesktopCdpToolDriver,
  input: CookiesGetInput,
): Promise<CookiesGetResult> {
  return driver.cookiesGet(input);
}
