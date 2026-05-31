import { api } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

interface Contact {
  id: string;
  name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  notes: string | null;
}

export default function NetworkScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['network-contacts'],
    queryFn: () => api.get<Contact[]>('/api/networking/contacts'),
  });

  const contacts = Array.isArray(data) ? data : [];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={contacts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.name ?? 'Unknown'}</Text>
          {item.title && <Text style={styles.meta}>{item.title}</Text>}
          {item.company && <Text style={styles.meta}>{item.company}</Text>}
          {item.email && <Text style={styles.email}>{item.email}</Text>}
        </View>
      )}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptySubtitle}>Add networking contacts from the web app</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 14, color: '#64748b', marginTop: 2 },
  email: { fontSize: 13, color: '#4338ca', marginTop: 4 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, color: '#64748b' },
  emptySubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
});
