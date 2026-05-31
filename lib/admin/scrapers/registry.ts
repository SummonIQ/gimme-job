import { type ATSType, BaseScraper } from '@/lib/admin/scrapers/base';

type ScraperConstructor = new () => BaseScraper;

export class UnknownAtsScraperError extends Error {
  readonly ats: string;

  constructor(ats: string) {
    super(`No scraper registered for ATS: ${ats}`);
    this.name = 'UnknownAtsScraperError';
    this.ats = ats;
  }
}

const scraperConstructors = new Map<ATSType, ScraperConstructor>();

export class ScraperRegistry {
  static register(ats: ATSType) {
    return <T extends ScraperConstructor>(ScraperClass: T): T => {
      scraperConstructors.set(ats, ScraperClass);
      return ScraperClass;
    };
  }

  static get(ats: ATSType): BaseScraper {
    const ScraperClass = scraperConstructors.get(ats);
    if (!ScraperClass) {
      throw new UnknownAtsScraperError(ats);
    }

    return new ScraperClass();
  }
}
