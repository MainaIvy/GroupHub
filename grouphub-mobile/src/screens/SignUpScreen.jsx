import React, { useState, useEffect } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';

const API_URL = 'http://192.168.0.61:8000/api';



const DEFAULT_PROGRAMS = [
  'Diploma in Computer Science',
  'Bachelor of Science in Clinical Medicine and Community Health',
  'Bachelor of Science in Nursing',
  'Bachelor of Laws',
  'Diploma in Counselling Psychology',
];

const LOADING_CATCHPHRASES = [
  'Crafting your workspace profile...',
  'Do you feel me? Connecting the nodes...',
  'Organizing your semester syllabus...',
  'Almost there, setting up your collaboration hub...',
];

export default function SignUpScreen({ onNavigate, onLoginSuccess }) {
  const [role, setRole] = useState('student'); // 'student' | 'lecturer'

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [course, setCourse] = useState('Diploma in Computer Science');
  const [yearOfStudy, setYearOfStudy] = useState('2');
  const [semester, setSemester] = useState('2');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  const isStudent = role === 'student';
  const isTrimesterProgram =
    course.toLowerCase().includes('medicine') ||
    course.toLowerCase().includes('nursing');
  const availableSemesters = isTrimesterProgram ? ['1', '2', '3'] : ['1', '2'];

  // Fun timer to cycle catchphrases while backend processes
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_CATCHPHRASES.length);
      }, 1800);
    } else {
      setLoadingPhraseIndex(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !registrationNo.trim() || !password) {
      Alert.alert('Missing Details', 'Please complete all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords entered do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    const payload = {
      user_type: role.toLowerCase(),
      role: role.toLowerCase(),
      fullName: fullName.trim(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      registrationNo: registrationNo.trim().toUpperCase(),
      registration_no: registrationNo.trim().toUpperCase(),
      staffId: registrationNo.trim().toUpperCase(),
      course: isStudent ? course : '',
      yearOfStudy: isStudent ? String(yearOfStudy) : '',
      year_of_study: isStudent ? String(yearOfStudy) : '',
      semester: isStudent ? String(semester) : '',
      password: password,
      university: 'Zetech University',
    };

    try {
      const response = await fetch(`${API_BASE_URL}/signup/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let data = {};

      try {
        data = JSON.parse(rawText);
      } catch (e) {
        Alert.alert('Server Error', `Status ${response.status}. Please check Django terminal.`);
        setLoading(false);
        return;
      }

      if (response.ok || response.status === 201) {
        setRegisteredUser(data.user || { first_name: fullName.split(' ')[0], course });
        setLoading(false);
        setSuccessVisible(true);

        // Auto-redirect directly to dashboard after message displays
        setTimeout(() => {
          setSuccessVisible(false);
          if (onLoginSuccess && data.user) {
            onLoginSuccess(data.user, data.access);
          } else if (onNavigate) {
            onNavigate('dashboard');
          }
        }, 1600);
      } else {
        setLoading(false);
        const errorMsg =
          data.error ||
          data.detail ||
          data.message ||
          Object.values(data)[0] ||
          'Registration failed.';
        Alert.alert('Registration Notice', Array.isArray(errorMsg) ? errorMsg[0] : String(errorMsg));
      }
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Connection Error',
        'Could not reach the backend server. Make sure Django is running on 0.0.0.0:8000.'
      );
    }
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Row - Pushed down cleanly on iOS */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => onNavigate('home')}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeText}>GROUPHUB WORKSPACE</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Create Account</Text>
            <Text style={styles.subtitle}>
              Set up your profile to manage course units and collaborate with your project teams.
            </Text>
          </View>

          {/* Role Switcher */}
          <View style={styles.roleToggleWrapper}>
            <TouchableOpacity
              style={[styles.roleTab, isStudent && styles.roleTabActive]}
              onPress={() => setRole('student')}
              activeOpacity={0.85}
            >
              <Text style={[styles.roleTabText, isStudent && styles.roleTabTextActive]}>
                Student
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleTab, !isStudent && styles.roleTabActive]}
              onPress={() => setRole('lecturer')}
              activeOpacity={0.85}
            >
              <Text style={[styles.roleTabText, !isStudent && styles.roleTabTextActive]}>
                Lecturer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. John Doe or Jane Doe"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>University Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. johndoe@zetech.ac.ke"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isStudent ? 'Registration Number' : 'Staff / Payroll ID'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={isStudent ? 'e.g. bcs-00-0000/2024' : 'e.g. STF-8421'}
                placeholderTextColor="#94a3b8"
                value={registrationNo}
                onChangeText={setRegistrationNo}
                autoCapitalize="characters"
              />
            </View>

            {isStudent && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Degree / Diploma Programme</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownValueText}>{course}</Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Year of Study</Text>
                    <View style={styles.selectorRow}>
                      {['1', '2', '3', '4'].map((y) => (
                        <TouchableOpacity
                          key={y}
                          style={[
                            styles.chipOption,
                            yearOfStudy === y && styles.chipOptionActive,
                          ]}
                          onPress={() => setYearOfStudy(y)}
                        >
                          <Text
                            style={[
                              styles.chipOptionText,
                              yearOfStudy === y && styles.chipOptionTextActive,
                            ]}
                          >
                            Y{y}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Semester / Term</Text>
                    <View style={styles.selectorRow}>
                      {availableSemesters.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.chipOption,
                            semester === s && styles.chipOptionActive,
                          ]}
                          onPress={() => setSemester(s)}
                        >
                          <Text
                            style={[
                              styles.chipOptionText,
                              semester === s && styles.chipOptionTextActive,
                            ]}
                          >
                            Sem {s}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </>
            )}

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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••••••"
                  placeholderTextColor="#94a3b8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.85 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.loadingButtonText}>
                  {LOADING_CATCHPHRASES[loadingPhraseIndex]}
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>
                {isStudent ? 'Complete Student Registration' : 'Register as Lecturer'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Bottom Redirect */}
          <View style={styles.bottomLinkRow}>
            <Text style={styles.bottomPromptText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => onNavigate('login')}>
              <Text style={styles.loginRedirectText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Program Selector Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Academic Programme</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={DEFAULT_PROGRAMS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === course;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalOptionItem,
                      isSelected && styles.modalOptionItemSelected,
                    ]}
                    onPress={() => {
                      setCourse(item);
                      setModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Themed Success Modal */}
      <Modal visible={successVisible} transparent={true} animationType="fade">
        <View style={styles.successModalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successCheckText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Welcome to GroupHub!</Text>
            <Text style={styles.successBody}>
              {registeredUser?.first_name ? `Hey ${registeredUser.first_name}, your` : 'Your'}{' '}
              account is verified and live. Loading your dashboard...
            </Text>
            <View style={styles.redirectBadge}>
              <ActivityIndicator size="small" color="#2e4a1f" style={{ marginRight: 8 }} />
              <Text style={styles.redirectBadgeText}>Redirecting to Dashboard...</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#ffffff' },
  keyboardContainer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 24, // Clear dynamic island & status bar
    paddingBottom: 40,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { paddingVertical: 6, paddingRight: 12 },
  backButtonText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  pillBadge: { backgroundColor: '#ecfccb', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  pillBadgeText: { color: '#365314', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  titleSection: { marginBottom: 22 },
  mainTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: -0.4, marginBottom: 6 },
  subtitle: { fontSize: 13.5, color: '#64748b', lineHeight: 19 },
  roleToggleWrapper: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 24 },
  roleTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  roleTabActive: { backgroundColor: '#2e4a1f' },
  roleTabText: { fontSize: 13.5, fontWeight: '700', color: '#64748b' },
  roleTabTextActive: { color: '#ffffff', fontWeight: '800' },
  formSection: { gap: 16, marginBottom: 24 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11.5, fontWeight: '800', color: '#334155', letterSpacing: 0.4, textTransform: 'uppercase' },
  textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: '#0f172a' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: '#0f172a' },
  eyeButton: { paddingHorizontal: 16, paddingVertical: 13 },
  eyeButtonText: { fontSize: 12, fontWeight: '800', color: '#2e4a1f' },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dropdownValueText: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  dropdownIcon: { fontSize: 11, color: '#64748b', marginLeft: 8 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  selectorRow: { flexDirection: 'row', gap: 6 },
  chipOption: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  chipOptionActive: { backgroundColor: '#ecfccb', borderColor: '#2e4a1f' },
  chipOptionText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipOptionTextActive: { color: '#365314', fontWeight: '800' },
  primaryBtn: { backgroundColor: '#2e4a1f', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  primaryBtnText: { color: '#ffffff', fontSize: 14.5, fontWeight: '800', letterSpacing: 0.3 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingButtonText: { color: '#ffffff', fontSize: 13.5, fontWeight: '700' },
  bottomLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  bottomPromptText: { fontSize: 13, color: '#64748b' },
  loginRedirectText: { fontSize: 13, fontWeight: '800', color: '#2e4a1f' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalCloseText: { fontSize: 14, fontWeight: '700', color: '#2e4a1f' },
  modalOptionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  modalOptionItemSelected: { backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 8 },
  modalOptionText: { fontSize: 14, color: '#334155', flex: 1 },
  modalOptionTextSelected: { color: '#2e4a1f', fontWeight: '800' },
  checkIcon: { fontSize: 14, fontWeight: '800', color: '#2e4a1f', marginLeft: 8 },
  successModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  successCard: { backgroundColor: '#ffffff', width: '100%', borderRadius: 20, padding: 26, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  successIconBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ecfccb', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successCheckText: { fontSize: 30, color: '#2e4a1f', fontWeight: '900' },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  successBody: { fontSize: 13.5, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  redirectBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  redirectBadgeText: { fontSize: 12, fontWeight: '700', color: '#2e4a1f' },
});