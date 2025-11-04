import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { axiosInstance as axios, API_BASE_URL } from '../config/api';

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  currency: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      console.log('Fetching user with token:', token?.substring(0, 20) + '...');
      const response = await axios.get('/api/auth/me');
      console.log('User data received:', response.data);
      // Backend returns user data directly, not wrapped in 'user' property
      setUser(response.data);
    } catch (error: any) {
      console.error('Failed to fetch user:', error.response?.data || error.message);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('Attempting login for:', username);
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      
      console.log('Login successful, user:', user);
      console.log('Token received:', token?.substring(0, 20) + '...');
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setToken(token);
      setUser(user);
      
      toast.success('¡Bienvenido de vuelta!');
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string, fullName?: string) => {
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        fullName,
      });
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setToken(token);
      setUser(user);
      
      toast.success('¡Cuenta creada exitosamente!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al registrarse');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    toast.success('Sesión cerrada');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
