import { Stack } from 'expo-router';

export default function ResumesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Add Resume' }} />
      <Stack.Screen name="[id]" options={{ title: 'Resume Details' }} />
    </Stack>
  );
}
