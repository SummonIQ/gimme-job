export interface SerpApiJobSearchResultsResponse {
  error?: string;
  jobs_results: Array<SerpApiJobResult>;
  search_metadata: SerpApiSearchMetadata;
  serpapi_pagination: SerpApiPagination;
}

export interface SerpApiPagination {
  next_page_token: string;
}

export interface SerpApiSearchMetadata {
  created_at: string;
  google_jobs_url: string;
  id: string;
  json_endpoint: string;
  processed_at: string;
  raw_html_file: string;
  status: 'Success' | 'Processing' | 'Queued' | 'Error';
  total_time_taken: number;
}

export interface SerpApiJobApplyOption {
  link: string;
  title: string;
}

export interface SerpApiJobDetectedExtensions {
  dental_coverage?: boolean;
  health_insurance?: boolean;
  no_degree_mentioned?: boolean;
  paid_time_off?: boolean;
  posted_at?: string;
  qualifications?: string;
  salary?: string;
  schedule_type?: string;
  work_from_home?: boolean;
}

export interface SerpApiJobHighlight {
  items: string[];
  title: string;
}

export interface SerpApiJobResult {
  apply_options: Array<SerpApiJobApplyOption>;
  company_name: string;
  description: string;
  detected_extensions: SerpApiJobDetectedExtensions;
  extensions: Array<string>;
  job_highlights?: Array<SerpApiJobHighlight>;
  job_id: string;
  location: string;
  share_link: string;
  thumbnail?: string;
  title: string;
  via: string;
}

// Google Search engine ("engine": "google") response types
export interface SerpApiGoogleOrganicResult {
  position: number;
  title: string;
  link: string;
  redirect_link?: string;
  displayed_link?: string;
  thumbnail?: string;
  favicon?: string;
  snippet?: string;
  snippet_highlighted_words?: string[];
  source?: string;
  date?: string;
  rich_snippet?: {
    top?: {
      extensions?: string[];
      detected_extensions?: Record<string, any>;
    };
    bottom?: {
      extensions?: string[];
      detected_extensions?: Record<string, any>;
    };
  };
}

export interface SerpApiGoogleSearchResponse {
  error?: string;
  organic_results?: SerpApiGoogleOrganicResult[];
  search_information?: {
    total_results?: number;
    time_taken_displayed?: number;
    organic_results_state?: string;
  };
  search_metadata?: {
    id: string;
    status: string;
    created_at: string;
    processed_at: string;
    total_time_taken: number;
  };
  serpapi_pagination?: {
    next_link?: string;
    next?: string;
    current?: number;
  };
}
