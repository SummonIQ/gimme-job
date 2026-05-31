import { UserJobPreferences } from '@/generated/prisma/browser';

export type WithUserJobPreferences<T> = T & {
  jobPreferences: UserJobPreferences;
};

export type WithOptionalUserJobPreferences<T> = T & {
  jobPreferences?: UserJobPreferences;
};
