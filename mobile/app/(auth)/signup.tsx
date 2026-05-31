import { signUp } from '@/lib/api/endpoints/auth';
import { useAuthStore } from '@/stores/auth';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/ui/logo';

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleSignUp = async () => {
    Keyboard.dismiss();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const user = await signUp({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        password,
      });
      setAuthenticated(user.id);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Sign Up Failed',
        error instanceof Error ? error.message : 'Please try again',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Logo size="xl" layout="stacked" />
            </View>
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                autoComplete="given-name"
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={firstName}
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                autoComplete="family-name"
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={lastName}
              />
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoComplete="new-password"
              onChangeText={setPassword}
              onSubmitEditing={handleSignUp}
              placeholder="8-20 characters"
              placeholderTextColor="#94a3b8"
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={loading}
            onPress={handleSignUp}
            style={[styles.button, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.footerLink}>Sign In</Text>
            </Link>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
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
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
  },
});
