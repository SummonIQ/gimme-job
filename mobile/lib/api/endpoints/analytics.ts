import { api } from '@/lib/api/client';

interface AnalyticsData {
  totalJobSearches: number;
  totalJobListings: number;
  totalJobLeads: number;
  totalApplications: number;
  totalInterviews: number;
  totalOffers: number;
}

export function getAnalytics(): Promise<AnalyticsData> {
  return api.get('/api/analytics');
}

interface ApplicationAnalytics {
  total: number;
  pending: number;
  interviewing: number;
  offered: number;
  rejected: number;
}

export function getApplicationAnalytics(): Promise<ApplicationAnalytics> {
  return api.get('/api/analytics/applications');
}
