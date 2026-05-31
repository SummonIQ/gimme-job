import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserAnalyticsIdentify } from '../user-analytics-identify';

const identify = vi.fn();

vi.mock('@summoniq/signalsplash-client-sdk/react', () => ({
  useAnalytics: () => ({
    identify,
  }),
}));

describe('UserAnalyticsIdentify', () => {
  it('identifies the authenticated user with Signalsplash traits', () => {
    render(
      <UserAnalyticsIdentify
        email="steven@example.com"
        firstName="Steven"
        lastName="Bennett"
        userId="user-1"
      />,
    );

    expect(identify).toHaveBeenCalledWith('user-1', {
      email: 'steven@example.com',
      firstName: 'Steven',
      lastName: 'Bennett',
    });
  });
});
