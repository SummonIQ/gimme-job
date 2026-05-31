import type {
  DesktopCdpToolDriver,
  ScrollIntoViewInput,
  ScrollIntoViewResult,
} from './types.js';

export function scroll_into_view(
  driver: DesktopCdpToolDriver,
  input: ScrollIntoViewInput,
): Promise<ScrollIntoViewResult> {
  return driver.scrollIntoView(input);
}
