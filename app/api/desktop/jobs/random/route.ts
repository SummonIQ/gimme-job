import { getDesktopRandomJobResponse } from '../_random-job';

export async function GET(request: Request) {
  return getDesktopRandomJobResponse(request, {
    allowProviderParam: true,
    defaultProvider: 'any',
  });
}
