import axios from 'axios';

// API Base URL - uses environment variable or defaults to local
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
export const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

// Create axios instance with base URL
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests if it exists
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Also configure default axios with interceptor
axios.defaults.baseURL = API_BASE_URL;

// Add interceptor to default axios too
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export { axiosInstance };
export default axios;
