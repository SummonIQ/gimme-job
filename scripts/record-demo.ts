/**
 * Demo Video Recording Script
 *
 * Records a walkthrough of the Gimme Job app for the landing page demo section.
 *
 * Usage:
 *   bun scripts/record-demo.ts
 *
 * Prerequisites:
 *   - Dev server running on localhost:10100
 *   - Playwright installed: bun add -D @playwright/test
 *   - Run: bunx playwright install chromium
 */

import { chromium, type Page } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:10100';
const OUTPUT_PATH = './public/videos/demo.webm';

async function recordDemo() {
  console.log('🎬 Starting demo recording...');
  console.log(`📍 Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50, // Slow down actions slightly for smoother video
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: './public/videos/',
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  try {
    // ========================================
    // Scene 1: Landing Page
    // ========================================
    console.log('📹 Scene 1: Landing page...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await wait(1500);

    // Scroll down slowly to show features
    await smoothScroll(page, 500);
    await smoothScroll(page, 500);

    // ========================================
    // Scene 2: Login
    // ========================================
    console.log('📹 Scene 2: Login...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');
    await wait(800);

    // Fill login form
    await page
      .locator('input[name="emailAddress"]')
      .fill('bright-and-early@outlook.com');
    await wait(200);
    await page.locator('input[name="password"]').fill('12341234');
    await wait(200);

    // Click submit
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(dashboard|jobs|overview)/, { timeout: 15000 });
    await wait(800);

    // ========================================
    // Scene 3: Jobs Search Page
    // ========================================
    console.log('📹 Scene 3: Jobs search...');
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('domcontentloaded');
    await wait(1500);

    // Wait for the page to fully load
    await page
      .waitForSelector('[role="article"], .divide-y', { timeout: 5000 })
      .catch(() => {
        console.log('   No job cards found, continuing...');
      });
    await wait(800);

    // ========================================
    // Scene 4: Browse Results
    // ========================================
    console.log('📹 Scene 4: Browse job results...');

    // Scroll through results in the results panel
    const resultsPanel = page.locator('.overflow-y-auto').last();
    if (await resultsPanel.isVisible()) {
      await resultsPanel.evaluate(el => {
        el.scrollBy({ top: 300, behavior: 'smooth' });
      });
      await wait(800);
    }

    // Click on a job card if visible
    const jobCard = page.locator('[role="article"]').first();
    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.hover();
      await wait(300);
      await jobCard.click();
      await wait(1200);

      // Go back or close modal
      await page.goBack().catch(() => {});
      await wait(500);
    }

    // ========================================
    // Scene 5: Interact with Filters
    // ========================================
    console.log('📹 Scene 5: Filters...');
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('domcontentloaded');
    await wait(800);

    // Try clicking Remote Only checkbox
    const remoteCheckbox = page
      .locator('label:has-text("Remote Only"), text=Remote Only')
      .first();
    if (await remoteCheckbox.isVisible().catch(() => false)) {
      await remoteCheckbox.click();
      await wait(1000);
    }

    // ========================================
    // Scene 6: Resumes Page
    // ========================================
    console.log('📹 Scene 6: Resumes page...');
    await page.goto(`${BASE_URL}/resumes`);
    await page.waitForLoadState('domcontentloaded');
    await wait(1200);

    // Scroll to show content
    await smoothScroll(page, 300);

    // ========================================
    // Scene 7: Final shot - back to landing
    // ========================================
    console.log('📹 Scene 7: Final shot...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await wait(1500);

    console.log('✅ Recording complete!');
  } catch (error) {
    console.error('❌ Error during recording:', error);
  } finally {
    // Close page to save video
    await page.close();

    // Get the video path
    const video = page.video();
    if (video) {
      const path = await video.path();
      console.log(`📁 Video saved to: ${path}`);

      // Rename to desired output path
      const fs = await import('fs');
      const outputDir = './public/videos';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.renameSync(path, OUTPUT_PATH);
      console.log(`📁 Video moved to: ${OUTPUT_PATH}`);
    }

    await context.close();
    await browser.close();
  }
}

// Helper: Wait for specified milliseconds
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Smooth scroll animation
async function smoothScroll(page: Page, distance: number) {
  await page.evaluate(d => {
    window.scrollBy({ top: d, behavior: 'smooth' });
  }, distance);
  await wait(600);
}

// Run the script
recordDemo().catch(console.error);
