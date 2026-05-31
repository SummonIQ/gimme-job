import { api } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

interface PeopleProfile {
  id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  createdAt: string;
}

export default function PeopleProfilesScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['people-profiles'],
    queryFn: () => api.get<PeopleProfile[]>('/api/people-profiles'),
  });

  const profiles = Array.isArray(data) ? data : [];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={profiles}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
      renderItem={({ item }) => (
        <View style={styles.profileCard}>
          <Text style={styles.profileName}>
            {item.name ?? 'Unknown'}
          </Text>
          {item.title && (
            <Text style={styles.profileTitle}>{item.title}</Text>
          )}
          {item.company && (
            <Text style={styles.profileCompany}>{item.company}</Text>
          )}
        </View>
      )}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No profiles yet</Text>
            <Text style={styles.emptySubtitle}>
              Research recruiters and hiring managers from the web app
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  profileTitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  profileCompany: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
