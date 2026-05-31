'use server';

import { logApplicationEvent } from '@/lib/applications/logging';
import { db } from '@/lib/db/client';
import { ResumeData } from '@/lib/resumes';
import { getCurrentUser } from '@/lib/user/query';
import { ApplicationStatus } from '@/generated/prisma/browser';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

interface IndeedSubmissionOptions {
  jobLeadId: string;
  resumeId: string;
  coverLetterId?: string;
  additionalInfo?: Record<string, string>;
}

/**
 * Submit application to Indeed job
 */
export async function submitIndeedApplication({
  jobLeadId,
  resumeId,
  coverLetterId,
  additionalInfo,
}: IndeedSubmissionOptions): Promise<{
  success: boolean;
  message: string;
  applicationId?: string;
}> {
  // Get current user
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get job lead details
  const jobLead = await db.jobLead.findUnique({
    where: { id: jobLeadId, userId: user.id },
    include: { jobListing: true },
  });

  if (!jobLead) {
    throw new Error('Job lead not found');
  }

  // Get resume
  const resume = await db.resume.findUnique({
    where: { id: resumeId, userId: user.id },
    include: {
      revisions: true,
    },
  });

  if (!resume) {
    throw new Error('Resume not found');
  }

  // Get cover letter if provided
  let coverLetter = null;
  if (coverLetterId) {
    coverLetter = await db.coverLetter.findUnique({
      where: { id: coverLetterId, userId: user.id },
    });

    if (!coverLetter) {
      throw new Error('Cover letter not found');
    }
  }

  // Get Indeed apply URL
  const applyUrl =
    jobLead.jobListing?.externalUrl ||
    jobLead.url ||
    (jobLead.jobListing?.applyOptions as any)?.applyUrl;

  if (!applyUrl || !applyUrl.includes('indeed.com')) {
    throw new Error('No valid Indeed application URL found');
  }

  // Create application record
  const application = await db.applicationSubmission.create({
    data: {
      userId: user.id,
      jobLeadId: jobLead.id,
      resumeId: resume.id,
      coverLetterId: coverLetter?.id,
      status: ApplicationStatus.PENDING,
      provider: 'INDEED',
      appliedAt: new Date(),
    },
  });

  await logApplicationEvent({
    applicationId: application.id,
    eventType: 'SUBMISSION_STARTED',
    details: { provider: 'INDEED', jobTitle: jobLead.title },
  });

  let browser: Browser | null = null;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // Go to apply URL
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    const resumeRevision = user.defaultRevisionId
      ? resume.revisions?.find(
          revision => revision.id === user.defaultRevisionId,
        )
      : null;
    const resumeData = resumeRevision?.data as unknown as ResumeData;

    // Download resume PDF to temp file if URL available
    let resumePdfPath: string | undefined;
    const resumePdfUrl = user.defaultRevisionId
      ? resumeRevision?.pdfDocumentUrl || resume.url
      : resume.url;
    if (resumePdfUrl) {
      try {
        const { writeFile } = await import('fs/promises');
        const { tmpdir } = await import('os');
        const { join } = await import('path');

        const response = await fetch(resumePdfUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          resumePdfPath = join(tmpdir(), `resume-${Date.now()}.pdf`);
          await writeFile(resumePdfPath, buffer);
        }
      } catch (error) {
        console.error('Failed to download resume PDF:', error);
      }
    }

    // Handle the Indeed application form
    await handleIndeedApplicationForm(
      page,
      resumeData,
      resumePdfPath,
      coverLetter?.markdown,
      additionalInfo,
    );

    // Update application status
    await db.applicationSubmission.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.SUBMITTED,
        completedAt: new Date(),
      },
    });

    await logApplicationEvent({
      applicationId: application.id,
      eventType: 'SUBMISSION_COMPLETED',
      details: { provider: 'INDEED', jobTitle: jobLead.title },
    });

    return {
      success: true,
      message: 'Application submitted successfully',
      applicationId: application.id,
    };
  } catch (error) {
    console.error('Indeed application submission error:', error);

    // Update application status
    await db.applicationSubmission.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.FAILED,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during submission',
      },
    });

    await logApplicationEvent({
      applicationId: application.id,
      eventType: 'SUBMISSION_FAILED',
      details: {
        provider: 'INDEED',
        jobTitle: jobLead.title,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during submission',
      },
    });

    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to submit application',
      applicationId: application.id,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Handle the Indeed application form filling
 */
