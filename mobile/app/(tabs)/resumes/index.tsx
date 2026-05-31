import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getResumes } from '@/lib/api/endpoints/resumes';

export default function ResumesScreen() {
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['resumes'],
    queryFn: getResumes,
  });

  const resumes = data?.data ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Resumes</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/resumes/new')}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={resumes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/resumes/${item.id}`)}
            style={({ pressed }) => [
              styles.resumeCard,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resumeName}>
              {item.name ?? 'Untitled Resume'}
            </Text>
            <Text style={styles.resumeMeta}>
              {item._count.revisions} revision{item._count.revisions !== 1 ? 's' : ''}
              {' · '}Updated {new Date(item.updatedAt).toLocaleDateString()}
            </Text>

            {item.analysis && (
              <View style={styles.scoresRow}>
                {item.analysis.overallScore != null && (
                  <View style={styles.overallBadge}>
                    <Text style={styles.overallBadgeText}>
                      {Math.round(item.analysis.overallScore)}% Overall
                    </Text>
                  </View>
                )}
                {item.analysis.atsScore != null && (
                  <View style={styles.atsBadge}>
                    <Text style={styles.atsBadgeText}>
                      ATS: {Math.round(item.analysis.atsScore)}%
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No resumes yet</Text>
              <Text style={styles.emptySubtitle}>
                Upload a resume to get started
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  addButton: {
    backgroundColor: '#4338ca',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addButtonPressed: {
    opacity: 0.9,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  resumeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pressed: {
    opacity: 0.9,
  },
  resumeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  resumeMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  overallBadge: {
    backgroundColor: 'rgba(67, 56, 202, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  overallBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },
  atsBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  atsBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#15803d',
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
