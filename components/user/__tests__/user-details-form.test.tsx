import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserDetailsForm } from '../user-details-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@summoniq/signalsplash-client-sdk/react', () => ({
  useAnalytics: () => ({
    track: vi.fn(),
  }),
}));

const user = {
  defaultResumeId: 'resume-1',
  email: 'steven@example.com',
  firstName: 'Steven',
  lastName: 'Bennett',
} as Parameters<typeof UserDetailsForm>[0]['user'];

const userProfile = {
  city: null,
  disabilityStatus: null,
  earliestStartDate: null,
  educationDegree: null,
  educationEndMonth: null,
  educationEndYear: null,
  educationInstitution: null,
  educationInstitutionLocation: null,
  educationStartMonth: null,
  educationStartYear: null,
  emailAddress: null,
  firstName: null,
  gender: null,
  githubUrl: null,
  lastName: null,
  linkedinUrl: null,
  personalWebsiteUrl: null,
  phoneNumber: null,
  preferredName: null,
  pronouns: null,
  race: null,
  requiresSponsorship: null,
  salaryExpectation: null,
  state: null,
  streetAddress: null,
  transgenderIdentity: null,
  veteranStatus: null,
  websiteUrl: null,
  workAuthorization: null,
  yearsOfExperience: null,
  zipCode: null,
} satisfies Parameters<typeof UserDetailsForm>[0]['userProfile'];

describe('UserDetailsForm', () => {
  it('renders parsed profile sections and EEO fields', () => {
    render(
      <UserDetailsForm
        action={vi.fn()}
        hasDefaultResume
        initialHispanicLatino="No"
        initialProfessionalSummary="Seasoned software engineer."
        initialReferralSource="Gimme Job"
        initialSkills={[{ text: 'React and TypeScript' }]}
        initialWorkExperience={[
          {
            bulletItems: [{ text: 'Built resume automation.' }],
            company: 'Gimme Job',
            description: 'Application automation.',
            endDate: '',
            startDate: '',
            title: 'Staff Engineer',
          },
        ]}
        resumeOptions={[
          { id: 'resume-1', name: 'Steven Bennett Resume', url: null },
        ]}
        updateDefaultResumeAction={vi.fn()}
        user={user}
        userProfile={userProfile}
      />,
    );

    expect(screen.getByDisplayValue('Seasoned software engineer.')).toHaveValue(
      'Seasoned software engineer.',
    );
    expect(screen.getByDisplayValue('React and TypeScript')).toBeVisible();
    expect(screen.getByDisplayValue('Built resume automation.')).toBeVisible();
    expect(screen.getByText('Hispanic / Latino')).toBeVisible();
    expect(screen.getByText('Veteran Status')).toBeVisible();
    expect(screen.getByText('Disability Status')).toBeVisible();
  });

  it('auto-formats salary expectation as dollars', async () => {
    const userAction = userEvent.setup();
    render(
      <UserDetailsForm
        action={vi.fn()}
        hasDefaultResume
        initialProfessionalSummary=""
        initialSkills={[]}
        initialWorkExperience={[]}
        resumeOptions={[
          { id: 'resume-1', name: 'Steven Bennett Resume', url: null },
        ]}
        updateDefaultResumeAction={vi.fn()}
        user={user}
        userProfile={userProfile}
      />,
    );

    const salaryField = screen.getByLabelText('Salary Expectation');
    await userAction.type(salaryField, '120000');

    expect(salaryField).toHaveValue('$120,000');
  });

  it('shows the application tracking email when tracking is enabled', () => {
    render(
      <UserDetailsForm
        action={vi.fn()}
        applicationTrackingEmail="steven-track@gimmejob.com"
        applicationTrackingEmailEnabled
        hasDefaultResume
        initialProfessionalSummary=""
        initialSkills={[]}
        initialWorkExperience={[]}
        resumeOptions={[
          { id: 'resume-1', name: 'Steven Bennett Resume', url: null },
        ]}
        updateDefaultResumeAction={vi.fn()}
        user={user}
        userProfile={userProfile}
      />,
    );

    const emailField = screen.getByLabelText('Email Address');
    expect(emailField).toHaveValue('steven-track@gimmejob.com');
    expect(emailField).toHaveAttribute('readonly');
    expect(
      screen.getByText(/Application tracking is enabled/),
    ).toBeVisible();
  });
});
