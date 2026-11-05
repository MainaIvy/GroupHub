import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';

const API_BASE_URL = 'http://1192.168.0.61:8000/api';

export default function LoginScreen({ onNavigate, onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your registration number or email and password.');
      return;
    }

    setLoading(true);
    const payload = {
      identifier: identifier.trim(),
      email: identifier.trim().toLowerCase(),
      registration_no: identifier.trim().toUpperCase(),
      password: password,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setLoading(false);
        if (onLoginSuccess && data.user) {
          // Pass the exact user object and access token back upstream
          onLoginSuccess(data.user, data.access);
        } else if (onNavigate) {
          onNavigate('dashboard', { user: data.user });
        }
      } else {
        setLoading(false);
        Alert.alert('Login Failed', data.error || data.detail || 'Invalid credentials provided.');
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('Connection Error', 'Could not reach backend server at 192.168.0.198:8000.');
    }
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Navigation */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => onNavigate('home')}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeText}>STUDENT PORTAL</Text>
            </View>
          </View>

          {/* Title Banner */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in with your university registration number or email to access your genuine workspace profile.
            </Text>
          </View>

          {/* Form Card Container */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Registration Number or Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. bcs-00-0000/2024 or email@zetech.ac.ke"
                placeholderTextColor="#94a3b8"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••••••"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.85 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In to Dashboard</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Redirect Link */}
          <View style={styles.bottomLinkRow}>
            <Text style={styles.bottomPromptText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => onNavigate('signup')} activeOpacity={0.7}>
              <Text style={styles.signupRedirectText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#f8fafc' },
  keyboardContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  backButton: { paddingVertical: 6, paddingRight: 12 },
  backButtonText: { fontSize: 13.5, fontWeight: '700', color: '#64748b' },
  pillBadge: { backgroundColor: '#ecfccb', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  pillBadgeText: { color: '#365314', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  titleSection: { marginBottom: 20 },
  mainTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: -0.4, marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', lineHeight: 19 },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
    gap: 16,
  },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.5, textTransform: 'uppercase' },
  textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: '#0f172a' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: '#0f172a' },
  eyeButton: { paddingHorizontal: 16, paddingVertical: 13 },
  eyeButtonText: { fontSize: 12, fontWeight: '800', color: '#2e4a1f' },
  primaryBtn: { backgroundColor: '#2e4a1f', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  bottomLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
  bottomPromptText: { fontSize: 13, color: '#64748b' },
  signupRedirectText: { fontSize: 13, fontWeight: '800', color: '#2e4a1f' },
});