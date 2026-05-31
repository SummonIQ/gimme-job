# SerpAPI Alternatives for Job Discovery

Goal: list credible alternatives to SerpAPI that can retrieve a high volume of recent, legitimate job opportunities. Sources are grouped by how they acquire data so you can combine them for maximum coverage.
Pricing/limits below are pulled from public docs/metadata where available and can change; verify with each provider before integrating.

## Overview Strategy (Highest Coverage + Legitimacy)
1. Use job-aggregator APIs for breadth and recency (Adzuna, Jooble, etc.).
2. Supplement with ATS job board endpoints for highest legitimacy and freshness (Greenhouse, Lever, etc.).
3. Use SERP APIs only if you need Google Jobs-like coverage and can comply with ToS.

## Provider Tables

### API / Data Providers (Paid / Partner / Free)

| Provider | Category | Access / Pricing | Limits / Delays | Coverage / Strengths | Usage / Compliance Notes | Links / Endpoints |
| --- | --- | --- | --- | --- | --- | --- |
| Adzuna API | Aggregator | Not public; request key/quota via portal | Not public | Strong multi-country coverage; consistent schema; active postings | Some results syndicated; commercial terms | https://developer.adzuna.com |
| Jooble API | Aggregator | Partnership-based; approval required; docs protected by bot mitigation | Not public | Large global coverage; straightforward search API | Access may require partnership approval | https://jooble.org/api |
| Careerjet API | Aggregator | Partner/affiliate access; API key via basic auth | Not public | Broad international coverage | Affiliate-style access; quality varies by region | https://www.careerjet.com/partners/api/ |
| JSearch (RapidAPI) | Aggregator | Free 200/mo; Pro $25 (10k/mo); Ultra $75 (50k/mo); Mega $150 (200k/mo) | 5/10/20 req/sec by tier; multi-page billed 2x (2-10 pages) or 3x (10+); batch job IDs count as 1 request each | Aggregates multiple sources into a single API | Verify data provenance and upstream ToS | https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch/ |
| The Muse API | Aggregator | No public pricing; API key optional | 500 req/hr (no key); 3,600 req/hr (with key); rate limit headers provided | Curated postings and company profiles | Smaller coverage than global aggregators | https://www.themuse.com/developers/api/v2 |
| Coresignal Jobs API | Data provider | Starter $49/mo; Pro $800/mo; Premium $1,500+; credit-based; 14-day free trial | Credit-based usage; ranges vary by plan | Multi-source dataset with enrichment; good for backfill and analytics | Check plan credit ranges and ToS before bulk pulls | https://coresignal.com/solutions/jobs-data-api/ |
| jobdata API | Data provider | $445/$695/$875/$1,490 per month; no monthly usage caps | 10 req/s (20 req/s Ultra+); max 2 parallel; ~10 req/hr without key | Aggregates ATS/HR sources; direct apply links; claims no third-party job-site sourcing | Terms prohibit using data to create a competing API service | https://jobdataapi.com/ |
| Techmap Jobs API (Jobdatafeeds) | Data provider | $1 per 1,000 job postings; 1,000 jobs free | Limits not public | Global postings; JSON/CSV/RSS/ATOM/XML/Parquet; last-3-months dataset | Pay-per-job model; verify dataset window and ToS | https://jobdatafeeds.com/job-api |
| Greenhouse Job Board API | ATS | Public endpoint; no pricing | Undocumented; throttle and cache | Direct company postings (high legitimacy) | Subject to ATS/employer ToS; best with curated company list or company-discovery pipeline | https://boards-api.greenhouse.io/v1/boards/{company}/jobs |
| Lever Jobs API | ATS | Public endpoint; no pricing | Undocumented; throttle and cache | Direct company postings (high legitimacy) | Subject to ATS/employer ToS; best with curated company list or company-discovery pipeline | https://api.lever.co/v0/postings/{company} |
| Workable Jobs API | ATS | Public endpoint; no pricing | Undocumented; throttle and cache | Direct company postings (high legitimacy) | Subject to ATS/employer ToS; best with curated company list or company-discovery pipeline | https://apply.workable.com/api/v3/accounts/{company}/jobs |
| SmartRecruiters Job Board API | ATS | Public endpoint; no pricing | Undocumented; throttle and cache | Direct company postings (high legitimacy) | Subject to ATS/employer ToS; best with curated company list or company-discovery pipeline | https://api.smartrecruiters.com/v1/companies/{company}/postings |
| Ashby Job Board API | ATS | Public endpoint; no pricing | Undocumented; throttle and cache | Direct company postings (high legitimacy) | Subject to ATS/employer ToS; best with curated company list or company-discovery pipeline | https://jobs.ashbyhq.com/{company}/api/nonjson (varies; some are JSON) |
| DataForSEO SERP API | SERP | Pay-as-you-go; custom quotes available | Varies by endpoint | Google Jobs-like coverage via SERP | ToS risk with Google/upstream; expect anti-bot defenses, rate limits, and schema changes | https://dataforseo.com/solutions/serp-api |
| Zenserp | SERP | Free 50/mo; $49.99/5k; $129.99/20k; $249.99/50k; $499.99/120k; $699.99/250k; $1,399/750k; $1,599/1M | Advises max 400 concurrent; invalid requests not counted | Google Jobs-like coverage via SERP | ToS risk with Google/upstream; expect anti-bot defenses, rate limits, and schema changes | https://zenserp.com |
| Serper.dev | SERP | From $0.30 per 1,000 queries | Not public | Google Jobs-like coverage via SERP | Homepage pricing only; ToS risk with Google/upstream; expect anti-bot defenses, rate limits, and schema changes | https://serper.dev |
| Oxylabs SERP API | SERP | From $1.6 per 1,000 results; free trial | Not public | Google Jobs-like coverage via SERP | ToS risk with Google/upstream; expect anti-bot defenses, rate limits, and schema changes | https://oxylabs.io/products/scraper-api/serp |
| Bright Data SERP API | SERP | Free trial; billed for successful requests only | Not public | Google Jobs-like coverage via SERP | ToS risk with Google/upstream; expect anti-bot defenses, rate limits, and schema changes | https://brightdata.com/products/serp-api |
| USAJOBS API | Niche (Government) | Free; API key required | Search Jobs API: 10,000 rows/query; 500 rows/page; Code List and Dynamic Search have no limits | U.S. federal jobs; highly legit and structured | N/A | https://developer.usajobs.gov |
| We Work Remotely READ API + RSS | Niche (Remote) | Token required for API; posting pricing separate; RSS public | 1,000 req/day per authenticated user; RSS TTL 60 | Remote-first roles | Read API governed by Terms & Guidelines; RSS page requests attribution | https://weworkremotely.com/api<br>https://weworkremotely.com/remote-jobs.rss<br>https://weworkremotely.com/remote-job-rss-feed |
| Jobicy API/RSS | Niche (Remote) | Free public API and RSS | Docs request polling no more than once per hour and a few times per day; postings delayed ~6 hours | Remote jobs; mostly Americas (USA, Canada, LATAM) and Europe/EMEA | Do not redistribute to external job platforms (Google Jobs, LinkedIn, Jooble); API supports count up to 100 and geo/industry/tag filters; RSS supports job_categories/job_types/search_region/search_keywords | https://jobicy.com/jobs-rss-feed<br>https://jobicy.com/api/v2/remote-jobs<br>https://jobicy.com/feed/job_feed |
| JobsCollider API/RSS | Niche (Remote) | Free | Listings appear one day after posting | Remote job listings with category feeds | Must link/credit JobsCollider; do not submit to third-party job boards (LinkedIn/Google Jobs) | https://jobscollider.com/remote-jobs-api<br>https://jobscollider.com/remote-jobs.rss |
| Jobspresso RSS | Niche (Remote) | Free | Not published | Curated remote listings | RSS-only access; follow site ToS | https://jobspresso.co/feed/ |
| Real Work From Anywhere RSS | Niche (Remote) | Free | Not published | Remote work-from-anywhere listings | Category feeds at /remote-<category>-jobs/rss.xml | https://www.realworkfromanywhere.com/rss-feeds<br>https://www.realworkfromanywhere.com/rss.xml |
| Himalayas API | Niche (Remote) | Free | 20 jobs/request; rate limit enforced (429 on exceed) | Remote roles | Must link back; cannot re-post to third-party job boards (Google Jobs, LinkedIn, Jooble) | https://himalayas.app/api |
| Arbeitnow Job Board API | Niche (Remote) | Free | 100 jobs/page; updated hourly | Germany/Europe-heavy listings | Link back requested; no abuse; use created_at for freshness | https://www.arbeitnow.com/api/job-board-api |
| Remotive API | Niche (Remote) | Public API; private from $5k/mo | Public API delayed 24h; docs advise max ~4 polls/day | Remote-first roles; smaller but clean dataset | Attribution required; strict usage terms | https://remotive.com/api/remote-jobs |
| Remote OK API | Niche (Remote) | Public API | Not published | Remote roles; requires careful dedupe/quality checks | Do-follow link + attribution required; access may be suspended | https://remoteok.com/api |

