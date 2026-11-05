import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen({ onNavigate }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Hero Photo */}
      <ImageBackground
        source={require('../../assets/images/students.jpg')}
        style={styles.heroImage}
        resizeMode="cover"
      >
        <View style={styles.imageDimOverlay} />
      </ImageBackground>

      {/* Modern Compact Bottom Sheet */}
      <View style={styles.bottomCard}>
        <View style={styles.pillBadge}>
          <Text style={styles.pillBadgeText}>GROUPHUB WORKSPACE</Text>
        </View>

        <Text style={styles.headingText}>
          Organize Coursework Teams Without the Chaos
        </Text>

        <Text style={styles.subText}>
          Form balanced project groups, track individual milestone contributions, and collaborate directly with your lecturers.
        </Text>

        {/* Buttons Stack */}
        <SafeAreaView style={styles.buttonStack}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onNavigate('signup')} // Goes to SignUpScreen
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onNavigate('login')} // Goes to LoginScreen
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  heroImage: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.64,
  },
  imageDimOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    marginTop: -44,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 12,
  },
  pillBadge: {
    backgroundColor: '#ecfccb',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  pillBadgeText: {
    color: '#365314',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headingText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#2e4a1f', // Deep Jungle Olive
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
});