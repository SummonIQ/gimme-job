import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';

import type { DesktopToolRegistry } from '../../tools/registry';
import type {
  DesktopToolCallRequest,
  DesktopToolCallResult,
  DesktopToolName,
} from '../../tools/types';
import { runGreenhouseSubmitLead } from '../greenhouse-submit';

function createRegistry(options: { readonly extraHtml?: string } = {}) {
  const calls: DesktopToolCallRequest[] = [];
  const fieldValues = new Map<string, string>();
  let isSubmitGuardEnabled = true;
  const identities: Record<string, string> = {
    email: 'steven@example.com',
    first_name: 'Steven',
    last_name: 'Bennett',
    phone: '+15555550123',
    resume_pdf_path: '/tmp/resume.pdf',
  };
  let submitClickSucceeded = false;
  const registry: DesktopToolRegistry = {
    async call(request) {
      calls.push(request);
      if (request.tool === 'dom_snapshot') {
        if (submitClickSucceeded) {
          // After a successful submit (submit_guard disabled), the fixture
          // flips to a confirmation page so waitForSubmissionConfirmation
          // can return confirmed: true. Otherwise it polls for the full
          // 30s deadline and the test times out.
          return ok(request.tool, {
            html: `
              <main>
                <h1>Thanks for applying!</h1>
                <p>We've received your application and will be in touch.</p>
              </main>
            `,
            title: 'Application received — Fixture Greenhouse',
            url: 'https://job-boards.greenhouse.io/example/jobs/123/applications/456',
          });
        }
        return ok(request.tool, {
          html: applyFixtureFieldValues(
            `
            <form id="application_form">
              <label for="country">Country *</label>
              <select id="country" name="country"></select>
              <label for="location">Location (City) *</label>
              <input id="location" name="location" type="text" />
              <label for="linkedin_profile">LinkedIn Profile</label>
              <input id="linkedin_profile" name="linkedin_profile" type="text" />
              <label for="website">Website</label>
              <input id="website" name="website" type="text" />
              <label for="question_referral">How did you hear about this opportunity?</label>
              <textarea id="question_referral" name="question_referral"></textarea>
              <label for="resume_upload">Resume/CV *</label>
              <input id="resume_upload" name="candidate_resume" type="file" />
              <div>Are you able to work in the United States? *</div>
              <select id="question_authorized" name="question_authorized"></select>
              <div>Will you now or in the future require sponsorship for Employment Visa status? *</div>
              <select id="question_sponsorship" name="question_sponsorship"></select>
              <label for="question_location_requirement">This role requires that you currently reside and work from the US. Do you meet this location requirement? *</label>
              <select id="question_location_requirement" name="question_location_requirement"></select>
              <div>With which gender do you most identify?</div>
              <select id="question_gender" name="question_gender"></select>
              <div>Are you Hispanic/Latino?</div>
              <select id="question_hispanic" name="question_hispanic"></select>
              <div>I identify my ethnicity as:</div>
              <select id="question_race" name="question_race"></select>
              <div>Veteran Status</div>
              <select id="question_veteran" name="question_veteran"></select>
              <div>Disability Status</div>
              <select id="question_disability" name="question_disability"></select>
              <label for="question_location_text">What city and state do you live in?</label>
              <textarea id="question_location_text" name="question_location_text"></textarea>
              <label for="desired_salary">Desired Salary</label>
              <input id="desired_salary" name="desired_salary" type="text" />
              <label for="current_residence">Where do you currently reside?</label>
              <input id="current_residence" name="current_residence" type="text" />
              ${options.extraHtml ?? ''}
            </form>
          `,
            fieldValues,
          ),
          title: 'Fixture Greenhouse Application',
          url: 'https://job-boards.greenhouse.io/example/jobs/123',
        });
      }
      if (request.tool === 'submit_guard') {
        const input = readRecord(request.input);
        if (typeof input.enabled === 'boolean') {
          isSubmitGuardEnabled = input.enabled;
        }
        return ok(request.tool, { enabled: isSubmitGuardEnabled });
      }
      if (request.tool === 'identity_load') {
        const input = readRecord(request.input);
        const key = typeof input.key === 'string' ? input.key : '';
        const value = identities[key];
        if (!value) return error(request.tool, `missing identity ${key}`);
        return ok(request.tool, { key, value });
      }
      if (
        request.tool === 'fill' ||
        request.tool === 'select' ||
        request.tool === 'upload'
      ) {
        const input = readRecord(request.input);
        const selector =
          typeof input.selector === 'string' ? input.selector : '';
        const value =
          request.tool === 'upload'
            ? 'uploaded'
            : typeof input.value === 'string'
              ? input.value
              : '';
        if (selector && value) fieldValues.set(selector, value);
      }
      if (request.tool === 'click') {
        const input = readRecord(request.input);
        const selector =
          typeof input.selector === 'string' ? input.selector : '';
        if (isSubmitGuardEnabled) {
          // Match the production driver: only submit-intent clicks (against
          // the submit button selector) are blocked. Focus / option clicks
          // on ordinary inputs go through cleanly.
          if (/submit/i.test(selector)) {
            return error(
              request.tool,
              'submit_guard blocked a submit-intent click.',
            );
          }
        } else if (/submit/i.test(selector)) {
          // Submit guard disabled and we just clicked submit — flip the
          // fixture to its post-submit confirmation HTML so the runner's
          // waitForSubmissionConfirmation finds a thank-you page.
          submitClickSucceeded = true;
        }
      }
      return ok(request.tool, {});
    },
    listTools() {
      return [
        'navigate',
        'wait_for',
        'dom_snapshot',
        'identity_load',
        'fill',
        'select',
        'upload',
        'submit_guard',
        'click',
      ];
    },
  };
  return { calls, registry };
}

