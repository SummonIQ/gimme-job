import { chromium } from 'playwright';

async function validateTableAlignment() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:10060/login');
  await page.fill('input[type="email"]', 'bright-and-early@outlook.com');
  await page.fill('input[type="password"]', '12341234');
  await page.click('button[type="submit"]');
  
  // Wait for redirect after login
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Navigate to saved jobs
  await page.goto('http://localhost:10060/jobs/saved');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot of the table headers
  await page.screenshot({ path: '.applab/screenshots/table-alignment-test.png', fullPage: false });
  
  console.log('Screenshot saved to .applab/screenshots/table-alignment-test.png');
  console.log('Please verify the alignment visually.');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(5000);
  
  await browser.close();
}

validateTableAlignment().catch(console.error);
