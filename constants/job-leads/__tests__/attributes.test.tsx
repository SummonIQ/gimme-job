import { describe, expect, it } from 'vitest';

import { JobLeadStatus } from '@/generated/prisma/browser';

import { JobLeadStatusAttributes } from '../attributes';

describe('JobLeadStatusAttributes', () => {
  it('shows optimized as amber and applied as emerald', () => {
    expect(
      JobLeadStatusAttributes.variants.default[JobLeadStatus.OPTIMIZED]
        .className,
    ).toContain('text-amber-400');
    expect(
      JobLeadStatusAttributes.variants.default[JobLeadStatus.APPLIED].className,
    ).toContain('text-emerald-400');
  });
});
