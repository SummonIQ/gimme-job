import type {
  DesktopCdpToolDriver,
  DomSnapshotInput,
  DomSnapshotResult,
} from './types.js';

export function dom_snapshot(
  driver: DesktopCdpToolDriver,
  input: DomSnapshotInput,
): Promise<DomSnapshotResult> {
  return driver.domSnapshot(input);
}
