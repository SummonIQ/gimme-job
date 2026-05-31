import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

import { getUserProfile, updateUserProfile } from '@/lib/api/endpoints/user';

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: getUserProfile,
  });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form fields when data loads
  if (user && !initialized) {
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setCity(user.profile?.city || '');
    setPhone(user.profile?.phone || '');
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: () =>
      updateUserProfile({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        profile: { city, phone },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      Alert.alert('Saved', 'Profile updated successfully.');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4338ca" />
      </View>
    );
  }

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
        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <Field
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>
          <View style={styles.nameField}>
            <Field
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </View>

        <Field label="Email" value={user?.email ?? ''} onChangeText={() => {}} />

        <Field
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="e.g., San Francisco, CA"
        />

        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 555-5555"
          keyboardType="phone-pad"
        />

        <Pressable
          disabled={mutation.isPending}
          onPress={() => mutation.mutate()}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
          ]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </Pressable>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
