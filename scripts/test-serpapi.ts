/**
 * SerpAPI Diagnostic Script
 *
 * Tests both engine:"google_jobs" and engine:"google" to compare results.
 * Usage: bun scripts/test-serpapi.ts
 */

import 'dotenv/config';
import { getJson } from 'serpapi';

const SERP_API_KEY = process.env.SERP_API_SECRET;

if (!SERP_API_KEY) {
  console.error('❌ SERP_API_SECRET is not defined in environment variables');
  process.exit(1);
}

async function testGoogleJobsViaGetJson() {
  console.log('\n' + '='.repeat(80));
  console.log(
    'TEST 1: engine:"google_jobs" via getJson with dynamic location (FIXED APP)',
  );
  console.log('='.repeat(80));

  try {
    const params = {
      engine: 'google_jobs',
      api_key: SERP_API_KEY!,
      q: 'software engineer',
      location: 'Portland, Oregon',
      google_domain: 'google.com',
      hl: 'en',
    };
    console.log('Params:', { ...params, api_key: 'REDACTED' });

    const data = await getJson(params);

    console.log('\nTop-level keys:', Object.keys(data));
    console.log(
      `jobs_results count: ${data.jobs_results?.length ?? 'MISSING'}`,
    );
    console.log(
      `Has next_page_token: ${!!data.serpapi_pagination?.next_page_token}`,
    );

    if (data.jobs_results?.length > 0) {
      console.log('\nFirst 5 jobs:');
      for (const job of data.jobs_results.slice(0, 5)) {
        console.log(`  - ${job.title} at ${job.company_name}`);
        console.log(`    Location: ${job.location}`);
        console.log(`    Via: ${job.via}`);
        if (job.detected_extensions?.salary) {
          console.log(`    Salary: ${job.detected_extensions.salary}`);
        }
      }
    }

    if (data.error) {
      console.log(`\n❌ ERROR: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ getJson threw:', error);
  }
}

async function testGoogleEngine() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: engine:"google" via getJson (what our app now uses)');
  console.log('='.repeat(80));

  try {
    const params = {
      engine: 'google',
      api_key: SERP_API_KEY!,
      q: 'software engineer',
      location: 'Portland, OR, United States',
      google_domain: 'google.com',
      gl: 'us',
      hl: 'en',
      num: '100',
    };
    console.log('Params:', { ...params, api_key: 'REDACTED' });

    const data = await getJson(params);

    console.log('\nTop-level keys:', Object.keys(data));
    console.log('search_metadata:', data.search_metadata);
    console.log('search_parameters:', data.search_parameters);
    console.log('search_information:', data.search_information);

    // Check organic_results
    const organicResults = data.organic_results;
    console.log(
      `\norganic_results count: ${organicResults?.length ?? 'MISSING'}`,
    );
    if (organicResults && organicResults.length > 0) {
      console.log('\nFirst 3 organic results:');
      for (const r of organicResults.slice(0, 3)) {
        console.log(`  - title: ${r.title}`);
        console.log(`    link: ${r.link}`);
        console.log(`    snippet: ${r.snippet?.slice(0, 120)}...`);
        console.log(`    source: ${r.source}`);
        console.log(`    displayed_link: ${r.displayed_link}`);
        console.log('');
      }
    }

    // Check for jobs_results (in case Google returns them as part of the response)
    if (data.jobs_results) {
      console.log(`\njobs_results count: ${data.jobs_results.length}`);
      console.log(
        'First job:',
        JSON.stringify(data.jobs_results[0], null, 2).slice(0, 500),
      );
    }

    // Check for any other result types
    for (const key of Object.keys(data)) {
      if (
        key.includes('result') ||
        key.includes('jobs') ||
        key.includes('answer')
      ) {
        const val = data[key];
        if (Array.isArray(val)) {
          console.log(`\n${key}: ${val.length} items`);
        } else if (val && typeof val === 'object') {
          console.log(
            `\n${key}: object with keys ${Object.keys(val).join(', ')}`,
          );
        }
      }
    }

    // Check if there's an error field
    if (data.error) {
      console.log(`\n❌ ERROR: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ getJson threw:', error);
  }
}

async function testGoogleJobsEngine() {
  console.log('\n' + '='.repeat(80));
  console.log(
    'TEST 2: engine:"google_jobs" via raw fetch (what the app used before)',
  );
  console.log('='.repeat(80));

  try {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: 'software engineer',
      api_key: SERP_API_KEY!,
      location: 'Portland, Oregon',
      google_domain: 'google.com',
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    console.log('URL:', url.replace(SERP_API_KEY!, 'REDACTED'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('\nTop-level keys:', Object.keys(data));
    console.log(
      `jobs_results count: ${data.jobs_results?.length ?? 'MISSING'}`,
    );
    console.log(
      `Has next_page_token: ${!!data.serpapi_pagination?.next_page_token}`,
    );

    if (data.jobs_results?.length > 0) {
      console.log('\nFirst 3 jobs:');
      for (const job of data.jobs_results.slice(0, 3)) {
        console.log(`  - ${job.title} at ${job.company_name}`);
        console.log(`    Location: ${job.location}`);
      }
    }

    if (data.error) {
      console.log(`\n❌ ERROR: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Fetch threw:', error);
  }
}

async function testGoogleEngineViaFetch() {
  console.log('\n' + '='.repeat(80));
  console.log(
    'TEST 3: engine:"google" via raw fetch (to rule out serpapi package issues)',
  );
  console.log('='.repeat(80));

  try {
    const params = new URLSearchParams({
      engine: 'google',
      q: 'software engineer',
      api_key: SERP_API_KEY!,
      location: 'Portland, OR, United States',
      google_domain: 'google.com',
      gl: 'us',
      hl: 'en',
      num: '100',
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    console.log('URL:', url.replace(SERP_API_KEY!, 'REDACTED'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('\nTop-level keys:', Object.keys(data));
    console.log(
      `organic_results count: ${data.organic_results?.length ?? 'MISSING'}`,
    );
    console.log(
      `jobs_results count: ${data.jobs_results?.length ?? 'MISSING'}`,
    );

    if (data.organic_results?.length > 0) {
      console.log('\nFirst 3 organic results:');
      for (const r of data.organic_results.slice(0, 3)) {
        console.log(`  - ${r.title}`);
        console.log(`    ${r.link}`);
      }
    }

    // Log all array-type keys and their counts
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val)) {
        console.log(`${key}: ${val.length} items`);
      }
    }

    if (data.error) {
      console.log(`\n❌ ERROR: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Fetch threw:', error);
  }
}

async function main() {
  console.log('🚀 SerpAPI Diagnostic Script');
  console.log(
    `API Key: ${SERP_API_KEY?.slice(0, 8)}...${SERP_API_KEY?.slice(-4)}`,
  );

  await testGoogleJobsViaGetJson();
  await new Promise(r => setTimeout(r, 500));
  await testGoogleJobsEngine();
  await new Promise(r => setTimeout(r, 500));
  await testGoogleEngineViaFetch();

  console.log('\n' + '='.repeat(80));
  console.log('✨ Done!');
}

main().catch(console.error);
