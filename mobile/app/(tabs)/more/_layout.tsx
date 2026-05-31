import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="upgrade" options={{ title: 'Upgrade' }} />
      <Stack.Screen name="tools/interview-prep" options={{ title: 'Interview Prep' }} />
      <Stack.Screen name="tools/ats-optimizer" options={{ title: 'ATS Optimizer' }} />
      <Stack.Screen name="tools/ats-research" options={{ title: 'ATS Research' }} />
      <Stack.Screen name="tools/job-details-optimizer" options={{ title: 'Job Optimizer' }} />
      <Stack.Screen name="tools/job-scraper" options={{ title: 'Job Scraper' }} />
      <Stack.Screen name="tools/company-research" options={{ title: 'Company Research' }} />
      <Stack.Screen name="tools/network" options={{ title: 'Network' }} />
      <Stack.Screen name="tools/automation" options={{ title: 'Automation' }} />
      <Stack.Screen name="tools/analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="tools/people-profiles" options={{ title: 'People Profiles' }} />
    </Stack>
  );
}
