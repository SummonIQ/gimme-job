import { api } from '@/lib/api/client';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

export default function CompanyResearchScreen() {
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const research = async () => {
    if (!company.trim()) { Alert.alert('Error', 'Enter a company name'); return; }
    setLoading(true);
    try {
      const data = await api.post<Record<string, unknown>>('/api/interviewer-research', { company });
      setResult(data);
    } catch { Alert.alert('Error', 'Research failed'); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.label}>Company Name</Text>
          <TextInput onChangeText={setCompany} placeholder="e.g., Google" placeholderTextColor="#94a3b8" style={styles.input} value={company} />
        </View>
        <TouchableOpacity activeOpacity={0.8} disabled={loading} onPress={research} style={[styles.button, loading && { opacity: 0.6 }]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Research Company</Text>}
        </TouchableOpacity>
        {result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Research Results</Text>
            <Text style={styles.cardBody}>{JSON.stringify(result, null, 2).slice(0, 2000)}</Text>
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
  cardBody: { fontSize: 12, color: '#64748b' },
});
