import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  AccountBalanceWallet,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth-pages.css';

interface LoginForm {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      // Small delay to ensure state updates have propagated
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await login('demo', 'demo123');
      // Small delay to ensure state updates have propagated
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } catch (err: any) {
      setError('Error al iniciar sesión con cuenta demo');
      setIsLoading(false);
    }
  };

  return (
    <Container 
      component="main" 
      maxWidth="xs" 
      className="auth-container"
      sx={{
        maxWidth: { xs: '100%', sm: '444px' },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: { xs: 3, sm: 4 },
          width: '100%',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper 
            elevation={3}
            className="auth-paper"
            sx={{ 
              p: { xs: 2, sm: 4 },
              borderRadius: 2,
              width: '100%',
              maxWidth: { xs: 'calc(100vw - 32px)', sm: '400px' },
              mx: 'auto',
            }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Box
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  p: 2,
                  borderRadius: '50%',
                  mb: 2,
                }}
              >
                <AccountBalanceWallet sx={{ fontSize: 40 }} />
              </Box>
              <Typography 
                component="h1" 
                variant="h4" 
                fontWeight="bold"
                sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
              >
                FinanzaPro
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                mt={1}
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                Organiza tus finanzas personales
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} className="auth-form">
              <TextField
                margin="normal"
                required
                fullWidth
                label="Usuario o Email"
                autoComplete="username"
                autoFocus
                {...register('username', {
                  required: 'El usuario es requerido',
                })}
                error={!!errors.username}
                helperText={errors.username?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              
              <TextField
                margin="normal"
                required
                fullWidth
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password', {
                  required: 'La contraseña es requerida',
                  minLength: {
                    value: 6,
                    message: 'La contraseña debe tener al menos 6 caracteres',
                  },
                })}
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.5 }}
                disabled={isLoading}
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>

              <Divider sx={{ my: 2 }}>O</Divider>

              <Button
                fullWidth
                variant="outlined"
                onClick={handleDemoLogin}
                sx={{ mb: 2, py: 1.5 }}
                disabled={isLoading}
              >
                Probar con cuenta Demo
              </Button>

              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  ¿No tienes una cuenta?{' '}
                  <Link
                    to="/register"
                    style={{
                      color: '#4A90E2',
                      textDecoration: 'none',
                      fontWeight: 'bold',
                    }}
                  >
                    Regístrate aquí
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </motion.div>
      </Box>
    </Container>
  );
};

export default Login;
