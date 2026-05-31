import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getJob } from '@/lib/api/endpoints/jobs';
import { createLead } from '@/lib/api/endpoints/leads';

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  FULL_TIME_AND_PART_TIME: 'Full/Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: job, isLoading, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id),
  });

  const addToLeads = useMutation({
    mutationFn: () => createLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      Alert.alert('Added to Leads', 'Job has been added to your pipeline.');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add to leads');
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4338ca" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Job not found</Text>
      </View>
    );
  }

  const isLead = job.status === 'ADDED_TO_LEADS';
  const locationImpliesRemote = /remote|anywhere|work\s*from\s*home/i.test(job.location ?? '');
  const jobTypeLabel = JOB_TYPE_LABELS[job.jobType ?? ''] || (job.jobType && job.jobType !== 'UNKNOWN' ? job.jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          {job.companyLogoUrl ? (
            <Image source={{ uri: job.companyLogoUrl }} style={styles.logo} contentFit="contain" />
          ) : null}

          <Text style={styles.title}>{job.title}</Text>

          <View style={styles.metaList}>
            {job.company && (
              <View style={styles.metaRow}>
                <Feather name="home" size={14} color="#64748b" />
                <Text style={styles.metaText}>{job.company}</Text>
              </View>
            )}
            {job.location && (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={14} color="#64748b" />
                <Text style={styles.metaText}>{job.location}</Text>
              </View>
            )}
            {jobTypeLabel && (
              <View style={styles.metaRow}>
                <Feather name="briefcase" size={14} color="#64748b" />
                <Text style={styles.metaText}>{jobTypeLabel}</Text>
              </View>
            )}
            {job.salary && !/^[\s$€£¥0.,]*$/.test(job.salary) && (
              <View style={styles.metaRow}>
                <Feather name="dollar-sign" size={14} color="#64748b" />
                <Text style={styles.metaText}>{job.salary}</Text>
              </View>
            )}
          </View>

          {(job.remote && !locationImpliesRemote) && (
            <View style={styles.remoteBadge}>
              <Text style={styles.remoteBadgeText}>Remote</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {job.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.bodyText}>
              {job.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
            </Text>
          </View>
        )}

        {/* Requirements */}
        {job.requirements && Array.isArray(job.requirements) && job.requirements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            {job.requirements.map((req, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{req}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Qualifications */}
        {job.qualifications && Array.isArray(job.qualifications) && job.qualifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Qualifications</Text>
            {job.qualifications.map((qual, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{qual}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Responsibilities */}
        {job.responsibilities && Array.isArray(job.responsibilities) && job.responsibilities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Responsibilities</Text>
            {job.responsibilities.map((resp, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{resp}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Benefits */}
        {job.benefits && Array.isArray(job.benefits) && job.benefits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Benefits</Text>
            {job.benefits.map((benefit, i) => (
              <View key={i} style={styles.bulletRow}>
                <Feather name="check" size={14} color="#22c55e" />
                <Text style={styles.bulletText}>{benefit}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => addToLeads.mutate()}
          disabled={isLead || addToLeads.isPending}
          style={[isLead ? styles.addedButton : styles.addButton, (isLead || addToLeads.isPending) && { opacity: 0.6 }]}
        >
          {addToLeads.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={isLead ? 'check-circle' : 'plus-circle'} size={18} color={isLead ? '#15803d' : '#ffffff'} />
              <Text style={isLead ? styles.addedButtonText : styles.addButtonText}>
                {isLead ? 'Added to Leads' : 'Add to Leads'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.saveButton}
        >
          <Feather name={job.saved ? 'bookmark' : 'bookmark'} size={18} color="#4338ca" />
          <Text style={styles.saveButtonText}>{job.saved ? 'Saved' : 'Save Job'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  emptyText: { fontSize: 18, color: '#64748b' },
  scrollContent: { paddingBottom: 100 },
  // Header
  headerSection: { padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f1f5f9', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', lineHeight: 28 },
  metaList: { gap: 6, marginTop: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14, color: '#64748b' },
  remoteBadge: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  remoteBadgeText: { fontSize: 12, fontWeight: '500', color: '#15803d' },
  // Sections
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a', marginBottom: 10 },
  bodyText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 },
  bullet: { fontSize: 14, color: '#4338ca', lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },
  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32,
    flexDirection: 'row', gap: 10,
  },
  addButton: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#4338ca',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  addedButton: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#dcfce7',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addedButtonText: { fontSize: 15, fontWeight: '600', color: '#15803d' },
  saveButton: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#ffffff', paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#4338ca' },
});
