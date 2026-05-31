import { api } from '@/lib/api/client';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const FEATURES = [
  { emoji: '🤖', title: 'AI Application Assist', description: 'AI-guided form filling for job applications' },
  { emoji: '⚡', title: 'Application Automation', description: 'Automate submissions across platforms' },
  { emoji: '📊', title: 'Advanced Analytics', description: 'Deep insights into your job search' },
  { emoji: '📋', title: 'Portfolio Management', description: 'Create professional portfolios' },
  { emoji: '🤝', title: 'Networking Tools', description: 'Manage contacts and follow-ups' },
  { emoji: '🎯', title: 'Unlimited Optimizations', description: 'Optimize resumes for every application' },
];

export default function UpgradeScreen() {
  const handleUpgrade = async () => {
    try {
      const data = await api.post<{ url: string }>('/api/stripe/checkout');
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to start checkout. Please try again.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.heroBanner}>
        <Text style={styles.heroTitle}>Upgrade to Pro</Text>
        <Text style={styles.heroSubtitle}>
          Unlock the full power of your job search
        </Text>
      </View>

      <View style={styles.featuresContainer}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.featureCard}>
            <Text style={styles.featureEmoji}>{feature.emoji}</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={handleUpgrade}
        style={({ pressed }) => [
          styles.subscribeButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  heroBanner: {
    backgroundColor: 'rgba(67, 56, 202, 0.05)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  featuresContainer: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 12,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  featureDescription: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  subscribeButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
});
