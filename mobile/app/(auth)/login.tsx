import { signIn } from '@/lib/api/endpoints/auth';
import { useAuthStore } from '@/stores/auth';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/ui/logo';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      setAuthenticated(user.id);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Sign In Failed',
        error instanceof Error ? error.message : 'Please try again',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Logo size="xl" layout="stacked" />
            </View>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <View>
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
              autoComplete="password"
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              placeholder="Enter your password"
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
            onPress={handleLogin}
            style={[styles.button, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/signup">
              <Text style={styles.footerLink}>Sign Up</Text>
            </Link>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
