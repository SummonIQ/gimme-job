import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLeads } from '@/lib/api/endpoints/leads';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Added', value: 'ADDED' },
  { label: 'Analyzing', value: 'ANALYZING,OPTIMIZING' },
  { label: 'Ready', value: 'OPTIMIZED' },
  { label: 'Applied', value: 'APPLIED' },
  { label: 'Interview', value: 'INTERVIEW_SCHEDULED,INTERVIEW_COMPLETED' },
  { label: 'Failed', value: 'ANALYSIS_FAILED,OPTIMIZATION_FAILED' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ADDED: { bg: '#f1f5f9', text: '#334155' },
  ANALYZING: { bg: '#fef3c7', text: '#b45309' },
  OPTIMIZING: { bg: '#fef3c7', text: '#b45309' },
  OPTIMIZED: { bg: '#dcfce7', text: '#15803d' },
  APPLIED: { bg: '#dbeafe', text: '#1d4ed8' },
  INTERVIEW_SCHEDULED: { bg: '#ede9fe', text: '#7c3aed' },
  INTERVIEW_COMPLETED: { bg: '#ede9fe', text: '#7c3aed' },
  ANALYSIS_FAILED: { bg: '#fee2e2', text: '#b91c1c' },
  OPTIMIZATION_FAILED: { bg: '#fee2e2', text: '#b91c1c' },
  OFFER: { bg: '#d1fae5', text: '#047857' },
  REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#64748b' };
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function LeadsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', activeFilter],
    queryFn: () => getLeads({ status: activeFilter || undefined, pageSize: 100 }),
  });

  const leads = data?.data ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.filterHeader}>
        <Text style={styles.headerTitle}>Leads Pipeline</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_FILTERS.map((filter) => (
            <Pressable
              key={filter.value}
              onPress={() => setActiveFilter(filter.value)}
              style={[
                styles.filterChip,
                activeFilter === filter.value
                  ? styles.filterChipActive
                  : styles.filterChipInactive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter.value
                    ? styles.filterChipTextActive
                    : styles.filterChipTextInactive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={leads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        renderItem={({ item }) => {
          const statusStyle = getStatusStyle(item.status);
          return (
            <Pressable
              onPress={() => router.push(`/(tabs)/leads/${item.id}`)}
              style={({ pressed }) => [
                styles.leadCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.leadCardHeader}>
                <View style={styles.leadCardInfo}>
                  <Text style={styles.leadTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.jobListing?.company && (
                    <Text style={styles.leadCompany}>
                      {item.jobListing.company}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusStyle.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusStyle.text },
                    ]}
                  >
                    {formatStatus(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.leadMeta}>
                {item.jobFitAnalysis?.overallMatchScore != null && (
                  <Text style={styles.matchScore}>
                    {Math.round(item.jobFitAnalysis.overallMatchScore)}% match
                  </Text>
                )}
                {item.jobListing?.location && (
                  <Text style={styles.leadMetaText}>
                    📍 {item.jobListing.location}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No leads yet</Text>
              <Text style={styles.emptySubtitle}>
                Add jobs to your pipeline from the Jobs tab
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  filterHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#4338ca',
  },
  filterChipInactive: {
    backgroundColor: '#f1f5f9',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  filterChipTextInactive: {
    color: '#64748b',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  leadCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pressed: {
    opacity: 0.9,
  },
  leadCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  leadCardInfo: {
    flex: 1,
    paddingRight: 12,
  },
  leadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  leadCompany: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  leadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  matchScore: {
    fontSize: 12,
    color: '#4338ca',
    fontWeight: '500',
  },
  leadMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#64748b',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
});
