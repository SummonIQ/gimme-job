import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getResume } from '@/lib/api/endpoints/resumes';

const ResumeDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resumeId = Array.isArray(id) ? id[0] : id;
  const [activeTab, setActiveTab] = useState<'analysis' | 'optimization'>(
    'analysis',
  );

  const { data: resume, isLoading, refetch } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => getResume(resumeId as string),
    enabled: Boolean(resumeId),
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4338ca" />
      </View>
    );
  }

  if (!resume) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Resume not found</Text>
      </View>
    );
  }

  const analysis = resume.analysis as Record<string, unknown> | null;
  const revisions = resume.revisions ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
    >
      <View style={styles.card}>
        <Text style={styles.resumeTitle}>{resume.name ?? 'Untitled Resume'}</Text>
        <Text style={styles.resumeDate}>
          Updated {new Date(resume.updatedAt).toLocaleDateString()}
        </Text>
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
              <Text style={styles.sectionTitle}>Analysis</Text>
              <View style={styles.scoresContainer}>
                {[
                  { label: 'Overall', key: 'overallScore' },
                  { label: 'ATS', key: 'atsScore' },
                  { label: 'Keywords', key: 'keywordScore' },
                  { label: 'Formatting', key: 'formattingScore' },
                  { label: 'Grammar', key: 'grammarScore' },
                  { label: 'Readability', key: 'readabilityScore' },
                ].map(({ label, key }) => {
                  const value = analysis[key] as number | null;
                  if (value == null) return null;
                  return (
                    <View key={key} style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>{label}</Text>
                      <View style={styles.scoreBarContainer}>
                        <View style={styles.scoreBarTrack}>
                          <View
                            style={[
                              styles.scoreBarFill,
                              { width: `${Math.min(value, 100)}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.scoreValue}>{Math.round(value)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptySubtext}>No analysis available yet.</Text>
            </View>
          )}
        </>
      )}

      {activeTab === 'optimization' && (
        <>
          {resume.markdown ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Current Resume</Text>
              <Text style={{ fontSize: 14, color: '#0f172a', lineHeight: 20 }}>{resume.markdown}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptySubtext}>No resume markdown available yet.</Text>
            </View>
          )}

          {revisions.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Revisions ({revisions.length})
              </Text>
              {revisions.map((revision, index) => (
                <View
                  key={revision.id}
                  style={[
                    styles.revisionItem,
                    index < revisions.length - 1 && styles.revisionItemBorder,
                  ]}
                >
                  <Text style={styles.revisionName}>{revision.name ?? 'Untitled'}</Text>
                  {revision.optimization && (
                    <View style={styles.revisionScores}>
                      {revision.optimization.score != null && (
                        <Text style={styles.revisionAts}>
                          ATS: {Math.round(revision.optimization.score)}%
                        </Text>
                      )}
                      {revision.optimization.scoreImprovement != null && (
                        <Text style={styles.revisionImprovement}>
                          +{Math.round(revision.optimization.scoreImprovement)}%
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.revisionDate}>
                    {new Date(revision.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
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
  resumeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  resumeDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
  scoresContainer: {
    gap: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#0f172a',
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBarTrack: {
    width: 96,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    height: 8,
  },
  scoreBarFill: {
    backgroundColor: '#4338ca',
    borderRadius: 4,
    height: 8,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    width: 40,
    textAlign: 'right',
  },
  revisionItem: {
    paddingVertical: 12,
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
  revisionScores: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  revisionAts: {
    fontSize: 12,
    color: '#4338ca',
  },
  revisionImprovement: {
    fontSize: 12,
    color: '#16a34a',
  },
  revisionDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});

export default ResumeDetailScreen;