describe('runGreenhouseSubmitLead', () => {
  it('runs training mode until submit_guard blocks the submit click', async () => {
    const { calls, registry } = createRegistry();

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: 'I do not want to answer',
        gender: 'Male',
        hispanicLatino: 'No',
        linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
        race: 'White',
        referralSource: 'Gimme Job',
        salaryExpectation: '$180,000',
        sponsorshipRequired: 'no',
        state: 'CA',
        veteranStatus: 'I do not wish to answer',
        websiteUrl: 'https://stevenbennett.dev',
        workAuthorization: 'yes',
      },
      jobLeadId: 'lead-1',
      mode: 'training',
    });

    expect(result.status).toBe('blocked_by_submit_guard');
    expect(result.executionEnvironment).toBe('DESKTOP_CDP');
    expect(result.jobLeadId).toBe('lead-1');
    expect(calls.slice(0, 3).map(call => call.tool)).toEqual([
      'submit_guard',
      'navigate',
      'wait_for',
    ]);
    // The submit click is the last meaningful interaction; the runtime
    // emits one final dom_snapshot afterwards to count any remaining
    // required-empty fields for the message body.
    const submitClickIndex = calls.findIndex(
      call =>
        call.tool === 'click' &&
        typeof call.input === 'object' &&
        call.input !== null &&
        'selector' in call.input &&
        typeof (call.input as { selector?: unknown }).selector === 'string' &&
        /submit/i.test((call.input as { selector: string }).selector),
    );
    expect(submitClickIndex).toBeGreaterThan(-1);
    expect(
      calls
        .slice(submitClickIndex + 1)
        .every(call => call.tool === 'dom_snapshot'),
    ).toBe(true);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: { selector: 'select[id="country"]', value: 'US' },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'input[id="location"]',
            value: 'San Francisco, California',
          },
          tool: 'fill',
        }),
        expect.objectContaining({
          input: {
            selector: 'input[id="linkedin_profile"]',
            value: 'https://www.linkedin.com/in/stevenbennett',
          },
          tool: 'fill',
        }),
        expect.objectContaining({
          input: {
            selector: 'input[id="website"]',
            value: 'https://stevenbennett.dev',
          },
          tool: 'fill',
        }),
        expect.objectContaining({
          input: {
            selector: 'textarea[id="question_referral"]',
            value: 'Gimme Job',
          },
          tool: 'fill',
        }),
        expect.objectContaining({
          input: {
            filePath: '/tmp/resume.pdf',
            selector: 'input[id="resume_upload"]',
          },
          tool: 'upload',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_authorized"]',
            value: 'yes',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_sponsorship"]',
            value: 'no',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_location_requirement"]',
            value: 'yes',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_gender"]',
            value: 'Male',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_hispanic"]',
            value: 'No',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_race"]',
            value: 'White',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_veteran"]',
            value: 'I do not wish to answer',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'select[id="question_disability"]',
            value: 'I do not want to answer',
          },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'input[id="desired_salary"]',
            value: '$180,000',
          },
          tool: 'fill',
        }),
        expect.objectContaining({
          input: {
            selector: 'input[id="current_residence"]',
            value: 'San Francisco, California',
          },
          tool: 'fill',
        }),
      ]),
    );
    const locationFillIndex = calls.findIndex(
      call =>
        call.tool === 'fill' &&
        readRecord(call.input).selector === 'input[id="location"]',
    );
    expect(locationFillIndex).toBeGreaterThan(-1);
    expect(calls.slice(locationFillIndex + 1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: { key: 'ArrowDown' },
          tool: 'press_key',
        }),
        expect.objectContaining({
          input: { key: 'Enter' },
          tool: 'press_key',
        }),
      ]),
    );
    // The submit click is followed by a final dom_snapshot used to count
    // remaining required-empty fields for the message, so it is no longer
    // the last entry in toolCalls.
    const submitToolCall = result.toolCalls.find(
      call =>
        call.tool === 'click' &&
        typeof call.selector === 'string' &&
        /submit/i.test(call.selector),
    );
    expect(submitToolCall).toMatchObject({
      ok: false,
      tool: 'click',
    });
  });

  it('fills required preferred name fields with the first name fallback', async () => {
    const { calls, registry } = createRegistry({
      extraHtml: `
        <label for="preferred_name">Preferred Name *</label>
        <input id="preferred_name" name="preferred_name" type="text" />
      `,
    });

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: 'I do not want to answer',
        gender: 'Male',
        hispanicLatino: 'No',
        linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
        race: 'White',
        referralSource: 'Gimme Job',
        salaryExpectation: '$180,000',
        sponsorshipRequired: 'no',
        state: 'CA',
        veteranStatus: 'I do not wish to answer',
        websiteUrl: 'https://stevenbennett.dev',
        workAuthorization: 'yes',
      },
      mode: 'training',
    });

    expect(result.status).toBe('blocked_by_submit_guard');
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: {
            selector: 'input[id="preferred_name"]',
            value: 'Steven',
          },
          reason: 'fill preferred name',
          tool: 'fill',
        }),
      ]),
    );
  });

  it('fills both company-custom and federal Voluntary Self-ID EEO selects, fills race before hispanic, and uploads resume', async () => {
    const calls: DesktopToolCallRequest[] = [];
    let isSubmitGuardEnabled = true;
    const identities: Record<string, string> = {
      email: 'steven@example.com',
      first_name: 'Steven',
      last_name: 'Bennett',
      phone: '+15555550123',
      resume_pdf_path: '/tmp/resume.pdf',
    };
    const registry: DesktopToolRegistry = {
      async call(request) {
        calls.push(request);
        if (request.tool === 'dom_snapshot') {
          return ok(request.tool, {
            html: `
              <form id="application_form">
                <div class="field-wrapper"><div role="group" aria-labelledby="upload-label-resume" class="file-upload"><div id="upload-label-resume" class="label upload-label">Resume/CV</div><div class="file-upload__wrapper"><div class="button-container"><div class="secondary-button"><div><button type="button" class="btn btn--pill">Attach</button><label class="visually-hidden" for="resume">Attach</label><input id="resume" class="visually-hidden" type="file" accept=".pdf,.doc,.docx,.txt,.rtf"></div></div><div class="secondary-button"><button type="button" class="btn btn--pill" data-testid="resume-dropbox">Dropbox</button></div><div class="secondary-button"><button type="button" class="btn btn--pill">Google Drive</button></div><div class="secondary-button"><div><button type="button" class="btn btn--pill" data-testid="resume-text">Enter manually</button><label class="visually-hidden" for="resume_text">Enter manually</label></div></div></div></div></div></div>
                <div>With which gender do you most identify?</div>
                <select id="question_company_gender" name="question_company_gender"></select>
                <div>I identify my ethnicity as:</div>
                <select id="question_company_race" name="question_company_race"></select>
                <div>Disability Status</div>
                <select id="question_company_disability" name="question_company_disability"></select>
                <div>Veteran Status</div>
                <select id="question_company_veteran" name="question_company_veteran"></select>
                <h2>Voluntary Self-Identification</h2>
                <div>Gender</div>
                <select id="question_eeoc_gender" name="question_eeoc_gender"></select>
                <div>Are you Hispanic/Latino?</div>
                <select id="question_eeoc_hispanic" name="question_eeoc_hispanic"></select>
                <div>Veteran Status</div>
                <select id="question_eeoc_veteran" name="question_eeoc_veteran"></select>
                <div>Disability Status</div>
                <select id="question_eeoc_disability" name="question_eeoc_disability"></select>
              </form>
            `,
            title: 'Zeta-style Greenhouse Application',
            url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
          });
        }
        if (request.tool === 'submit_guard') {
          const input = readRecord(request.input);
          if (typeof input.enabled === 'boolean') {
            isSubmitGuardEnabled = input.enabled;
          }
          return ok(request.tool, { enabled: isSubmitGuardEnabled });
        }
        if (request.tool === 'identity_load') {
          const input = readRecord(request.input);
          const key = typeof input.key === 'string' ? input.key : '';
          const value = identities[key];
          if (!value) return error(request.tool, `missing identity ${key}`);
          return ok(request.tool, { key, value });
        }
        if (request.tool === 'click' && isSubmitGuardEnabled) {
          return error(
            request.tool,
            'submit_guard blocked a submit-intent click.',
          );
        }
        return ok(request.tool, {});
      },
      listTools() {
        return [
          'navigate',
          'wait_for',
          'dom_snapshot',
          'identity_load',
          'fill',
          'select',
          'upload',
          'submit_guard',
          'click',
        ];
      },
    };

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl:
        'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: 'I do not want to answer',
        gender: 'Male',
        hispanicLatino: 'No',
        linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
        race: 'White',
        referralSource: 'Gimme Job',
        salaryExpectation: '$180,000',
        sponsorshipRequired: 'no',
        state: 'CA',
        veteranStatus: 'I do not wish to answer',
        websiteUrl: 'https://stevenbennett.dev',
        workAuthorization: 'yes',
      },
      mode: 'training',
    });

    expect(result.status).toBe('blocked_by_submit_guard');

    const selectInputs = calls
      .filter(c => c.tool === 'select')
      .map(c => readRecord(c.input).selector);
    expect(selectInputs).toContain('select[id="question_company_gender"]');
    expect(selectInputs).toContain('select[id="question_eeoc_gender"]');
    expect(selectInputs).toContain('select[id="question_company_race"]');
    expect(selectInputs).toContain('select[id="question_company_veteran"]');
    expect(selectInputs).toContain('select[id="question_eeoc_veteran"]');
    expect(selectInputs).toContain('select[id="question_company_disability"]');
    expect(selectInputs).toContain('select[id="question_eeoc_disability"]');
    expect(selectInputs).toContain('select[id="question_eeoc_hispanic"]');

    const uploadIndex = calls.findIndex(c => c.tool === 'upload');
    expect(uploadIndex).toBeGreaterThanOrEqual(0);
    const uploadSelector = readRecord(calls[uploadIndex]?.input).selector;
    expect(typeof uploadSelector).toBe('string');
    expect(String(uploadSelector)).toMatch(/resume/i);

    // This fixture has an already-visible company race field, so the
    // runner keeps the existing race-before-hispanic order.
    const raceIndex = calls.findIndex(
      c =>
        c.tool === 'select' &&
        readRecord(c.input).selector === 'select[id="question_company_race"]',
    );
    const hispanicIndex = calls.findIndex(
      c =>
        c.tool === 'select' &&
        readRecord(c.input).selector === 'select[id="question_eeoc_hispanic"]',
    );
    expect(raceIndex).toBeGreaterThanOrEqual(0);
    expect(hispanicIndex).toBeGreaterThan(raceIndex);
  });

  it('selects hispanic first when Zeta mounts race conditionally, then fills race', async () => {
    const calls: DesktopToolCallRequest[] = [];
    let isSubmitGuardEnabled = true;
    let raceIsVisible = false;
    const identities: Record<string, string> = {
      email: 'steven@example.com',
      first_name: 'Steven',
      last_name: 'Bennett',
      phone: '+15555550123',
      resume_pdf_path: '/tmp/resume.pdf',
    };
    const registry: DesktopToolRegistry = {
      async call(request) {
        calls.push(request);
        if (request.tool === 'dom_snapshot') {
          return ok(request.tool, {
            html: zetaConditionalRaceSnapshot(raceIsVisible),
            title: 'Zeta-style Greenhouse Application',
            url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
          });
        }
        if (request.tool === 'wait_for') {
          return ok(request.tool, {
            matched: raceIsVisible,
            selector:
              'label[for="race"],input#race,[aria-labelledby="race-label"]',
            text: null,
          });
        }
        if (request.tool === 'submit_guard') {
          const input = readRecord(request.input);
          if (typeof input.enabled === 'boolean') {
            isSubmitGuardEnabled = input.enabled;
          }
          return ok(request.tool, { enabled: isSubmitGuardEnabled });
        }
        if (request.tool === 'identity_load') {
          const input = readRecord(request.input);
          const key = typeof input.key === 'string' ? input.key : '';
          const value = identities[key];
          if (!value) return error(request.tool, `missing identity ${key}`);
          return ok(request.tool, { key, value });
        }
        if (request.tool === 'select') {
          const input = readRecord(request.input);
          if (input.selector === 'input[id="hispanic"]') {
            raceIsVisible = true;
            return ok(request.tool, {});
          }
        }
        if (request.tool === 'click') {
          const selector = String(readRecord(request.input).selector ?? '');
          if (isSubmitGuardEnabled && selector.includes('submit')) {
            return error(
              request.tool,
              'submit_guard blocked a submit-intent click.',
            );
          }
        }
        return ok(request.tool, {});
      },
      listTools() {
        return [
          'navigate',
          'wait_for',
          'dom_snapshot',
          'identity_load',
          'fill',
          'select',
          'upload',
          'submit_guard',
          'click',
        ];
      },
    };

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl:
        'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: 'I do not want to answer',
        gender: 'Female',
        hispanicLatino: 'No',
        linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
        race: 'White',
        referralSource: 'Gimme Job',
        salaryExpectation: null,
        sponsorshipRequired: 'no',
        state: 'CA',
        veteranStatus: 'I do not wish to answer',
        websiteUrl: null,
        workAuthorization: 'yes',
      },
      mode: 'training',
    });

    expect(result.status).toBe('blocked_by_submit_guard');
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: { selector: 'input[id="hispanic"]', value: 'No' },
          tool: 'select',
        }),
        expect.objectContaining({
          input: {
            selector: 'input[id="race"]',
            value: 'White',
          },
          tool: 'select',
        }),
      ]),
    );

    const raceIndex = calls.findIndex(
      c =>
        c.tool === 'select' &&
        readRecord(c.input).selector === 'input[id="race"]',
    );
    const hispanicIndex = calls.findIndex(
      c =>
        c.tool === 'select' &&
        readRecord(c.input).selector === 'input[id="hispanic"]',
    );
    expect(raceIndex).toBeGreaterThanOrEqual(0);
    expect(raceIndex).toBeGreaterThan(hispanicIndex);
    expect(
      calls.filter(
        c =>
          c.tool === 'select' &&
          readRecord(c.input).selector === 'input[id="hispanic"]',
      ),
    ).toHaveLength(1);
  });

  it('disables submit_guard only in owner-approved submit mode', async () => {
    const { calls, registry } = createRegistry();

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: 'I do not want to answer',
        gender: 'Male',
        hispanicLatino: 'No',
        linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
        race: 'White',
        referralSource: 'Gimme Job',
        salaryExpectation: '$180,000',
        sponsorshipRequired: 'no',
        state: 'CA',
        veteranStatus: 'I do not wish to answer',
        websiteUrl: 'https://stevenbennett.dev',
        workAuthorization: 'yes',
      },
      mode: 'submit',
    });

    expect(result.status).toBe('completed');
    // Verify submit_guard was disabled with `enabled: false` immediately
    // before a submit-button click. Looking by position is brittle since
    // post-submit confirmation polling adds extra dom_snapshot calls after
    // the click.
    const guardDisableIndex = calls.findIndex(
      call =>
        call.tool === 'submit_guard' &&
        typeof call.input === 'object' &&
        call.input !== null &&
        'enabled' in call.input &&
        (call.input as { enabled?: unknown }).enabled === false,
    );
    expect(guardDisableIndex).toBeGreaterThan(-1);
    const followingClick = calls
      .slice(guardDisableIndex + 1)
      .find(call => call.tool === 'click');
    expect(followingClick).toBeDefined();
    expect(
      typeof followingClick?.input === 'object' &&
        followingClick?.input !== null &&
        'selector' in followingClick.input
        ? String((followingClick.input as { selector: unknown }).selector)
        : '',
    ).toMatch(/submit/i);
  });

  it('stops for manual review when Greenhouse asks for human-vs-automation disclosure', async () => {
    const calls: DesktopToolCallRequest[] = [];
    const identities: Record<string, string> = {
      email: 'steven@example.com',
      first_name: 'Steven',
      last_name: 'Bennett',
      phone: '+15555550123',
      resume_pdf_path: '/tmp/resume.pdf',
    };
    const registry: DesktopToolRegistry = {
      async call(request) {
        calls.push(request);
        if (request.tool === 'dom_snapshot') {
          return ok(request.tool, {
            html: `
              <form id="application_form">
                <label for="resume">Resume/CV</label>
                <input id="resume" type="file" />
                <label for="bot_check">Which of the following best describes you? *</label>
                <select id="bot_check" name="bot_check">
                  <option value="">Select...</option>
                  <option value="automated">I am an AI or automated program</option>
                  <option value="human">I am a human being</option>
                </select>
                <button id="submit_app" type="submit">Submit</button>
              </form>
            `,
            title: 'Greenhouse Application',
            url: 'https://job-boards.greenhouse.io/example/jobs/123',
          });
        }
        if (request.tool === 'identity_load') {
          const key = String(readRecord(request.input).key ?? '');
          const value = identities[key];
          if (!value) return error(request.tool, `missing identity ${key}`);
          return ok(request.tool, { key, value });
        }
        return ok(request.tool, {});
      },
      listTools() {
        return [
          'navigate',
          'wait_for',
          'dom_snapshot',
          'identity_load',
          'fill',
          'select',
          'upload',
          'submit_guard',
          'click',
        ];
      },
    };

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: null,
        country: null,
        disabilityStatus: null,
        gender: null,
        hispanicLatino: null,
        linkedinUrl: null,
        race: null,
        referralSource: null,
        salaryExpectation: null,
        sponsorshipRequired: null,
        state: null,
        veteranStatus: null,
        websiteUrl: null,
        workAuthorization: null,
      },
      mode: 'submit',
    });

    expect(result.status).toBe('paused_for_manual_review');
    expect(result.message).toMatch(/Manual review required/);
    expect(result.message).toMatch(/anti-bot disclosure/);
    expect(
      calls.some(
        call =>
          call.tool === 'select' &&
          readRecord(call.input).selector === 'select[id="bot_check"]',
      ),
    ).toBe(false);
    expect(
      calls.some(
        call =>
          call.tool === 'click' &&
          String(readRecord(call.input).selector ?? '').includes('submit'),
      ),
    ).toBe(false);
  });

  it('stops for manual review when a known anti-bot selector variant is present', async () => {
    const calls: DesktopToolCallRequest[] = [];
    const identities: Record<string, string> = {
      email: 'steven@example.com',
      first_name: 'Steven',
      last_name: 'Bennett',
      phone: '+15555550123',
      resume_pdf_path: '/tmp/resume.pdf',
    };
    const registry: DesktopToolRegistry = {
      async call(request) {
        calls.push(request);
        if (request.tool === 'dom_snapshot') {
          return ok(request.tool, {
            html: `
              <form id="application_form">
                <label for="resume">Resume/CV</label>
                <input id="resume" type="file" />
                <label for="human_check">Eligibility check *</label>
                <select id="human_check" name="human_check">
                  <option value="">Select...</option>
                  <option value="ok">Continue</option>
                </select>
                <button id="submit_app" type="submit">Submit</button>
              </form>
            `,
            title: 'Greenhouse Application',
            url: 'https://job-boards.greenhouse.io/example/jobs/123',
          });
        }
        if (request.tool === 'identity_load') {
          const key = String(readRecord(request.input).key ?? '');
          const value = identities[key];
          if (!value) return error(request.tool, `missing identity ${key}`);
          return ok(request.tool, { key, value });
        }
        return ok(request.tool, {});
      },
      listTools() {
        return [
          'navigate',
          'wait_for',
          'dom_snapshot',
          'identity_load',
          'fill',
          'select',
          'upload',
          'submit_guard',
          'click',
        ];
      },
    };

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: null,
        country: null,
        disabilityStatus: null,
        gender: null,
        hispanicLatino: null,
        linkedinUrl: null,
        race: null,
        referralSource: null,
        salaryExpectation: null,
        sponsorshipRequired: null,
        state: null,
        veteranStatus: null,
        websiteUrl: null,
        workAuthorization: null,
      },
      mode: 'submit',
    });

    expect(result.status).toBe('paused_for_manual_review');
    expect(result.message).toMatch(/Manual review required/);
    expect(
      calls.some(
        call =>
          call.tool === 'select' &&
          readRecord(call.input).selector === 'select[id="human_check"]',
      ),
    ).toBe(false);
  });

  it('continues training autofill past a non-ignorable optional-field failure (regression: stops after 5-6 contact fields)', async () => {
    // Simulate a real-world failure mode: one optional fill (e.g. the
    // location typeahead) returns a non-ignorable error mid-run. Before
    // the fix, the training-mode caller exited immediately on any
    // non-null optionalFieldResult — resulting in the user seeing only
    // the early identity fills then a 'failed' status. After the fix,
    // training mode should treat it as a single bad fill and continue
    // to the submit_guard click, surfacing the remaining-empty count.
    const calls: DesktopToolCallRequest[] = [];
    const fieldValues = new Map<string, string>();
    let isSubmitGuardEnabled = true;
    const identities: Record<string, string> = {
      email: 'steven@example.com',
      first_name: 'Steven',
      last_name: 'Bennett',
      phone: '+15555550123',
      resume_pdf_path: '/tmp/resume.pdf',
    };
    const failingSelector = 'input[id="location"]';
    const registry: DesktopToolRegistry = {
      async call(request) {
        calls.push(request);
        if (request.tool === 'dom_snapshot') {
          return ok(request.tool, {
            html: applyFixtureFieldValues(
              `
              <form id="application_form">
                <label for="country">Country *</label>
                <select id="country" name="country">
                  <option value="">Select...</option>
                  <option value="US">United States</option>
                </select>
                <label for="location">Location (City) *</label>
                <input id="location" name="location" type="text" />
                <label for="resume_upload">Resume/CV *</label>
                <input id="resume_upload" name="candidate_resume" type="file" />
                <button id="submit_app" type="submit">Submit</button>
              </form>
            `,
              fieldValues,
            ),
            title: 'Fixture Greenhouse Application',
            url: 'https://job-boards.greenhouse.io/example/jobs/123',
          });
        }
        if (request.tool === 'submit_guard') {
          const input = readRecord(request.input);
          if (typeof input.enabled === 'boolean') {
            isSubmitGuardEnabled = input.enabled;
          }
          return ok(request.tool, { enabled: isSubmitGuardEnabled });
        }
        if (request.tool === 'identity_load') {
          const input = readRecord(request.input);
          const key = typeof input.key === 'string' ? input.key : '';
          const value = identities[key];
          if (!value) return error(request.tool, `missing identity ${key}`);
          return ok(request.tool, { key, value });
        }
        if (request.tool === 'fill') {
          const input = readRecord(request.input);
          const selector =
            typeof input.selector === 'string' ? input.selector : '';
          // The injected non-ignorable failure: the message intentionally
          // does NOT match /not found|did not match/ so the optional-fill
          // loop's ignorable-error filter doesn't catch it.
          if (selector === failingSelector) {
            return error(request.tool, 'Frame detached during fill.');
          }
          const value =
            typeof input.value === 'string' ? input.value : '';
          if (selector && value) fieldValues.set(selector, value);
        }
        if (request.tool === 'click') {
          const input = readRecord(request.input);
          const selector =
            typeof input.selector === 'string' ? input.selector : '';
          if (isSubmitGuardEnabled && /submit/i.test(selector)) {
            return error(
              request.tool,
              'submit_guard blocked a submit-intent click.',
            );
          }
        }
        return ok(request.tool, {});
      },
      listTools() {
        return [
          'navigate',
          'wait_for',
          'dom_snapshot',
          'identity_load',
          'fill',
          'select',
          'upload',
          'submit_guard',
          'click',
        ];
      },
    };

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: null,
        gender: null,
        hispanicLatino: null,
        linkedinUrl: null,
        race: null,
        referralSource: null,
        salaryExpectation: null,
        sponsorshipRequired: null,
        state: 'CA',
        veteranStatus: null,
        websiteUrl: null,
        workAuthorization: 'yes',
      },
      mode: 'training',
    });

    // Pre-fix: the runner returned with status: 'failed' and message
    // "Frame detached during fill." after only the identity fills.
    expect(result.status).toBe('blocked_by_submit_guard');
    // The runner reached and clicked the submit button (which submit_guard
    // blocks in training mode). Without the fix, the click never happened.
    expect(
      calls.some(
        call =>
          call.tool === 'click' &&
          typeof readRecord(call.input).selector === 'string' &&
          /submit/i.test(
            readRecord(call.input).selector as string,
          ),
      ),
    ).toBe(true);
    // The failing fill was attempted (and recorded as a tool call).
    expect(
      calls.some(
        call =>
          call.tool === 'fill' &&
          readRecord(call.input).selector === failingSelector,
      ),
    ).toBe(true);
  });

  it('continues from the current page without navigating after manual review', async () => {
    const { calls, registry } = createRegistry();

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: 'San Francisco',
        country: 'United States',
        disabilityStatus: 'I do not want to answer',
        gender: 'Male',
        hispanicLatino: 'No',
        linkedinUrl: 'https://www.linkedin.com/in/stevenbennett',
        race: 'White',
        referralSource: 'Gimme Job',
        salaryExpectation: '$180,000',
        sponsorshipRequired: 'no',
        state: 'CA',
        veteranStatus: 'I do not wish to answer',
        websiteUrl: 'https://stevenbennett.dev',
        workAuthorization: 'yes',
      },
      continueFromCurrentPage: true,
      mode: 'submit',
    });

    expect(result.status).toBe('completed');
    expect(calls[0]?.tool).toBe('wait_for');
    expect(calls.some(call => call.tool === 'navigate')).toBe(false);
  });

  it('does not pause again when a manually selected custom field has a selected value', async () => {
    const calls: DesktopToolCallRequest[] = [];
    let submitClickFired = false;
    const identities: Record<string, string> = {
      email: 'steven@example.com',
      first_name: 'Steven',
      last_name: 'Bennett',
      phone: '+15555550123',
      resume_pdf_path: '/tmp/resume.pdf',
    };
    const registry: DesktopToolRegistry = {
      async call(request) {
        calls.push(request);
        if (request.tool === 'dom_snapshot') {
          if (submitClickFired) {
            return ok(request.tool, {
              html: `<main><h1>Thanks for applying!</h1></main>`,
              title: 'Application received',
              url: 'https://job-boards.greenhouse.io/example/jobs/123/applications/456',
            });
          }
          return ok(request.tool, {
            html: `
              <form id="application_form">
                <label for="resume">Resume/CV</label>
                <input id="resume" type="file" />
                <label id="expertise-label" for="primary_expertise">Which of the following best describes your primary technical expertise? *</label>
                <div class="select__control">
                  <div class="select__single-value">Full-Stack</div>
                  <input id="primary_expertise" role="combobox" aria-labelledby="expertise-label" value="" />
                </div>
                <button id="submit_app" type="submit">Submit</button>
              </form>
            `,
            title: 'Greenhouse Application',
            url: 'https://job-boards.greenhouse.io/example/jobs/123',
          });
        }
        if (request.tool === 'identity_load') {
          const key = String(readRecord(request.input).key ?? '');
          const value = identities[key];
          if (!value) return error(request.tool, `missing identity ${key}`);
          return ok(request.tool, { key, value });
        }
        if (request.tool === 'click') {
          const selector = String(readRecord(request.input).selector ?? '');
          if (/submit/i.test(selector)) submitClickFired = true;
        }
        return ok(request.tool, {});
      },
      listTools() {
        return [
          'navigate',
          'wait_for',
          'dom_snapshot',
          'identity_load',
          'fill',
          'select',
          'upload',
          'submit_guard',
          'click',
        ];
      },
    };

    const result = await runGreenhouseSubmitLead(registry, {
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      applicantProfile: {
        city: null,
        country: null,
        disabilityStatus: null,
        gender: null,
        hispanicLatino: null,
        linkedinUrl: null,
        race: null,
        referralSource: null,
        salaryExpectation: null,
        sponsorshipRequired: null,
        state: null,
        veteranStatus: null,
        websiteUrl: null,
        workAuthorization: null,
      },
      continueFromCurrentPage: true,
      mode: 'submit',
    });

    expect(result.status).toBe('completed');
    expect(
      calls.some(
        call =>
          call.tool === 'select' &&
          readRecord(call.input).selector === 'input[id="primary_expertise"]',
      ),
    ).toBe(false);
  });
});

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function applyFixtureFieldValues(
  html: string,
  values: ReadonlyMap<string, string>,
): string {
  const root = parse(html);
  for (const [selector, value] of values) {
    const node = root.querySelector(selector);
    if (!node) continue;
    node.setAttribute('value', value);
  }
  return root.toString();
}

