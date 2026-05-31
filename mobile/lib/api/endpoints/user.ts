import { api } from '@/lib/api/client';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  defaultResumeId: string | null;
  profile: {
    city: string | null;
    state: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    educationDegree: string | null;
    educationField: string | null;
  } | null;
  jobPreferences: {
    companySize: string | null;
    experienceLevel: string | null;
    industries: string[];
    jobTypes: string[];
    locations: string[];
    remote: boolean | null;
    salaryMin: number | null;
    salaryMax: number | null;
    targetRoles: string[];
  } | null;
}

export function getUserProfile(): Promise<UserProfile> {
  return api.get('/api/mobile/user/profile');
}

export function updateUserProfile(data: Record<string, unknown>): Promise<UserProfile> {
  return api.patch('/api/mobile/user/profile', data);
}
