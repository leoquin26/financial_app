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

// Also configure default axios
axios.defaults.baseURL = API_BASE_URL;
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export { axiosInstance };
export default axios;
