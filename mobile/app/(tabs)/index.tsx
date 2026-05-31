import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api/client';

interface DashboardStats {
  totalLeads: number;
  analyzing: number;
  optimized: number;
  applied: number;
  interviews: number;
}

function useLeadStats() {
  return useQuery({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const data = await api.get<{
        data: Array<{ status: string }>;
        pagination: { total: number };
      }>('/api/mobile/job-leads', { pageSize: 1000 });

      const stats: DashboardStats = {
        totalLeads: data.pagination.total,
        analyzing: 0,
        optimized: 0,
        applied: 0,
        interviews: 0,
      };

      for (const lead of data.data) {
        switch (lead.status) {
          case 'ANALYZING':
          case 'OPTIMIZING':
            stats.analyzing++;
            break;
          case 'OPTIMIZED':
            stats.optimized++;
            break;
          case 'APPLIED':
            stats.applied++;
            break;
          case 'INTERVIEW_SCHEDULED':
          case 'INTERVIEW_COMPLETED':
            stats.interviews++;
            break;
        }
      }
      return stats;
    },
  });
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { data: stats, isLoading, refetch } = useLeadStats();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
    >
      <Text style={styles.heading}>Dashboard</Text>

      <View style={styles.statRow}>
        <StatCard
          label="Total Leads"
          value={stats?.totalLeads ?? 0}
          color="#4338ca"
        />
        <StatCard
          label="Analyzing"
          value={stats?.analyzing ?? 0}
          color="#f59e0b"
        />
      </View>

      <View style={styles.statRow}>
        <StatCard
          label="Optimized"
          value={stats?.optimized ?? 0}
          color="#22c55e"
        />
        <StatCard
          label="Applied"
          value={stats?.applied ?? 0}
          color="#3b82f6"
        />
      </View>

      <View style={styles.statRow}>
        <StatCard
          label="Interviews"
          value={stats?.interviews ?? 0}
          color="#8b5cf6"
        />
        <View style={styles.statCardPlaceholder} />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.actionsContainer}>
        <Pressable
          onPress={() => router.push('/(tabs)/jobs')}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryActionTitle}>Search Jobs</Text>
          <Text style={styles.primaryActionSubtitle}>
            Discover new opportunities
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(tabs)/leads')}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.pressedLight,
          ]}
        >
          <Text style={styles.secondaryActionTitle}>View Pipeline</Text>
          <Text style={styles.secondaryActionSubtitle}>
            Track your applications
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(tabs)/resumes')}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.pressedLight,
          ]}
        >
          <Text style={styles.secondaryActionTitle}>Manage Resumes</Text>
          <Text style={styles.secondaryActionSubtitle}>
            Optimize for ATS scoring
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statCardPlaceholder: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 16,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryAction: {
    backgroundColor: '#4338ca',
    borderRadius: 16,
    padding: 16,
  },
  primaryActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  secondaryAction: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  secondaryActionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.8,
  },
  pressedLight: {
    opacity: 0.9,
  },
});
