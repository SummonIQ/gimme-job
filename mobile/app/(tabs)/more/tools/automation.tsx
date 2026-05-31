import { api } from '@/lib/api/client';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AutomationScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['automation-status'],
    queryFn: () => api.get<Record<string, unknown>>('/api/automation/status').catch(() => null),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View style={styles.card}>
        <Feather name="zap" size={32} color="#4338ca" />
        <Text style={styles.title}>Application Automation</Text>
        <Text style={styles.description}>
          Automate your job applications across LinkedIn, Indeed, and company websites. Set up workflows, scheduling, and safety controls.
        </Text>
      </View>

      {data && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.statusText}>{JSON.stringify(data, null, 2).slice(0, 500)}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Features</Text>
        {['Scheduled applications', 'Multi-platform support', 'Safety controls & approval', 'Error handling & retry', 'Audit logging', 'Real-time analytics'].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Feather name="check" size={14} color="#22c55e" />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
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
  statusText: { fontSize: 12, color: '#64748b', fontFamily: 'monospace', alignSelf: 'flex-start' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  featureText: { fontSize: 14, color: '#0f172a' },
});
