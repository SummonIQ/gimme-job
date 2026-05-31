import type {
  DesktopCdpToolDriver,
  IdentityLoadInput,
  IdentityLoadResult,
} from './types.js';

export function identity_load(
  driver: DesktopCdpToolDriver,
  input: IdentityLoadInput,
): Promise<IdentityLoadResult> {
  return driver.identityLoad(input);
}
