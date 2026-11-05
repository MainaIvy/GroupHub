import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from './src/screens/LoginScreen';
import StudentDashboardScreen from './src/screens/StudentDashboardScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);

  const handleNavigate = (screenName, params = {}) => {
    // 1. If an explicit user object was passed (e.g. from Login), save it
    if (params && params.user !== undefined) {
      setCurrentUser(params.user);
    }

    // 2. Clear user state on sign out
    if (screenName === 'login' || screenName === 'home') {
      if (!params || !params.user) {
        setCurrentUser(null);
      }
    }

    // 3. Switch the active view
    setCurrentScreen(screenName);
  };

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    setCurrentScreen('dashboard');
  };

  return (
    <SafeAreaProvider>
      {currentScreen === 'home' && (
        <HomeScreen onNavigate={handleNavigate} />
      )}

      {currentScreen === 'signup' && (
        <SignUpScreen
          onNavigate={handleNavigate}
          onLoginSuccess={handleAuthSuccess}
        />
      )}

      {currentScreen === 'login' && (
        <LoginScreen
          onNavigate={handleNavigate}
          onLoginSuccess={handleAuthSuccess}
        />
      )}

      {currentScreen === 'dashboard' && (
        <StudentDashboardScreen
          user={currentUser}
          onNavigate={handleNavigate}
        />
      )}
    </SafeAreaProvider>
  );
}