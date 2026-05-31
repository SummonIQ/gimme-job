import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createResume } from '@/lib/api/endpoints/resumes';

const NewResumeScreen = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [setDefault, setSetDefault] = useState(false);

  const createResumeMutation = useMutation({
    mutationFn: createResume,
    onError: error => {
      Alert.alert('Unable to create resume', error.message);
    },
    onSuccess: async createdResume => {
      await queryClient.invalidateQueries({ queryKey: ['resumes'] });
      router.replace(`/(tabs)/resumes/${createdResume.id}`);
    },
  });

  const handleCreateResume = () => {
    const parsedName = name.trim();
    const parsedMarkdown = markdown.trim();

    if (!parsedName) {
      Alert.alert('Name required', 'Please enter a name for your resume.');
      return;
    }

    if (!parsedMarkdown) {
      Alert.alert('Content required', 'Please paste your resume markdown content.');
      return;
    }

    createResumeMutation.mutate({
      description: description.trim() || undefined,
      markdown: parsedMarkdown,
      name: parsedName,
      setDefault,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Resume Name</Text>
          <TextInput
            autoCapitalize="words"
            placeholder="e.g. Product Manager Resume"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            placeholder="Short note about this version"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Markdown Content</Text>
          <TextInput
            multiline
            placeholder="Paste resume markdown here"
            placeholderTextColor="#94a3b8"
            style={styles.markdownInput}
            textAlignVertical="top"
            value={markdown}
            onChangeText={setMarkdown}
          />
        </View>

        <View style={styles.defaultRow}>
          <Text style={styles.defaultLabel}>Set as default resume</Text>
          <Switch
            trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
            thumbColor={setDefault ? '#4338ca' : '#ffffff'}
            value={setDefault}
            onValueChange={setSetDefault}
          />
        </View>

        <Pressable
          disabled={createResumeMutation.isPending}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitPressed,
            createResumeMutation.isPending && styles.submitDisabled,
          ]}
          onPress={handleCreateResume}
        >
          {createResumeMutation.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Create Resume</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  markdownInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 220,
    fontSize: 13,
    color: '#0f172a',
  },
  defaultRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defaultLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  submitButton: {
    marginTop: 8,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4338ca',
  },
  submitPressed: {
    opacity: 0.92,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default NewResumeScreen;
