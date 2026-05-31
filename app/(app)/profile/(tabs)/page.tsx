import { PageTracker } from '@/components/analytics/page-tracker';
import { ProfileSettingsSection } from '@/components/user/profile-settings-section';

export default async function ProfileDetails() {
  return (
    <>
      <PageTracker pageName="profile" properties={{ tab: 'profile' }} />
      <ProfileSettingsSection />
    </>
  );
}
