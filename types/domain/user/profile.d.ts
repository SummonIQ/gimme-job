import { UserProfile } from '@/generated/prisma/browser';

export type WithUserProfile<T> = T & {
  profile: UserProfile;
};

export type WithOptionalUserProfile<T> = T & {
  profile?: UserProfile;
};
