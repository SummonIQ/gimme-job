import type {
  DesktopCdpToolDriver,
  UploadInput,
  UploadResult,
} from './types.js';

export function upload(
  driver: DesktopCdpToolDriver,
  input: UploadInput,
): Promise<UploadResult> {
  return driver.upload(input);
}
