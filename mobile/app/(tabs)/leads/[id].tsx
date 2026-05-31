import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getLead,
  reoptimizeLead,
  updateLeadStatus,
} from '@/lib/api/endpoints/leads';

const STATUS_ACTIONS: Record<
  string,
  Array<{ label: string; status: string; color: string }>
> = {
  ANALYSIS_FAILED: [],
  APPLIED: [
    {
      label: 'Schedule Interview',
      status: 'INTERVIEW_SCHEDULED',
      color: '#8b5cf6',
    },
    { label: 'Rejected', status: 'REJECTED', color: '#ef4444' },
  ],
  INTERVIEW_COMPLETED: [
    { label: 'Got Offer', status: 'OFFER', color: '#059669' },
    {
      label: 'Not Selected',
      status: 'INTERVIEWED_NOT_SELECTED',
      color: '#ef4444',
    },
  ],
  INTERVIEW_SCHEDULED: [
    {
      label: 'Interview Done',
      status: 'INTERVIEW_COMPLETED',
      color: '#8b5cf6',
    },
  ],
  OPTIMIZATION_FAILED: [],
  OPTIMIZED: [{ label: 'Mark Applied', status: 'APPLIED', color: '#3b82f6' }],
};

const LeadDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leadId = Array.isArray(id) ? id[0] : id;
  const [activeTab, setActiveTab] = useState<'analysis' | 'optimization'>(
    'analysis',
  );
  const queryClient = useQueryClient();

  const {
    data: lead,
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => getLead(leadId as string),
    enabled: Boolean(leadId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateLeadStatus(leadId as string, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => reoptimizeLead(leadId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      Alert.alert('Retry Started', 'Analysis has been queued for retry.');
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4338ca" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>
          {error instanceof Error ? error.message : 'Unable to load lead'}
        </Text>
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Lead not found</Text>
      </View>
    );
  }

  const listing = lead.jobListing as Record<string, unknown> | null;
  const analysis = lead.jobFitAnalysis as Record<string, unknown> | null;
  const optimization = lead.optimization as Record<string, unknown> | null;
  const revisions = Array.isArray(lead.resumeRevisions)
    ? (lead.resumeRevisions as Array<Record<string, unknown>>)
    : [];
  const latestRevisionWithMarkdown = revisions.find(
    revision =>
      typeof revision.markdown === 'string' &&
      revision.markdown.trim().length > 0,
  );
  const actions = STATUS_ACTIONS[lead.status] ?? [];
  const isFailed =
    lead.status === 'ANALYSIS_FAILED' || lead.status === 'OPTIMIZATION_FAILED';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
    >
      <View style={styles.card}>
        <Text style={styles.leadTitle}>{lead.title}</Text>
        {Boolean(listing?.company) && (
          <Text style={styles.leadCompany}>{String(listing?.company)}</Text>
        )}
        {Boolean(listing?.location) && (
          <Text style={styles.locationText}>
            📍 {String(listing?.location)}
          </Text>
        )}
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setActiveTab('analysis')}
          style={[
            styles.tabButton,
            activeTab === 'analysis'
              ? styles.tabButtonActive
              : styles.tabButtonInactive,
          ]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'analysis'
                ? styles.tabButtonTextActive
                : styles.tabButtonTextInactive,
            ]}
          >
            Analysis
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('optimization')}
          style={[
            styles.tabButton,
            activeTab === 'optimization'
              ? styles.tabButtonActive
              : styles.tabButtonInactive,
          ]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'optimization'
                ? styles.tabButtonTextActive
                : styles.tabButtonTextInactive,
            ]}
          >
            Optimizations
          </Text>
        </Pressable>
      </View>

      {activeTab === 'analysis' && (
        <>
          {analysis ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Job Fit Analysis</Text>
              {(analysis.overallMatchScore as number | null) != null && (
                <View style={styles.matchRow}>
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchBadgeText}>
                      {Math.round(analysis.overallMatchScore as number)}%
                    </Text>
                  </View>
                  <Text style={styles.matchLabel}>Overall Match</Text>
                </View>
              )}
              {Boolean(analysis.summary) && (
                <Text style={styles.summaryText}>
                  {String(analysis.summary)}
                </Text>
              )}
              {Array.isArray(analysis.recommendations) &&
                (analysis.recommendations as string[]).length > 0 && (
                  <View style={styles.recommendationsSection}>
                    <Text style={styles.recommendationsTitle}>
                      Recommendations
                    </Text>
                    {(analysis.recommendations as string[]).map(
                      (recommendation, index) => (
                        <Text
                          key={`recommendation-${index}`}
                          style={styles.recommendationItem}
                        >
                          • {recommendation}
                        </Text>
                      ),
                    )}
                  </View>
                )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptySubtext}>
                No analysis available yet.
              </Text>
            </View>
          )}
        </>
      )}

      {activeTab === 'optimization' && (
        <>
          {optimization && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Optimization</Text>
              <Text style={styles.statusText}>
                Status: {String(optimization.status ?? 'Unknown')}
              </Text>
              {typeof optimization.progress === 'number' && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(optimization.progress, 100)}%` },
                    ]}
                  />
                </View>
              )}
            </View>
          )}

          {latestRevisionWithMarkdown && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Optimized Resume</Text>
              <Text style={{ fontSize: 14, color: '#0f172a', lineHeight: 20 }}>
                {latestRevisionWithMarkdown.markdown as string}
              </Text>
            </View>
          )}

          {revisions.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Resume Revisions</Text>
              {revisions.map((revision, index) => (
                <View
                  key={String(revision.id)}
                  style={[
                    styles.revisionItem,
                    index < revisions.length - 1 && styles.revisionItemBorder,
                  ]}
                >
                  <Text style={styles.revisionName}>
                    {String(revision.name ?? 'Untitled')}
                  </Text>
                  <Text style={styles.revisionDate}>
                    Created{' '}
                    {new Date(String(revision.createdAt)).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {isFailed && (
        <Pressable
          disabled={retryMutation.isPending}
          onPress={() => retryMutation.mutate()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          {retryMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.retryButtonText}>Retry Analysis</Text>
          )}
        </Pressable>
      )}

      {actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {actions.map(action => (
            <Pressable
              key={action.status}
              disabled={statusMutation.isPending}
              onPress={() => statusMutation.mutate(action.status)}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: action.color },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.actionButtonText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  leadTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  leadCompany: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#4338ca',
  },
  tabButtonInactive: {
    backgroundColor: '#e2e8f0',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  tabButtonTextInactive: {
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  matchBadge: {
    backgroundColor: 'rgba(67, 56, 202, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4338ca',
  },
  matchLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  recommendationsSection: {
    marginTop: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  recommendationItem: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#64748b',
  },
  progressTrack: {
    marginTop: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    height: 8,
  },
  progressFill: {
    backgroundColor: '#4338ca',
    borderRadius: 4,
    height: 8,
  },
  revisionItem: {
    paddingVertical: 8,
  },
  revisionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  revisionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  revisionDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  retryButton: {
    backgroundColor: '#4338ca',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
});

export default LeadDetailScreen;
