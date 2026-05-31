import type {
  DesktopCdpToolDriver,
  SelectInput,
  SelectResult,
} from './types.js';

export function select(
  driver: DesktopCdpToolDriver,
  input: SelectInput,
): Promise<SelectResult> {
  return driver.select(input);
}
