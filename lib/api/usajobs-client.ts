'use server';

const USAJOBS_API_BASE = 'https://data.usajobs.gov/api/search';

export interface USAJobsSearchParams {
  keyword?: string;
  locationName?: string;
  remote?: boolean;
  datePosted?: number;
  resultsPerPage?: number;
  page?: number;
  positionScheduleTypeCode?: number;
}

export interface USAJobsRemuneration {
  MinimumRange: string;
  MaximumRange: string;
  RateIntervalCode: string;
  Description: string;
}

export interface USAJobsPositionLocation {
  LocationName: string;
  CountryCode: string;
  CountrySubDivisionCode: string;
  CityName: string;
  Longitude: number;
  Latitude: number;
}

export interface USAJobsUserAreaDetails {
  MajorDuties?: string;
  Education?: string;
  Requirements?: string;
  Evaluations?: string;
  HowToApply?: string;
  WhatToExpectNext?: string;
  RequiredDocuments?: string;
  Benefits?: string;
  BenefitsUrl?: string;
  OtherInformation?: string;
  KeyRequirements?: string[];
  JobSummary?: string;
  WhoMayApply?: { Name: string; Code: string };
  LowGrade?: string;
  HighGrade?: string;
  SubAgencyName?: string;
  OrganizationCodes?: string;
}

export interface USAJobsMatchedObject {
  PositionID: string;
  PositionTitle: string;
  PositionURI: string;
  ApplyURI: string[];
  PositionLocationDisplay: string;
  PositionLocation: USAJobsPositionLocation[];
  OrganizationName: string;
  DepartmentName: string;
  JobCategory: { Name: string; Code: string }[];
  JobGrade: { Code: string }[];
  PositionSchedule: { Name: string; Code: string }[];
  PositionOfferingType: { Name: string; Code: string }[];
  QualificationSummary: string;
  PositionRemuneration: USAJobsRemuneration[];
  PositionStartDate: string;
  PositionEndDate: string;
  PublicationStartDate: string;
  ApplicationCloseDate: string;
  PositionFormattedDescription: { Label: string; LabelDescription: string }[];
  UserArea: {
    Details: USAJobsUserAreaDetails;
    IsRadialSearch: boolean;
  };
}

export interface USAJobsSearchResultItem {
  MatchedObjectId: string;
  MatchedObjectDescriptor: USAJobsMatchedObject;
  RelevanceRank: number;
}

export interface USAJobsSearchResponse {
  SearchResult: {
    SearchResultCount: number;
    SearchResultCountAll: number;
    SearchResultItems: USAJobsSearchResultItem[];
    UserArea: {
      NumberOfPages: number;
      IsRadialSearch: boolean;
    };
  };
}

const getApiKey = (): string => {
  const apiKey = process.env.USAJOBS_API_KEY;
  if (!apiKey) {
    throw new Error('USAJOBS_API_KEY is not set');
  }
  return apiKey;
};

const getEmail = (): string => {
  const email = process.env.USAJOBS_EMAIL;
  if (!email) {
    throw new Error('USAJOBS_EMAIL is not set');
  }
  return email;
};

const buildSearchUrl = (params: USAJobsSearchParams): string => {
  const url = new URL(USAJOBS_API_BASE);

  if (params.keyword?.trim()) {
    url.searchParams.set('Keyword', params.keyword.trim());
  }

  if (params.locationName?.trim()) {
    url.searchParams.set('LocationName', params.locationName.trim());
  }

  if (params.remote === true) {
    url.searchParams.set('RemoteIndicator', 'True');
  }

  if (
    typeof params.datePosted === 'number' &&
    params.datePosted > 0 &&
    params.datePosted <= 60
  ) {
    url.searchParams.set('DatePosted', String(params.datePosted));
  }

  if (
    typeof params.positionScheduleTypeCode === 'number' &&
    params.positionScheduleTypeCode >= 1 &&
    params.positionScheduleTypeCode <= 6
  ) {
    url.searchParams.set(
      'PositionScheduleTypeCode',
      String(params.positionScheduleTypeCode),
    );
  }

  url.searchParams.set(
    'ResultsPerPage',
    String(params.resultsPerPage ?? 25),
  );
  url.searchParams.set('Page', String(params.page ?? 1));
  url.searchParams.set('Fields', 'Full');
  url.searchParams.set('WhoMayApply', 'public');

  return url.toString();
};

export async function searchUSAJobs(
  params: USAJobsSearchParams,
): Promise<USAJobsSearchResponse> {
  const apiKey = getApiKey();
  const email = getEmail();
  const url = buildSearchUrl(params);

  console.log('[USAJobs] Searching jobs:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Host: 'data.usajobs.gov',
      'User-Agent': email,
      'Authorization-Key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[USAJobs] API error:', response.status, error);
    throw new Error(
      `USAJobs search failed: ${response.status} - ${error}`,
    );
  }

  const data: USAJobsSearchResponse = await response.json();

  console.log(
    `[USAJobs] Found ${data.SearchResult.SearchResultCount} jobs (total: ${data.SearchResult.SearchResultCountAll})`,
  );

  return data;
}
