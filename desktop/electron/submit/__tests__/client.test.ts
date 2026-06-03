import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createMemoryTokenStore } from '../../auth/keychain-store';
import { createMemoryIdentityStore } from '../../identity/store';
import { createDesktopSubmitClient } from '../client';

describe('createDesktopSubmitClient', () => {
  it('checks whether an application was already submitted before clicking submit', async () => {
    const tokenStore = createMemoryTokenStore('desktop-token');
    let requestedUrl = '';
    let requestedMethod = '';
    const client = createDesktopSubmitClient({
      appUrl: 'http://localhost:10100',
      fetchImpl: async (input, init) => {
        requestedUrl = String(input);
        requestedMethod = init?.method ?? 'GET';
        return Response.json({
          alreadySubmitted: true,
          jobLeadId: 'lead-1',
          reason: 'existing_submission',
          status: 'SUBMITTED',
          submissionId: 'submission-1',
          submittedAt: '2026-05-05T12:00:00.000Z',
        });
      },
      identityStore: createMemoryIdentityStore(),
      tokenStore,
    });

    await expect(
      client.checkSubmittedApplication({
        applicationUrl:
          'https://job-boards.greenhouse.io/example/jobs/123?source=gimme',
        jobLeadId: 'lead-1',
      }),
    ).resolves.toEqual({
      alreadySubmitted: true,
      jobLeadId: 'lead-1',
      reason: 'existing_submission',
      status: 'SUBMITTED',
      submissionId: 'submission-1',
      submittedAt: '2026-05-05T12:00:00.000Z',
    });

    expect(requestedMethod).toBe('GET');
    expect(requestedUrl).toBe(
      'http://localhost:10100/api/desktop/applications/submitted?applicationUrl=https%3A%2F%2Fjob-boards.greenhouse.io%2Fexample%2Fjobs%2F123%3Fsource%3Dgimme&jobLeadId=lead-1',
    );
  });

  it('passes the any-provider random filter to the desktop jobs API', async () => {
    const tokenStore = createMemoryTokenStore('desktop-token');
    let requestedUrl = '';
    const client = createDesktopSubmitClient({
      appUrl: 'http://localhost:10100',
      fetchImpl: async input => {
        requestedUrl = String(input);
        return Response.json({
          applicationUrl: 'https://jobs.ashbyhq.com/example/application',
          company: 'Fixture Co',
          jobLeadId: 'lead-1',
          jobListingId: 'listing-1',
          location: 'Remote',
          source: 'Ashby',
          title: 'Software Engineer',
        });
      },
      identityStore: createMemoryIdentityStore(),
      tokenStore,
    });

    await expect(
      client.pickRandomGreenhouseLead({
        provider: 'any',
        remote: true,
        search: ' engineer ',
      }),
    ).resolves.toMatchObject({
      applicationUrl: 'https://jobs.ashbyhq.com/example/application',
    });

    expect(requestedUrl).toBe(
      'http://localhost:10100/api/desktop/jobs/random?search=engineer&provider=any&remote=true',
    );
  });

  it('passes the greenhouse random filter to the desktop jobs API', async () => {
    const tokenStore = createMemoryTokenStore('desktop-token');
    let requestedUrl = '';
    const client = createDesktopSubmitClient({
      appUrl: 'http://localhost:10100',
      fetchImpl: async input => {
        requestedUrl = String(input);
        return Response.json({
          applicationUrl: 'https://example.com/careers?gh_jid=123',
          company: 'Fixture Co',
          jobLeadId: 'lead-1',
          jobListingId: 'listing-1',
          location: 'Remote',
          source: 'greenhouse',
          title: 'Software Engineer',
        });
      },
      identityStore: createMemoryIdentityStore(),
      tokenStore,
    });

    await expect(
      client.pickRandomGreenhouseLead({
        provider: 'greenhouse',
        remote: true,
        search: ' engineer ',
      }),
    ).resolves.toMatchObject({
      applicationUrl: 'https://example.com/careers?gh_jid=123',
    });

    expect(requestedUrl).toBe(
      'http://localhost:10100/api/desktop/jobs/random-greenhouse?search=engineer&provider=greenhouse&remote=true',
    );
  });

  it('syncs the desktop profile and default resume into the identity store', async () => {
    const tokenStore = createMemoryTokenStore('desktop-token');
    const identityStore = createMemoryIdentityStore();
    const client = createDesktopSubmitClient({
      appUrl: 'http://localhost:10100',
      fetchImpl: async input => {
        const url = String(input);

        if (url.endsWith('/api/desktop/profile')) {
          return Response.json({
            city: 'San Francisco',
            country: 'United States',
            disabilityStatus: 'I do not want to answer',
            email: 'steven@example.com',
            firstName: 'Steven',
            gender: 'Male',
            hispanicLatino: 'No',
            lastName: 'Bennett',
            linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
            phone: '+1 (555) 555-0123',
            race: 'White',
            referralSource: 'Gimme Job',
            resumeFileName: 'Steven Bennett Resume.pdf',
            resumeUrl: 'https://files.example.com/resume.pdf',
            salaryExpectation: '$180,000',
            sponsorshipRequired: 'no',
            state: 'CA',
            veteranStatus: 'I do not wish to answer',
            websiteUrl: 'https://stevenbennett.dev',
            workAuthorization: 'yes',
          });
        }

        if (url === 'https://files.example.com/resume.pdf') {
          return new Response('resume-bytes', { status: 200 });
        }

        return new Response('not found', { status: 404 });
      },
      identityStore,
      tokenStore,
    });

    const profile = await client.syncProfileToIdentity();

    await expect(identityStore.read('first_name')).resolves.toBe('Steven');
    await expect(identityStore.read('last_name')).resolves.toBe('Bennett');
    await expect(identityStore.read('email')).resolves.toBe(
      'steven@example.com',
    );
    await expect(identityStore.read('phone')).resolves.toBe(
      '+1 (555) 555-0123',
    );
    await expect(identityStore.read('city')).resolves.toBe('San Francisco');
    await expect(identityStore.read('state')).resolves.toBe('CA');
    await expect(identityStore.read('country')).resolves.toBe('United States');
    await expect(identityStore.read('work_authorization')).resolves.toBe('yes');
    await expect(identityStore.read('sponsorship_required')).resolves.toBe(
      'no',
    );
    await expect(identityStore.read('gender')).resolves.toBe('Male');
    await expect(identityStore.read('race_ethnicity')).resolves.toBe('White');
    await expect(identityStore.read('veteran_status')).resolves.toBe(
      'I do not wish to answer',
    );
    await expect(identityStore.read('disability_status')).resolves.toBe(
      'I do not want to answer',
    );
    expect(profile.hispanicLatino).toBe('No');
    expect(profile.linkedinUrl).toBe(
      'https://www.linkedin.com/in/stevenbennett',
    );
    expect(profile.referralSource).toBe('Gimme Job');
    expect(profile.salaryExpectation).toBe('$180,000');
    expect(profile.websiteUrl).toBe('https://stevenbennett.dev');

    const resumePath = await identityStore.read('resume_pdf_path');
    expect(resumePath).toContain('Steven-Bennett-Resume.pdf');
    await expect(readFile(resumePath ?? '', 'utf8')).resolves.toBe(
      'resume-bytes',
    );
  });
});
