import { api } from '@/lib/api/client';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function InterviewPrepScreen() {
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const generateQuestions = async () => {
    if (!jobTitle.trim()) {
      Alert.alert('Error', 'Please enter a job title');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<{ questions: string[] }>(
        '/api/interviews/questions',
        { jobTitle, company },
      );
      setQuestions(data.questions ?? []);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <View>
            <Text style={styles.label}>Job Title</Text>
            <TextInput
              onChangeText={setJobTitle}
              placeholder="e.g., Senior React Developer"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={jobTitle}
            />
          </View>
          <View>
            <Text style={styles.label}>Company (optional)</Text>
            <TextInput
              onChangeText={setCompany}
              placeholder="e.g., Google"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={company}
            />
          </View>
          <Pressable
            disabled={loading}
            onPress={generateQuestions}
            style={({ pressed }) => [
              styles.generateButton,
              pressed && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>
                Generate Questions
              </Text>
            )}
          </Pressable>
        </View>

        {questions.length > 0 && (
          <View style={styles.questionsContainer}>
            <Text style={styles.questionsTitle}>Interview Questions</Text>
            {questions.map((q, i) => (
              <View key={i} style={styles.questionCard}>
                <Text style={styles.questionNumber}>Question {i + 1}</Text>
                <Text style={styles.questionText}>{q}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  formContainer: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  generateButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  questionsContainer: {
    gap: 12,
    marginTop: 16,
  },
  questionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4338ca',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    color: '#0f172a',
  },
});
