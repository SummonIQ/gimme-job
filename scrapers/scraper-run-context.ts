interface ScraperRunContextMetadata {
  [key: string]: unknown;
}

export interface ScraperRunContext {
  searchId?: string;
  searchTerm: string;
  location?: string;
  remote?: boolean;
  userId: string;
  jobSearchId?: string;
  maxResults?: number;
  requestedAt?: Date;
  metadata?: ScraperRunContextMetadata;
}
