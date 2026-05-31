import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJobs } from '@/lib/api/endpoints/jobs';
import type { JobListing } from '@/lib/api/endpoints/jobs';

const PAGE_SIZE = 20;

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  FULL_TIME_AND_PART_TIME: 'Full/Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  UNKNOWN: '',
};

const SORT_OPTIONS = [
  { label: 'Most Recent', value: 'recent' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'By Company', value: 'company' },
  { label: 'By Title', value: 'title' },
];

const POSTED_WITHIN_OPTIONS = [
  { label: 'Any time', value: 'any' },
  { label: 'Past 24h', value: '1' },
  { label: 'Past 3 days', value: '3' },
  { label: 'Past week', value: '7' },
  { label: 'Past 2 weeks', value: '14' },
  { label: 'Past month', value: '30' },
];

function formatJobType(raw: string | null): string {
  if (!raw) return '';
  return JOB_TYPE_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer.current);
  }, [value, delay]);
  return debounced;
}

function formatTimeAgo(date: string | null): string {
  if (!date) return '';
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

function getTimeColor(date: string | null): string {
  if (!date) return '#94a3b8';
  const hours = (Date.now() - new Date(date).getTime()) / 3600000;
  if (hours < 24) return '#22c55e';
  if (hours < 72) return '#f59e0b';
  if (hours < 168) return '#f97316';
  return '#94a3b8';
}

function JobCard({ item, onPress }: { item: JobListing; onPress: () => void }) {
  const timeAgo = formatTimeAgo(item.postedAt || item.createdAt);
  const timeColor = getTimeColor(item.postedAt || item.createdAt);
  const jobTypeLabel = formatJobType(item.jobType);
  const locationImpliesRemote = /remote|anywhere|work\s*from\s*home/i.test(item.location ?? '');

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.jobCard}>
      <View style={styles.cardRow}>
        {item.companyLogoUrl ? (
          <Image
            source={{ uri: item.companyLogoUrl }}
            style={styles.companyLogo}
            contentFit="contain"
          />
        ) : (
          <View style={styles.companyLogoPlaceholder}>
            <Feather name="briefcase" size={18} color="#94a3b8" />
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
          {item.company && (
            <View style={styles.inlineRowTight}>
              <Feather name="home" size={12} color="#64748b" />
              <Text style={styles.jobCompany}>{item.company}</Text>
            </View>
          )}
        </View>
        {timeAgo ? (
          <View style={[styles.timeBadge, { backgroundColor: timeColor + '18' }]}>
            <Text style={[styles.timeText, { color: timeColor }]}>{timeAgo}</Text>
          </View>
        ) : null}
      </View>

      {item.location && (
        <View style={styles.inlineRow}>
          <Feather name="map-pin" size={12} color="#64748b" />
          <Text style={styles.metaText}>{item.location}</Text>
        </View>
      )}

      {item.salary && (
        <View style={styles.inlineRow}>
          <Feather name="dollar-sign" size={12} color="#4338ca" />
          <Text style={styles.salaryText}>{item.salary}</Text>
        </View>
      )}

      <View style={styles.badgeRow}>
        {item.remote && !locationImpliesRemote && (
          <View style={styles.badgeGreen}>
            <Text style={styles.badgeGreenText}>Remote</Text>
          </View>
        )}
        {jobTypeLabel ? (
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>{jobTypeLabel}</Text>
          </View>
        ) : null}
        {item.healthInsurance && (
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>Health</Text>
          </View>
        )}
        {item.paidTimeOff && (
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>PTO</Text>
          </View>
        )}
        {item.saved && (
          <View style={styles.badgeAmber}>
            <Text style={styles.badgeAmberText}>Saved</Text>
          </View>
        )}
        {item.status === 'ADDED_TO_LEADS' && (
          <View style={styles.badgePrimary}>
            <Feather name="check-circle" size={10} color="#4338ca" />
            <Text style={styles.badgePrimaryText}>In Leads</Text>
          </View>
        )}
      </View>

      {item.description && (
        <Text style={styles.descriptionPreview} numberOfLines={2}>
          {item.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('Portland, OR');
  const [locationLoading, setLocationLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [sort, setSort] = useState('recent');
  const [postedWithin, setPostedWithin] = useState('any');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [excludeDismissed, setExcludeDismissed] = useState(true);
  const [excludeLeads, setExcludeLeads] = useState(false);
  const [excludeApplied, setExcludeApplied] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);

  const debouncedSearch = useDebounce(search, 500);
  const debouncedLocation = useDebounce(location, 500);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationLoading(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const [place] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (place) {
          const parts = [place.city, place.region].filter(Boolean);
          if (parts.length > 0) setLocation(parts.join(', '));
        }
      } catch {} finally { setLocationLoading(false); }
    })();
  }, []);

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, error, refetch,
  } = useInfiniteQuery({
    queryKey: ['jobs', debouncedSearch, debouncedLocation, sort, postedWithin, remoteOnly, excludeDismissed, excludeLeads, excludeApplied, savedOnly],
    queryFn: ({ pageParam = 1 }) =>
      getJobs({
        search: debouncedSearch,
        location: debouncedLocation,
        page: pageParam,
        pageSize: PAGE_SIZE,
        sort,
        postedWithin,
        remote: remoteOnly,
        excludeDismissed,
        excludeLeads,
        excludeApplied,
        savedOnly,
        includeCount: pageParam === 1,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const currentPage = allPages.length;
      const pageCount = lastPage.pageInfo?.pageCount ?? 0;
      return currentPage < pageCount ? currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !locationLoading,
  });

  const jobs = (() => {
    const all = data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    });
  })();
  const totalCount = data?.pages[0]?.pageInfo?.total ?? 0;

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const activeFilterCount = [
    remoteOnly, savedOnly, excludeLeads, excludeApplied,
    !excludeDismissed, postedWithin !== 'any', sort !== 'recent',
  ].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.searchHeader}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Jobs</Text>
            {!isLoading && totalCount > 0 && (
              <Text style={styles.countText}>{totalCount.toLocaleString()} results</Text>
            )}
          </View>
          <View style={styles.inputRow}>
            <Feather name="search" size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              onChangeText={setSearch}
              placeholder="Search job titles, companies..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              style={styles.searchInput}
              value={search}
            />
          </View>
          <View style={styles.inputRow}>
            <Feather name="map-pin" size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              onChangeText={setLocation}
              placeholder={locationLoading ? 'Detecting location...' : 'Location'}
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              style={styles.searchInput}
              value={location}
            />
          </View>
          <View style={styles.filterBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFiltersOpen(true)}
              style={styles.filterButton}
            >
              <Feather name="sliders" size={14} color="#4338ca" />
              <Text style={styles.filterButtonText}>
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  activeOpacity={0.8}
                  onPress={() => setSort(opt.value)}
                  style={[styles.sortChip, sort === opt.value && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, sort === opt.value && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Filter Modal */}
        <Modal visible={filtersOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFiltersOpen(false)}>
                <Feather name="x" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalContent}>
              <Text style={styles.filterSectionTitle}>Posted Within</Text>
              <View style={styles.chipGroup}>
                {POSTED_WITHIN_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.8}
                    onPress={() => setPostedWithin(opt.value)}
                    style={[styles.chip, postedWithin === opt.value && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, postedWithin === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Quick Filters</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Remote Only</Text>
                <Switch value={remoteOnly} onValueChange={setRemoteOnly} trackColor={{ true: '#4338ca' }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Saved Only</Text>
                <Switch value={savedOnly} onValueChange={setSavedOnly} trackColor={{ true: '#4338ca' }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Exclude Dismissed</Text>
                <Switch value={excludeDismissed} onValueChange={setExcludeDismissed} trackColor={{ true: '#4338ca' }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Exclude Leads</Text>
                <Switch value={excludeLeads} onValueChange={setExcludeLeads} trackColor={{ true: '#4338ca' }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Exclude Applied</Text>
                <Switch value={excludeApplied} onValueChange={setExcludeApplied} trackColor={{ true: '#4338ca' }} />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setRemoteOnly(false);
                  setSavedOnly(false);
                  setExcludeDismissed(true);
                  setExcludeLeads(false);
                  setExcludeApplied(false);
                  setPostedWithin('any');
                  setSort('recent');
                }}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFiltersOpen(false)}
                style={styles.applyButton}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        {isError ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={32} color="#ef4444" />
            <Text style={styles.errorTitle}>Failed to load jobs</Text>
            <Text style={styles.errorMessage}>
              {error instanceof Error ? error.message : 'Please try again'}
            </Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => refetch()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={jobs}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
            renderItem={({ item }) => (
              <JobCard item={item} onPress={() => router.push(`/(tabs)/jobs/${item.id}`)} />
            )}
            ListEmptyComponent={
              isLoading || locationLoading ? (
                <ActivityIndicator style={styles.loader} size="large" color="#4338ca" />
              ) : (
                <View style={styles.emptyContainer}>
                  <Feather name="briefcase" size={40} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No jobs found</Text>
                  <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
                </View>
              )
            }
            ListFooterComponent={
              isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color="#4338ca" /> : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  searchHeader: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  countText: { fontSize: 13, color: '#94a3b8' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingHorizontal: 10,
  },
  inputIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', height: 40 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  filterButtonText: { fontSize: 13, fontWeight: '500', color: '#4338ca' },
  sortChips: { gap: 6, paddingRight: 8 },
  sortChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f1f5f9' },
  sortChipActive: { backgroundColor: '#4338ca' },
  sortChipText: { fontSize: 12, color: '#64748b' },
  sortChipTextActive: { color: '#ffffff', fontWeight: '500' },
  // Modal
  modalSafeArea: { flex: 1, backgroundColor: '#ffffff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalBody: { flex: 1 },
  modalContent: { padding: 16, gap: 20 },
  filterSectionTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#4338ca' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextActive: { color: '#ffffff', fontWeight: '500' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 15, color: '#0f172a' },
  modalFooter: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  resetButton: {
    flex: 1, height: 44, borderRadius: 10, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  resetButtonText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  applyButton: {
    flex: 1, height: 44, borderRadius: 10, backgroundColor: '#4338ca',
    alignItems: 'center', justifyContent: 'center',
  },
  applyButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  // List
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  jobCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  companyLogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9' },
  companyLogoPlaceholder: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1, gap: 2 },
  jobTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', lineHeight: 20 },
  jobCompany: { fontSize: 13, color: '#64748b', marginLeft: 4 },
  inlineRowTight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 52 },
  metaText: { fontSize: 12, color: '#64748b', marginLeft: 2 },
  salaryText: { fontSize: 12, color: '#4338ca', fontWeight: '500', marginLeft: 2 },
  timeBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  timeText: { fontSize: 11, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 52 },
  badgeGreen: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeGreenText: { fontSize: 11, fontWeight: '500', color: '#15803d' },
  badgeMuted: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeMutedText: { fontSize: 11, color: '#64748b' },
  badgeAmber: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeAmberText: { fontSize: 11, fontWeight: '500', color: '#b45309' },
  badgePrimary: { backgroundColor: '#eef2ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgePrimaryText: { fontSize: 11, fontWeight: '500', color: '#4338ca' },
  descriptionPreview: { fontSize: 12, color: '#94a3b8', lineHeight: 17, marginLeft: 52 },
  // States
  loader: { paddingVertical: 48 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#64748b' },
  emptySubtitle: { fontSize: 14, color: '#94a3b8' },
  footerLoader: { paddingVertical: 16 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  errorMessage: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  retryButton: { marginTop: 8, backgroundColor: '#4338ca', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});
