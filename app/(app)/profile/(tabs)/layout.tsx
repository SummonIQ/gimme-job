import { Page, PageHeader } from '@/components/layout/page';
import { TabNavigation } from '@/components/navigation/tab-navigation';

const PROFILE_TABS = [
  { href: '/profile', label: 'Profile' },
  { href: '/profile/resumes', label: 'Resumes' },
  { href: '/profile/job-preferences', label: 'Job Preferences' },
];

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Page name="profile">
      <PageHeader
        title="My Profile"
        description="Manage your profile, resumes, and job preferences."
        actions={
          <TabNavigation defaultValue="/profile" tabs={PROFILE_TABS} />
        }
      />
      {children}
    </Page>
  );
}
