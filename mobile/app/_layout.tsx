import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PusherProvider } from '@/components/providers/pusher-provider';
import { useAuthStore } from '@/stores/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
    },
  },
});

function AuthGate() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    initialize().then(() => setInitialized(true));
  }, [initialize]);

  useEffect(() => {
    // Don't redirect until initialization is complete
    if (!initialized || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      hasRedirected.current = true;
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      hasRedirected.current = true;
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, initialized, isLoading, router]);

  if (!initialized || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4338ca" />
      </View>
    );
  }

  return (
    <PusherProvider>
      <Slot />
    </PusherProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <AuthGate />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
