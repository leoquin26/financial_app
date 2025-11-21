# 📱 Financial App - Native Mobile Development Guide

This guide will help you create native iOS and Android apps for your financial management system.

## 🎯 Recommended Approach: Expo + React Native

Expo is the easiest way to build and deploy React Native apps. It provides:
- Managed workflow (no native code setup required)
- Easy deployment and updates
- Built-in features (camera, biometrics, etc.)
- Works with your existing React knowledge

## 📋 Setup Instructions

### 1. Create the Mobile App

```bash
# Create a new Expo project
npx create-expo-app financial-app-mobile --template blank-typescript

# Navigate to the project
cd financial-app-mobile

# Install dependencies
npm install
```

### 2. Install Essential Dependencies

```bash
# Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# UI Components
npm install react-native-paper react-native-vector-icons
npm install react-native-reanimated react-native-gesture-handler

# State Management & API
npm install @tanstack/react-query axios
npm install @react-native-async-storage/async-storage

# Forms
npm install react-hook-form

# Date handling
npm install date-fns

# Secure storage for auth tokens
npm install expo-secure-store

# Biometric authentication
npm install expo-local-authentication

# Charts
npm install react-native-chart-kit react-native-svg
```

### 3. Project Structure

```
financial-app-mobile/
├── src/
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── SplashScreen.tsx
│   │   ├── main/
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── TransactionsScreen.tsx
│   │   │   ├── BudgetsScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   └── modals/
│   │       ├── QuickPaymentModal.tsx
│   │       └── TransactionDetailModal.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── cards/
│   │   └── charts/
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── TabNavigator.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── storage.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── utils/
│   │   ├── constants.ts
│   │   └── helpers.ts
│   └── types/
│       └── index.ts
├── assets/
├── app.json
├── App.tsx
└── package.json
```

## 🔧 Key Implementation Files

### 1. API Configuration (src/services/api.ts)

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 2. Auth Context (src/contexts/AuthContext.tsx)

```typescript
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

interface AuthContextType {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    const { token, user } = response.data;
    
    await SecureStore.setItemAsync('authToken', token);
    setUser(user);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('authToken');
    setUser(null);
  };

  // Check for existing session on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await SecureStore.getItemAsync('authToken');
        if (token) {
          const response = await api.get('/api/auth/me');
          setUser(response.data);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 3. Main App Component (App.tsx)

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## 🚀 Running the App

### Development

```bash
# Start the development server
npm start

# Run on iOS simulator (Mac only)
npm run ios

# Run on Android emulator
npm run android

# Run on physical device
# Scan the QR code with Expo Go app
```

### Building for Production

```bash
# Build for both platforms
eas build --platform all

# Build for iOS only
eas build --platform ios

# Build for Android only
eas build --platform android
```

## 📱 Key Features to Implement

1. **Authentication**
   - Login/Register screens
   - Biometric authentication
   - Session management

2. **Dashboard**
   - Overview cards
   - Charts (income/expense)
   - Recent transactions

3. **Transactions**
   - List view with filters
   - Quick add button
   - Swipe to delete/edit

4. **Budgets**
   - Weekly/Monthly view
   - Progress indicators
   - Category breakdown

5. **Quick Payment**
   - Floating action button
   - Quick entry modal
   - Voice input (optional)

6. **Profile**
   - Settings
   - Currency selection
   - Notifications

## 🎨 UI/UX Considerations

- Use platform-specific designs (iOS Human Interface Guidelines, Material Design)
- Implement proper loading states
- Add pull-to-refresh on lists
- Use haptic feedback for actions
- Implement proper error handling
- Add offline support

## 📦 Next Steps

1. Set up the Expo project
2. Configure navigation
3. Create authentication flow
4. Connect to your existing backend API
5. Implement core features one by one
6. Test on real devices
7. Deploy to app stores

## 🔗 Useful Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://reactnativepaper.com/)
- [React Query for React Native](https://tanstack.com/query/latest)
