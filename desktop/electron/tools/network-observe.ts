import type {
  DesktopCdpToolDriver,
  NetworkObserveInput,
  NetworkObserveResult,
} from './types.js';

export function network_observe(
  driver: DesktopCdpToolDriver,
  input: NetworkObserveInput,
): Promise<NetworkObserveResult> {
  return driver.networkObserve(input);
}