async function handleIndeedApplicationForm(
  page: Page,
  resumeData: ResumeData,
  resumePdfPath?: string,
  coverLetterContent?: string,
  additionalInfo?: Record<string, string>,
): Promise<void> {
  // Check if we're on an Indeed apply page
  const isIndeedApplyPage = await page.evaluate(() => {
    return (
      window.location.href.includes('indeed.com') &&
      (document.querySelector('form') !== null ||
        document.querySelector('[data-gnav-element-name="DisplayApply"]') !==
          null)
    );
  });

  if (!isIndeedApplyPage) {
    throw new Error('Not on Indeed apply page');
  }

  // Check if "Apply Now" button exists and click it
  const applyButtonExists = await page.evaluate(() => {
    const applyButton = Array.from(document.querySelectorAll('button')).find(
      button =>
        button.textContent?.trim().toLowerCase().includes('apply') ||
        button.textContent?.trim().toLowerCase().includes('continue'),
    );

    if (applyButton) {
      applyButton.click();
      return true;
    }
    return false;
  });

  if (applyButtonExists) {
    await page.waitForTimeout(2000);
  }

  // Fill in personal information
  await fillPersonalInfo(page, resumeData);

  // Upload resume if upload field exists
  await handleResumeUpload(page, resumeData, resumePdfPath);

  // Fill cover letter if field exists
  if (coverLetterContent) {
    await fillCoverLetter(page, coverLetterContent);
  }

  // Handle additional fields like screening questions
  await handleScreeningQuestions(page, additionalInfo);

  // Click submit application button
  await submitApplication(page);
}

/**
 * Fill personal information fields
 */
async function fillPersonalInfo(
  page: Page,
  resumeData: ResumeData,
): Promise<void> {
  await page.evaluate(data => {
    // Helper function to find and fill input fields
    const fillField = (selectors: string[], value: string) => {
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
          ) {
            if (!element.value) {
              element.value = value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
      }
      return false;
    };

    // Fill name fields
    fillField(
      [
        'input[name*="first"][name*="name"]',
        'input[placeholder*="First"]',
        'input[id*="first_name"]',
      ],
      data.basics?.name?.split(' ')[0] || '',
    );

    fillField(
      [
        'input[name*="last"][name*="name"]',
        'input[placeholder*="Last"]',
        'input[id*="last_name"]',
      ],
      data.basics?.name?.split(' ').slice(1).join(' ') || '',
    );

    // Fill email
    fillField(
      ['input[name*="email"]', 'input[type="email"]', 'input[id*="email"]'],
      data.basics?.email || '',
    );

    // Fill phone
    fillField(
      ['input[name*="phone"]', 'input[type="tel"]', 'input[id*="phone"]'],
      data.basics?.phone || '',
    );

    // Fill location fields
    if (data.basics?.location) {
      fillField(
        ['input[name*="city"]', 'input[id*="city"]'],
        data.basics.location.city || '',
      );

      fillField(
        ['input[name*="state"]', 'input[id*="state"]', 'select[id*="state"]'],
        data.basics.location.region || '',
      );

      fillField(
        ['input[name*="zip"]', 'input[name*="postal"]', 'input[id*="zip"]'],
        data.basics.location.postalCode || '',
      );
    }
  }, resumeData);
}

/**
 * Handle resume upload
 */
async function handleResumeUpload(
  page: Page,
  resumeData: ResumeData,
  resumePdfPath?: string,
): Promise<boolean> {
  // Find file input elements
  const fileInputSelector = await page.evaluate(() => {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
      const acceptAttr = input.getAttribute('accept') || '';
      const nameAttr = input.getAttribute('name')?.toLowerCase() || '';
      const idAttr = input.getAttribute('id')?.toLowerCase() || '';

      // Check if it's likely a resume upload field
      if (
        acceptAttr.includes('pdf') ||
        acceptAttr.includes('doc') ||
        nameAttr.includes('resume') ||
        idAttr.includes('resume') ||
        nameAttr.includes('cv') ||
        idAttr.includes('cv')
      ) {
        return (
          `input[type="file"][name="${input.getAttribute('name')}"]` ||
          `input[type="file"][id="${input.getAttribute('id')}"]` ||
          'input[type="file"]'
        );
      }
    }
    // Fallback to first file input
    return fileInputs.length > 0 ? 'input[type="file"]' : null;
  });

  if (!fileInputSelector) {
    console.log('No file upload field detected');
    return false;
  }

  if (!resumePdfPath) {
    console.log('Resume upload field detected but no PDF path provided');
    return false;
  }

  try {
    const fileInput = await page.$(fileInputSelector);
    if (fileInput) {
      await (fileInput as any).uploadFile(resumePdfPath);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Resume uploaded successfully');
      return true;
    }
  } catch (error) {
    console.error('Failed to upload resume:', error);
  }

  return false;
}

