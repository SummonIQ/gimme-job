import type { ScraperRunContext } from './scraper-run-context';
import type { ScrapedJob } from './scraped-job';

export interface JobScraper {
  id: string;
  displayName: string;
  supports?: (params: { context: ScraperRunContext }) => boolean;
  run(params: { context: ScraperRunContext }): AsyncIterable<ScrapedJob>;
}
