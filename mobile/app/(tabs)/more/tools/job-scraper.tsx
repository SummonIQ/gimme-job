import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function JobScraperScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Job Scraper</Text>
        <Text style={styles.description}>
          Scrape job listings from various platforms including Google Jobs, Indeed, LinkedIn, and more. Configure search criteria and let the system find matching opportunities.
        </Text>
        <Text style={styles.description}>
          Job scraping runs in the background. Results appear in your Jobs tab when ready.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: '#0f172a', textAlign: 'center' },
  description: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