/**
 * Fill cover letter field
 */
async function fillCoverLetter(
  page: Page,
  coverLetterContent: string,
): Promise<void> {
  await page.evaluate(content => {
    const coverLetterFields = [
      'textarea[name*="cover"]',
      'textarea[placeholder*="cover"]',
      'textarea[id*="cover"]',
      'div[role="textbox"]',
      'div[contenteditable="true"]',
    ];

    for (const selector of coverLetterFields) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element instanceof HTMLTextAreaElement) {
          element.value = content;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        } else if (
          element instanceof HTMLElement &&
          element.getAttribute('contenteditable') === 'true'
        ) {
          element.innerHTML = content;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, coverLetterContent);
}

/**
 * Handle screening questions
 */
async function handleScreeningQuestions(
  page: Page,
  additionalInfo?: Record<string, string>,
): Promise<void> {
  // Check if there are screening questions
  const hasScreeningQuestions = await page.evaluate(() => {
    // Look for common question patterns
    const questionLabels = document.querySelectorAll(
      'label, div.question, h3:not(:empty)',
    );
    return Array.from(questionLabels).some(label => {
      const text = label.textContent?.toLowerCase() || '';
      return (
        text.includes('question') ||
        text.includes('experience') ||
        text.includes('years') ||
        text.includes('salary') ||
        text.includes('willing to') ||
        text.includes('requirements')
      );
    });
  });

  if (hasScreeningQuestions && additionalInfo) {
    // Handle screening questions based on additionalInfo
    await page.evaluate(info => {
      // This is a simplified approach - in a real implementation
      // we would need more sophisticated matching logic
      Object.entries(info).forEach(([key, value]) => {
        // Try to find matching questions
        const questionElements = Array.from(
          document.querySelectorAll('label, div.question, h3:not(:empty)'),
        );

        for (const question of questionElements) {
          const questionText = question.textContent?.toLowerCase() || '';
          const keyLower = key.toLowerCase();

          if (
            questionText.includes(keyLower) ||
            keyLower.includes(questionText)
          ) {
            // Find the input field associated with this question
            let input = null;

            // Try to find input by label association
            if (question instanceof HTMLLabelElement && question.htmlFor) {
              input = document.getElementById(question.htmlFor);
            }

            // If not found, look for nearby inputs
            if (!input) {
              const parent = question.parentElement;
              if (parent) {
                input = parent.querySelector('input, textarea, select');
              }
            }

            // If input found, fill it
            if (input) {
              if (
                input instanceof HTMLInputElement ||
                input instanceof HTMLTextAreaElement
              ) {
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              } else if (input instanceof HTMLSelectElement) {
                // Try to find matching option
                const option = Array.from(input.options).find(opt =>
                  opt.text.toLowerCase().includes(value.toLowerCase()),
                );

                if (option) {
                  input.value = option.value;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            }
          }
        }
      });
    }, additionalInfo);
  }
}

/**
 * Submit the application
 */
async function submitApplication(page: Page): Promise<void> {
  // Find and click the submit button
  const submitted = await page.evaluate(() => {
    // Look for submit/apply buttons
    const buttonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:not([disabled])',
    ];

    // Try each selector
    for (const selector of buttonSelectors) {
      const buttons = Array.from(document.querySelectorAll(selector));

      // Filter for likely submit buttons
      const submitButtons = buttons.filter(button => {
        const text = button.textContent?.toLowerCase() || '';
        return (
          text.includes('submit') ||
          text.includes('apply') ||
          text.includes('continue') ||
          text.includes('next')
        );
      });

      // Click the first matching button
      if (submitButtons.length > 0) {
        submitButtons[0].click();
        return true;
      }
    }

    return false;
  });

  if (!submitted) {
    throw new Error('Could not find submit button');
  }

  // Wait for submission to complete (look for success message or next page)
  await page.waitForTimeout(5000);

  // Check if submission was successful
  const isSubmissionSuccessful = await page.evaluate(() => {
    const successPatterns = [
      'application submitted',
      'thank you for applying',
      'application received',
      'successfully applied',
    ];

    // Check page content for success messages
    const pageContent = document.body.textContent?.toLowerCase() || '';
    return successPatterns.some(pattern => pageContent.includes(pattern));
  });

  if (!isSubmissionSuccessful) {
    console.warn('Could not confirm if application was successfully submitted');
    // We don't throw an error here as sometimes success messages vary widely
  }
}
