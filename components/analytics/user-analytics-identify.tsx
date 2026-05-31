'use client';

import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import { useEffect } from 'react';

interface UserAnalyticsIdentifyProps {
  readonly email?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly userId: string;
}

export function UserAnalyticsIdentify({
  email,
  firstName,
  lastName,
  userId,
}: UserAnalyticsIdentifyProps) {
  const { identify } = useAnalytics();

  useEffect(() => {
    identify(userId, {
      email: email ?? undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
    });
  }, [email, firstName, identify, lastName, userId]);

  return null;
}
