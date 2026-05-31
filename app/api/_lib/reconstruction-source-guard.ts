import { NextResponse } from 'next/server';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';

export function rejectNonReconstructionSource(
  source: unknown,
): NextResponse | null {
  if (
    source === undefined ||
    source === ApplicationRuntimeSource.RECONSTRUCTION
  ) {
    return null;
  }

  return NextResponse.json(
    {
      error: 'Reconstruction endpoints can only emit source=RECONSTRUCTION',
    },
    { status: 403 },
  );
}
