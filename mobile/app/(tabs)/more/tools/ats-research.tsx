import { Feather } from '@expo/vector-icons';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

export default function AtsResearchScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const analyze = async () => {
    if (!url.trim()) { Alert.alert('Error', 'Enter a job URL'); return; }
    setLoading(true);
    try {
      const data = await api.post<Record<string, unknown>>('/api/ats-research/analyze', { url });
      setResult(data);
    } catch { Alert.alert('Error', 'Analysis failed'); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.label}>Job Posting URL</Text>
          <TextInput onChangeText={setUrl} placeholder="https://..." placeholderTextColor="#94a3b8" style={styles.input} value={url} />
        </View>
        <TouchableOpacity activeOpacity={0.8} disabled={loading} onPress={analyze} style={[styles.button, loading && { opacity: 0.6 }]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Analyze ATS</Text>}
        </TouchableOpacity>
        {result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Analysis Result</Text>
            <Text style={styles.cardBody}>{JSON.stringify(result, null, 2).slice(0, 1000)}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#0f172a', marginBottom: 6 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', paddingHorizontal: 12, fontSize: 16, color: '#0f172a' },
  button: { height: 48, borderRadius: 12, backgroundColor: '#4338ca', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  cardBody: { fontSize: 12, color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
