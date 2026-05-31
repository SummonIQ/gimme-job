import { Feather } from '@expo/vector-icons';
import { signOut } from '@/lib/api/endpoints/auth';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  subtitle?: string;
}

function MenuItem({ icon, label, onPress, subtitle }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
    >
      <View style={styles.menuIconContainer}>
        <Feather name={icon} size={20} color="#64748b" />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle && (
          <Text style={styles.menuSubtitle}>{subtitle}</Text>
        )}
      </View>
      <Feather name="chevron-right" size={16} color="#94a3b8" />
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setUnauthenticated();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <SectionHeader title="Account" />
      <View style={styles.menuGroup}>
        <MenuItem
          icon="user"
          label="Profile"
          subtitle="Name, location, job preferences"
          onPress={() => router.push('/(tabs)/more/profile')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="settings"
          label="Settings"
          subtitle="Notifications, appearance"
          onPress={() => router.push('/(tabs)/more/settings')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="bell"
          label="Notifications"
          subtitle="View all notifications"
          onPress={() => router.push('/(tabs)/more/notifications')}
        />
      </View>

      <SectionHeader title="Tools" />
      <View style={styles.menuGroup}>
        <MenuItem
          icon="mic"
          label="Interview Prep"
          subtitle="AI-powered interview preparation"
          onPress={() => router.push('/(tabs)/more/tools/interview-prep')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="bar-chart"
          label="ATS Optimizer"
          subtitle="Optimize your resume for ATS"
          onPress={() => router.push('/(tabs)/more/tools/ats-optimizer')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="users"
          label="People Profiles"
          subtitle="Recruiter & hiring manager research"
          onPress={() => router.push('/(tabs)/more/tools/people-profiles')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="search"
          label="ATS Research"
          subtitle="Analyze job posting ATS requirements"
          onPress={() => router.push('/(tabs)/more/tools/ats-research')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="edit-3"
          label="Job Details Optimizer"
          subtitle="Optimize resume for specific jobs"
          onPress={() => router.push('/(tabs)/more/tools/job-details-optimizer')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="download-cloud"
          label="Job Scraper"
          subtitle="Scrape jobs from multiple platforms"
          onPress={() => router.push('/(tabs)/more/tools/job-scraper')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="globe"
          label="Company Research"
          subtitle="Research companies and culture"
          onPress={() => router.push('/(tabs)/more/tools/company-research')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="share-2"
          label="Network"
          subtitle="Manage contacts and follow-ups"
          onPress={() => router.push('/(tabs)/more/tools/network')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="zap"
          label="Automation"
          subtitle="Automate job applications"
          onPress={() => router.push('/(tabs)/more/tools/automation')}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="trending-up"
          label="Analytics"
          subtitle="Job search effectiveness & outcomes"
          onPress={() => router.push('/(tabs)/more/tools/analytics')}
        />
      </View>

      <SectionHeader title="Subscription" />
      <View style={styles.menuGroup}>
        <MenuItem
          icon="star"
          label="Upgrade to Pro"
          subtitle="Unlock all features"
          onPress={() => router.push('/(tabs)/more/upgrade')}
        />
      </View>

      <View style={styles.signOutContainer}>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutPressed,
          ]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuGroup: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  menuItemPressed: {
    backgroundColor: '#f1f5f9',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    color: '#0f172a',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  menuChevron: {
    color: '#64748b',
    fontSize: 18,
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginLeft: 64,
  },
  signOutContainer: {
    padding: 16,
    marginTop: 16,
  },
  signOutButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutPressed: {
    opacity: 0.8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});
