import type {
  DesktopCdpToolDriver,
  ReadElementInput,
  ReadElementResult,
} from './types.js';

export function read_element(
  driver: DesktopCdpToolDriver,
  input: ReadElementInput,
): Promise<ReadElementResult> {
  return driver.readElement(input);
}
