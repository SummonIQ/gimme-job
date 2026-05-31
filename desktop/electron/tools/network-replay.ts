import type {
  DesktopCdpToolDriver,
  NetworkReplayInput,
  NetworkReplayResult,
} from './types.js';

export function network_replay(
  driver: DesktopCdpToolDriver,
  input: NetworkReplayInput,
): Promise<NetworkReplayResult> {
  return driver.networkReplay(input);
}
