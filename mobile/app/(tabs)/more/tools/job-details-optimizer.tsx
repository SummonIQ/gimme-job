import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function JobDetailsOptimizerScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Job Details Optimizer</Text>
        <Text style={styles.description}>
          Optimize your resume for a specific job listing. Select a job from your Leads tab to generate a tailored resume revision that matches the job requirements.
        </Text>
        <Text style={styles.description}>
          This tool analyzes the job description and your resume to suggest improvements for keyword matching, skills alignment, and ATS compatibility.
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
