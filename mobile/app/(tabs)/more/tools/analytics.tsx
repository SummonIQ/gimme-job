import { api } from '@/lib/api/client';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AnalyticsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get<Record<string, unknown>>('/api/analytics').catch(() => null),
  });

  const appAnalytics = useQuery({
    queryKey: ['analytics-applications'],
    queryFn: () => api.get<Record<string, unknown>>('/api/analytics/applications').catch(() => null),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View style={styles.card}>
        <Feather name="trending-up" size={32} color="#4338ca" />
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.description}>
          Track your job search effectiveness, application outcomes, and resume performance.
        </Text>
      </View>

      {data && typeof data === 'object' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Overview</Text>
          {Object.entries(data).filter(([_, v]) => typeof v === 'number').map(([key, value]) => (
            <View key={key} style={styles.statRow}>
              <Text style={styles.statLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
              <Text style={styles.statValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}

      {appAnalytics.data && typeof appAnalytics.data === 'object' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Applications</Text>
          {Object.entries(appAnalytics.data).filter(([_, v]) => typeof v === 'number').map(([key, value]) => (
            <View key={key} style={styles.statRow}>
              <Text style={styles.statLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
              <Text style={styles.statValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#0f172a', textAlign: 'center' },
  description: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', alignSelf: 'flex-start' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  statLabel: { fontSize: 14, color: '#64748b' },
  statValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
});
