import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AtsOptimizerScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card}>
        <Text style={styles.emoji}>📊</Text>
        <Text style={styles.title}>ATS Optimizer</Text>
        <Text style={styles.description}>
          Upload or select a resume from the Resumes tab to analyze it against
          ATS (Applicant Tracking System) requirements.
        </Text>
        <Text style={styles.description}>
          Your resumes are automatically analyzed when uploaded. Check the
          Resumes tab for detailed ATS scores and recommendations.
        </Text>
      </View>
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
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
});