### Scrape-Only / No Public API or RSS Found

| Provider | Entry Points | Evidence of No API/RSS | Scrape Tips (Success Factors) | Notes / Compliance |
| --- | --- | --- | --- | --- |
| Remote.co | https://remote.co/remote-jobs | /remote-jobs/feed returned 404 | Start from listing pages; follow job detail pages for canonical URLs; dedupe by job URL + company + title; cache and throttle requests; consider headless rendering if content is JS-rendered | Check robots.txt and ToS; consider partnership if scraping is restricted |
| Working Nomads | https://www.workingnomads.com | /jobs.rss and /rss returned 404 | Parse job cards and follow detail pages; handle pagination; dedupe by job URL + title + company; cache and rate-limit; handle occasional HTML changes with resilient selectors | Check robots.txt and ToS; consider partnership if scraping is restricted |
| NoDesk | https://nodesk.co/remote-jobs | /jobs/rss returned 404 | Extract from listing pages; follow detail pages for canonical URLs; throttle and cache; keep selectors resilient to layout changes | Check robots.txt and ToS; consider partnership if scraping is restricted |

## Recommended Data Quality Checks
- Validate posting age with `postedAt` or `dateCreated` fields; discard stale entries.
- De-dupe by normalized `(company, title, location, sourceJobId)` keys.
- Verify legitimacy by confirming a canonical application URL and company domain.
- Track source confidence so you can favor ATS/direct sources in ranking.

## Practical Recommendation
For maximum legitimate coverage with fresh data, start with:
1) Adzuna + Jooble (broad coverage)
2) ATS endpoints for target companies (highest legitimacy)
3) A SERP API only if you need Google Jobs breadth and accept ToS risk
