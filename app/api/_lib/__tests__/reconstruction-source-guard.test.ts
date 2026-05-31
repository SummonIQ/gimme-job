// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';

import { rejectNonReconstructionSource } from '../reconstruction-source-guard';

describe('rejectNonReconstructionSource', () => {
  it('passes when source is omitted', () => {
    expect(rejectNonReconstructionSource(undefined)).toBeNull();
  });

  it('passes when source is RECONSTRUCTION', () => {
    expect(
      rejectNonReconstructionSource(ApplicationRuntimeSource.RECONSTRUCTION),
    ).toBeNull();
  });

  it('rejects with 403 when source is TRUE_EXECUTION', async () => {
    const response = rejectNonReconstructionSource(
      ApplicationRuntimeSource.TRUE_EXECUTION,
    );
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    const payload = (await response?.json()) as { error: string };
    expect(payload.error).toBe(
      'Reconstruction endpoints can only emit source=RECONSTRUCTION',
    );
  });

  it('rejects with 403 for arbitrary string values', () => {
    const response = rejectNonReconstructionSource('OTHER');
    expect(response?.status).toBe(403);
  });

  it('rejects with 403 for non-string values', () => {
    expect(rejectNonReconstructionSource(123)?.status).toBe(403);
    expect(rejectNonReconstructionSource(null)?.status).toBe(403);
  });
});
