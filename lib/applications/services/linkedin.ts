import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SubmissionParams, SubmissionResult } from './index';

// Add stealth plugin to puppeteer to avoid detection
puppeteer.use(StealthPlugin());

// Constants for LinkedIn application process
const LINKEDIN_TIMEOUT = 30000; // 30 seconds
const LINKEDIN_NAVIGATION_TIMEOUT = 60000; // 60 seconds
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Submit a job application to LinkedIn
 */
export async function submitApplication(params: SubmissionParams): Promise<SubmissionResult> {
  const { jobId, jobUrl, resumeData, coverLetterData, customFields } = params;
  
  if (!jobUrl) {
    return {
      success: false,
      error: 'Job URL is required for LinkedIn submissions',
    };
  }

  let browser: Browser | null = null;
  
  try {
    // Launch browser with stealth plugin
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(LINKEDIN_TIMEOUT);
    page.setDefaultNavigationTimeout(LINKEDIN_NAVIGATION_TIMEOUT);

    // Check if we have LinkedIn credentials in customFields
    const credentials = customFields?.linkedinCredentials;
    if (credentials?.email && credentials?.password) {
      await loginToLinkedIn(page, credentials.email, credentials.password);
    } else {
      return {
        success: false,
        error: 'LinkedIn credentials not provided',
      };
    }

    // Navigate to job listing
    await page.goto(jobUrl, { waitUntil: 'networkidle2' });

    // Check if already applied
    const alreadyAppliedIndicator = await page.$('[data-test-applied-indicator]');
    if (alreadyAppliedIndicator) {
      return {
        success: false,
        error: 'Already applied to this job',
      };
    }

    // Find and click the "Apply" or "Easy Apply" button
    const applyButtonSelector = 'button[data-control-name="apply_button"]';
    await waitAndClick(page, applyButtonSelector);

    // Wait for the application form to load
    await page.waitForSelector('.jobs-easy-apply-content', { visible: true });

    // Fill application form (exact selectors may need adjustment based on LinkedIn's current implementation)
    // This is a generic implementation that will need to be adapted as LinkedIn changes their UI
    
    // Loop through the application steps
    let isLastStep = false;
    let currentStep = 1;
    let hasUploaded = false;
    
    while (!isLastStep && currentStep <= 10) { // Limit to 10 steps to prevent infinite loop
      // Wait for form to load
      await page.waitForTimeout(1000);
      
      // Check if we need to upload resume (only do this once)
      if (!hasUploaded && resumeData) {
        const resumeUploadSelector = 'input[type="file"][name="resume"]';
        const resumeUploadElement = await page.$(resumeUploadSelector);
        
        if (resumeUploadElement) {
          // Convert Buffer to string if needed
          const resumeContent = typeof resumeData === 'string' ? resumeData : resumeData.toString('utf-8');
          
          // Create a temporary file and upload it
          await page.evaluate((content) => {
            const blob = new Blob([content], { type: 'application/pdf' });
            const file = new File([blob], 'resume.pdf', { type: 'application/pdf' });
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const fileInput = document.querySelector('input[type="file"][name="resume"]');
            if (fileInput) {
              (fileInput as any).files = dataTransfer.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, resumeContent);
          
          hasUploaded = true;
        }
      }
      
      // Check for common form fields and fill them
      await fillCommonFormFields(page, customFields || {});
      
      // Look for the Next/Submit button
      const nextButtonSelector = '.artdeco-button--primary';
      const nextButtonText = await page.evaluate((selector) => {
        const button = document.querySelector(selector);
        return button ? button.textContent?.trim() : null;
      }, nextButtonSelector);
      
      // Check if this is the last step
      isLastStep = nextButtonText === 'Submit application' || 
                  nextButtonText === 'Review' || 
                  nextButtonText?.includes('Submit');
      
      // Click the Next/Submit button
      await waitAndClick(page, nextButtonSelector);
      
      // If we're on the review step, find and click the final submit button
      if (isLastStep) {
        await page.waitForTimeout(1000);
        const finalSubmitSelector = '.artdeco-modal__confirm-dialog-btn';
        await waitAndClick(page, finalSubmitSelector);
      }
      
      currentStep++;
    }
    
    // Wait for confirmation screen
    await page.waitForSelector('.artdeco-inline-feedback--success', { timeout: LINKEDIN_TIMEOUT });
    
    // Extract confirmation details if available
    const confirmationDetails = await page.evaluate(() => {
      const element = document.querySelector('.artdeco-inline-feedback--success');
      return element ? element.textContent?.trim() : null;
    });
    
    // Close browser
    await browser.close();
    browser = null;
    
    return {
      success: true,
      confirmationCode: `LinkedIn-${Date.now()}`,
      metadata: {
        confirmation: confirmationDetails,
        completedSteps: currentStep - 1,
      }
    };
    
  } catch (error) {
    console.error('LinkedIn submission error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during LinkedIn submission',
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Login to LinkedIn
 */
async function loginToLinkedIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
  
  // Type email
  await page.type('#username', email);
  
  // Type password
  await page.type('#password', password);
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Check for login success
  const isLoggedIn = await page.evaluate(() => {
    return !document.querySelector('.login__form');
  });
  
  if (!isLoggedIn) {
    throw new Error('LinkedIn login failed. Please check credentials.');
  }
}

/**
 * Helper to wait for a selector and click it
 */
async function waitAndClick(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
}

/**
 * Fill common form fields based on provided custom fields
 */
async function fillCommonFormFields(page: Page, customFields: Record<string, any>): Promise<void> {
  // Common form field mapping
  const fieldMappings: Record<string, string> = {
    phone: 'input[name="phone"]',
    email: 'input[name="email"]',
    firstName: 'input[name="first-name"]',
    lastName: 'input[name="last-name"]',
    linkedin: 'input[name="linkedin-profile-url"]',
    website: 'input[name="website"]',
  };
  
  // Fill fields if they exist on the page
  for (const [field, selector] of Object.entries(fieldMappings)) {
    const value = customFields[field];
    if (value) {
      const elementExists = await page.$(selector);
      if (elementExists) {
        await page.type(selector, value.toString());
      }
    }
  }
  
  // Handle dropdown selects for common questions
  const dropdowns = await page.$$('select');
  for (const dropdown of dropdowns) {
    // Try to determine what this dropdown is for
    const labelText = await page.evaluate((el) => {
      // Try to find associated label
      const id = el.id;
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      return label ? label.textContent?.toLowerCase().trim() : null;
    }, dropdown);
    
    if (labelText) {
      // Handle common dropdown types
      if (labelText.includes('experience') && customFields.yearsOfExperience) {
        await page.select(`#${await dropdown.evaluate(el => el.id)}`, customFields.yearsOfExperience.toString());
      } else if (labelText.includes('education') && customFields.education) {
        await page.select(`#${await dropdown.evaluate(el => el.id)}`, customFields.education);
      }
    }
  }
  
  // Handle yes/no radio buttons for common questions
  await handleCommonRadioButtons(page, customFields);
}

/**
 * Handle common radio button questions
 */
async function handleCommonRadioButtons(page: Page, customFields: Record<string, any>): Promise<void> {
  // Common yes/no questions
  const commonQuestions = [
    { keyword: 'authorized', field: 'workAuthorization' },
    { keyword: 'sponsor', field: 'requireSponsorship' },
    { keyword: 'remote', field: 'willingToWorkRemote' },
    { keyword: 'relocate', field: 'willingToRelocate' },
  ];
  
  // Find all radio button groups
  const radioGroups = await page.$$('fieldset');
  
  for (const group of radioGroups) {
    // Get the question text
    const questionText = await page.evaluate((el) => {
      const legend = el.querySelector('legend');
      return legend ? legend.textContent?.toLowerCase().trim() : null;
    }, group);
    
    if (questionText) {
      // Match question with our common questions
      for (const { keyword, field } of commonQuestions) {
        if (questionText.includes(keyword) && customFields[field] !== undefined) {
          // Determine which radio button to select (Yes or No)
          const value = customFields[field] === true ? 'Yes' : 'No';
          
          // Click the appropriate radio button
          await page.evaluate((groupElement, desiredValue) => {
            const radioButtons = groupElement.querySelectorAll('input[type="radio"]');
            for (const button of radioButtons) {
              const label = button.closest('label');
              if (label && label.textContent?.includes(desiredValue)) {
                button.click();
                return;
              }
            }
          }, group, value);
        }
      }
    }
  }
}