function ok(tool: DesktopToolName, data: unknown): DesktopToolCallResult {
  return { data, ok: true, tool };
}

function error(tool: DesktopToolName, message: string): DesktopToolCallResult {
  return {
    error: { code: 'TEST_ERROR', message },
    ok: false,
    tool,
  };
}

function zetaConditionalRaceSnapshot(includeRace: boolean): string {
  return `
    <form id="application_form">
      <label for="resume">Resume/CV</label>
      <input id="resume" type="file" />
      <label id="gender-label" for="gender">With which gender do you most identify?</label>
      <div class="select__control">
        <input id="gender" type="text" role="combobox" aria-labelledby="gender-label" />
      </div>
      <label id="hispanic-label" for="hispanic">Are you Hispanic/Latino?</label>
      <div class="select__control">
        <input id="hispanic" type="text" role="combobox" aria-labelledby="hispanic-label" />
      </div>
      ${
        includeRace
          ? `
            <div class="select">
              <div class="select__container">
                <label id="race-label" for="race" class="label select__label">Please identify your race</label>
                <div class="select-shell remix-css-b62m3t-container">
                  <div class="select__control">
                    <input class="select__input" id="race" type="text" role="combobox" aria-labelledby="race-label" aria-haspopup="true" aria-expanded="false" aria-autocomplete="list" autocomplete="off" tabindex="0" value="" />
                  </div>
                </div>
              </div>
            </div>
          `
          : ''
      }
      <label id="veteran-label" for="veteran">Veteran Status</label>
      <div class="select__control">
        <input id="veteran" type="text" role="combobox" aria-labelledby="veteran-label" />
      </div>
      <label id="disability-label" for="disability">Disability Status</label>
      <div class="select__control">
        <input id="disability" type="text" role="combobox" aria-labelledby="disability-label" />
      </div>
    </form>
  `;
}
