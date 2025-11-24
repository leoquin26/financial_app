import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Box } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CustomThemeProvider } from './contexts/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useEffect } from 'react';
import './styles/responsive.css';
import './styles/mobile.css';
import './styles/overflow-fix.css';
import './styles/ios-fix.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Households from './pages/Households';
import HouseholdDetail from './pages/HouseholdDetail';
import PaymentSchedule from './pages/PaymentScheduleImproved';
import WeeklyBudgetSimplified from './pages/WeeklyBudgetSimplified';
import MainBudgets from './pages/MainBudgets';

// Components
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});


function App() {
  useEffect(() => {
    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
    
    // Set viewport height for mobile browsers
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    
    // Fix iOS viewport issues - removed position: fixed as it causes issues
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      document.documentElement.style.width = '100%';
      document.documentElement.style.minHeight = '100%';
      document.documentElement.style.overflowX = 'hidden';
      // Allow vertical scrolling
      document.documentElement.style.overflowY = 'auto';
    }
    
    return () => {
      window.removeEventListener('resize', setVH);
    };
  }, []);

  return (
    <Box sx={{ width: '100%', overflowX: 'hidden', minHeight: '100vh' }}>
      <QueryClientProvider client={queryClient}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AuthProvider>
            <CustomThemeProvider>
              <SocketProvider>
                <Router>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/"
                    element={
                      <PrivateRoute>
                        <Layout />
                      </PrivateRoute>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="transactions" element={<Transactions />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="households" element={<Households />} />
                <Route path="households/:id" element={<HouseholdDetail />} />
                    <Route path="payments" element={<PaymentSchedule />} />
                    <Route path="budgets" element={<MainBudgets />} />
                    <Route path="budgets/:id" element={<MainBudgets />} />
                    <Route path="budgets/:id/analytics" element={<Analytics />} />
                    <Route path="budgets/week/:weekId" element={<WeeklyBudgetSimplified />} />
                    <Route path="weekly-budget" element={<Navigate to="/budgets" replace />} />
                    <Route path="weekly-budget/:id" element={<WeeklyBudgetSimplified />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Routes>
              </Router>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#333',
                    color: '#fff',
                    borderRadius: '8px',
                  },
                  success: {
                    iconTheme: {
                      primary: '#4CAF50',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#FF6B6B',
                      secondary: '#fff',
                    },
                  },
                }}
              />
              <ToastContainer position="top-right" />
            </SocketProvider>
          </CustomThemeProvider>
        </AuthProvider>
      </LocalizationProvider>
    </QueryClientProvider>
    </Box>
  );
}

export default App;