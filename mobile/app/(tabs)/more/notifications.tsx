import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getNotifications } from '@/lib/api/endpoints/notifications';

export default function NotificationsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const notifications = data?.data ?? [];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={notifications}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.notificationCard,
            item.read ? styles.readCard : styles.unreadCard,
          ]}
        >
          <Text style={styles.notificationTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.notificationDescription}>
              {item.description}
            </Text>
          )}
          <Text style={styles.notificationDate}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications</Text>
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
    gap: 8,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  readCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  unreadCard: {
    backgroundColor: 'rgba(67, 56, 202, 0.05)',
    borderColor: 'rgba(67, 56, 202, 0.3)',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  notificationDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  notificationDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
  },
});
