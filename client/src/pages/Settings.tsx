import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  FormGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Chip,
  InputAdornment,
  Tab,
  Tabs,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Palette as PaletteIcon,
  AttachMoney as MoneyIcon,
  Security as SecurityIcon,
  Backup as BackupIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  CloudDownload as ExportIcon,
  CloudUpload as ImportIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Public as PublicIcon,
  FlashOn as FlashOnIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '@mui/material/styles';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface UserSettings {
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    transactionAlerts: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showEmail: boolean;
    showStats: boolean;
  };
  preferences?: {
    showFloatingQuickPayment?: boolean;
    floatingButtonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    density?: 'compact' | 'comfortable' | 'spacious';
  };
}

interface UserProfile {
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'auto';
  preferences?: {
    showFloatingQuickPayment?: boolean;
    floatingButtonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    density?: 'compact' | 'comfortable' | 'spacious';
  };
}

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { setThemePreference, density, setDensity } = useCustomTheme();
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [resetDataDialogOpen, setResetDataDialogOpen] = useState(false);

  // Form for profile
  const { control: profileControl, handleSubmit: handleProfileSubmit, reset: resetProfile, formState: { errors: profileErrors } } = useForm<UserProfile>();
  
  // Form for password change
  const { control: passwordControl, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: passwordErrors } } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Fetch user settings
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const response = await axios.get('/api/auth/settings');
      return response.data;
    },
  });

  // Update form when settings data is loaded
  React.useEffect(() => {
    if (settings) {
      resetProfile(settings);
    }
  }, [settings, resetProfile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await axios.put('/api/auth/profile', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Perfil actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      setEditMode(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar perfil');
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.put('/api/auth/password', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada exitosamente');
      setPasswordDialogOpen(false);
      resetPassword();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar contraseña');
    },
  });

  // Update notifications mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.put('/api/auth/notifications', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Preferencias de notificación actualizadas');
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar notificaciones');
    },
  });

  // Update privacy mutation
  const updatePrivacyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.put('/api/auth/privacy', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Configuración de privacidad actualizada');
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar privacidad');
    },
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: async (format: 'json' | 'csv' | 'excel') => {
      const response = await axios.get(`/api/auth/export?format=${format}`, {
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (data, format) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial_data_${new Date().toISOString()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Datos exportados exitosamente');
      setExportDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Error al exportar datos');
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.delete('/api/auth/account');
      return response.data;
    },
    onSuccess: () => {
      toast.success('Cuenta eliminada exitosamente');
      logout();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar cuenta');
    },
  });

  const resetDataMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await axios.post('/api/auth/reset-data', { confirmPassword: password });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Todos los datos han sido eliminados exitosamente');
      setResetDataDialogOpen(false);
      // Refresh all queries to show empty state
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al limpiar los datos');
    },
  });

  const handleProfileUpdate = (data: UserProfile) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordUpdate = (data: any) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    updateNotificationsMutation.mutate({
      ...settings?.notifications,
      [key]: value,
    });
  };

  const handlePrivacyChange = (key: string, value: boolean) => {
    updatePrivacyMutation.mutate({
      ...settings?.privacy,
      [key]: value,
    });
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    // Update in the UI immediately
    setThemePreference(newTheme);
    
    // Persist to the backend
    updateProfileMutation.mutate({ theme: newTheme });
  };

  const handlePreferenceChange = (key: string, value: any) => {
    // Update density in UI immediately if it's the density setting
    if (key === 'density') {
      setDensity(value);
    }
    
    updateProfileMutation.mutate({
      preferences: {
        ...settings?.preferences,
        [key]: value,
      },
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Configuración
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>Cargando configuración...</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Configuración
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Perfil" icon={<PersonIcon />} iconPosition="start" />
          <Tab label="Seguridad" icon={<SecurityIcon />} iconPosition="start" />
          <Tab label="Notificaciones" icon={<NotificationsIcon />} iconPosition="start" />
          <Tab label="Apariencia" icon={<PaletteIcon />} iconPosition="start" />
          <Tab label="Privacidad" icon={<LockIcon />} iconPosition="start" />
          <Tab label="Datos" icon={<BackupIcon />} iconPosition="start" />
        </Tabs>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Información Personal</Typography>
              <Button
                variant={editMode ? 'contained' : 'outlined'}
                startIcon={editMode ? <SaveIcon /> : <EditIcon />}
                onClick={() => {
                  if (editMode) {
                    handleProfileSubmit(handleProfileUpdate)();
                  } else {
                    setEditMode(true);
                  }
                }}
              >
                {editMode ? 'Guardar' : 'Editar'}
              </Button>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Avatar
                    sx={{ width: 120, height: 120, mb: 2 }}
                  >
                    {user?.username?.[0]?.toUpperCase()}
                  </Avatar>
                  <Typography variant="h6">{user?.username}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                  <Chip
                    label="Cuenta Activa"
                    color="success"
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={8}>
                <form>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="username"
                        control={profileControl}
                        defaultValue={settings?.username || ''}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Nombre de usuario"
                            fullWidth
                            disabled={!editMode}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PersonIcon />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="email"
                        control={profileControl}
                        defaultValue={settings?.email || ''}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Correo electrónico"
                            type="email"
                            fullWidth
                            disabled={!editMode}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EmailIcon />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Controller
                        name="fullName"
                        control={profileControl}
                        defaultValue={settings?.fullName || ''}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Nombre completo"
                            fullWidth
                            disabled={!editMode}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="phone"
                        control={profileControl}
                        defaultValue={settings?.phone || ''}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Teléfono"
                            fullWidth
                            disabled={!editMode}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PhoneIcon />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="currency"
                        control={profileControl}
                        defaultValue={settings?.currency || 'PEN'}
                        render={({ field }) => (
                          <FormControl fullWidth disabled={!editMode}>
                            <InputLabel>Moneda</InputLabel>
                            <Select {...field} label="Moneda">
                              <MenuItem value="PEN">PEN - Sol Peruano</MenuItem>
                              <MenuItem value="USD">USD - Dólar</MenuItem>
                              <MenuItem value="EUR">EUR - Euro</MenuItem>
                              <MenuItem value="MXN">MXN - Peso Mexicano</MenuItem>
                              <MenuItem value="COP">COP - Peso Colombiano</MenuItem>
                              <MenuItem value="ARS">ARS - Peso Argentino</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="language"
                        control={profileControl}
                        defaultValue={settings?.language || 'es'}
                        render={({ field }) => (
                          <FormControl fullWidth disabled={!editMode}>
                            <InputLabel>Idioma</InputLabel>
                            <Select {...field} label="Idioma">
                              <MenuItem value="es">Español</MenuItem>
                              <MenuItem value="en">English</MenuItem>
                              <MenuItem value="pt">Português</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="timezone"
                        control={profileControl}
                        defaultValue={settings?.timezone || 'America/Lima'}
                        render={({ field }) => (
                          <FormControl fullWidth disabled={!editMode}>
                            <InputLabel>Zona horaria</InputLabel>
                            <Select {...field} label="Zona horaria">
                              <MenuItem value="America/Lima">Lima (GMT-5)</MenuItem>
                              <MenuItem value="America/Mexico_City">Ciudad de México (GMT-6)</MenuItem>
                              <MenuItem value="America/Bogota">Bogotá (GMT-5)</MenuItem>
                              <MenuItem value="America/Buenos_Aires">Buenos Aires (GMT-3)</MenuItem>
                              <MenuItem value="America/New_York">Nueva York (GMT-5)</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>
                  </Grid>
                </form>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Seguridad de la Cuenta
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <LockIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Contraseña"
                  secondary="Última actualización: hace 30 días"
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    onClick={() => setPasswordDialogOpen(true)}
                  >
                    Cambiar
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemIcon>
                  <SecurityIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Autenticación de dos factores"
                  secondary="Añade una capa extra de seguridad"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    disabled
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemIcon>
                  <TimeIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Sesiones activas"
                  secondary="Gestiona tus sesiones activas"
                />
                <ListItemSecondaryAction>
                  <Button variant="outlined">
                    Ver sesiones
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                Mantén tu cuenta segura usando una contraseña fuerte y única.
                Nunca compartas tus credenciales con nadie.
              </Typography>
            </Alert>
          </Box>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Preferencias de Notificación
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.notifications?.email || false}
                    onChange={(e) => handleNotificationChange('email', e.target.checked)}
                  />
                }
                label="Notificaciones por correo"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.notifications?.push || false}
                    onChange={(e) => handleNotificationChange('push', e.target.checked)}
                  />
                }
                label="Notificaciones push"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.notifications?.budgetAlerts || false}
                    onChange={(e) => handleNotificationChange('budgetAlerts', e.target.checked)}
                  />
                }
                label="Alertas de presupuesto"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.notifications?.transactionAlerts || false}
                    onChange={(e) => handleNotificationChange('transactionAlerts', e.target.checked)}
                  />
                }
                label="Alertas de transacciones"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.notifications?.weeklyReport || false}
                    onChange={(e) => handleNotificationChange('weeklyReport', e.target.checked)}
                  />
                }
                label="Reporte semanal"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.notifications?.monthlyReport || false}
                    onChange={(e) => handleNotificationChange('monthlyReport', e.target.checked)}
                  />
                }
                label="Reporte mensual"
              />
            </FormGroup>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Horario de Notificaciones
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Hora de inicio"
                  type="time"
                  fullWidth
                  defaultValue="09:00"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Hora de fin"
                  type="time"
                  fullWidth
                  defaultValue="21:00"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Appearance Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tema de la Aplicación
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: settings?.theme === 'light' ? 2 : 0,
                    borderColor: 'primary.main',
                  }}
                  onClick={() => handleThemeChange('light')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <LightModeIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography>Claro</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: settings?.theme === 'dark' ? 2 : 0,
                    borderColor: 'primary.main',
                  }}
                  onClick={() => handleThemeChange('dark')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <DarkModeIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography>Oscuro</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: settings?.theme === 'auto' ? 2 : 0,
                    borderColor: 'primary.main',
                  }}
                  onClick={() => handleThemeChange('auto')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <PublicIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography>Automático</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Formato de Fecha
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Formato</InputLabel>
              <Select
                value={settings?.dateFormat || 'DD/MM/YYYY'}
                label="Formato"
              >
                <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</MenuItem>
                <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</MenuItem>
                <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="h6" gutterBottom>
              Densidad de la Interfaz
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Densidad</InputLabel>
              <Select
                value={settings?.preferences?.density || density || 'comfortable'}
                onChange={(e) => handlePreferenceChange('density', e.target.value)}
                label="Densidad"
              >
                <MenuItem value="compact">Compacta</MenuItem>
                <MenuItem value="comfortable">Cómoda</MenuItem>
                <MenuItem value="spacious">Espaciosa</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Botón de Pago Rápido Flotante
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.preferences?.showFloatingQuickPayment ?? true}
                    onChange={(e) => handlePreferenceChange('showFloatingQuickPayment', e.target.checked)}
                    color="secondary"
                  />
                }
                label="Mostrar botón flotante de pago rápido"
              />
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1, ml: 5 }}>
                Muestra un botón flotante en todas las páginas para registrar pagos rápidamente
              </Typography>
            </Box>
            
            <FormControl 
              fullWidth 
              disabled={!settings?.preferences?.showFloatingQuickPayment}
              sx={{ opacity: settings?.preferences?.showFloatingQuickPayment ? 1 : 0.5 }}
            >
              <InputLabel>Posición del botón</InputLabel>
              <Select
                value={settings?.preferences?.floatingButtonPosition || 'bottom-right'}
                onChange={(e) => handlePreferenceChange('floatingButtonPosition', e.target.value)}
                label="Posición del botón"
                startAdornment={<FlashOnIcon sx={{ mr: 1, color: 'secondary.main' }} />}
              >
                <MenuItem value="bottom-right">Abajo a la derecha</MenuItem>
                <MenuItem value="bottom-left">Abajo a la izquierda</MenuItem>
                <MenuItem value="top-right">Arriba a la derecha</MenuItem>
                <MenuItem value="top-left">Arriba a la izquierda</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </TabPanel>

        {/* Privacy Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuración de Privacidad
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.privacy?.profileVisible || false}
                    onChange={(e) => handlePrivacyChange('profileVisible', e.target.checked)}
                  />
                }
                label="Perfil visible para otros usuarios"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.privacy?.showEmail || false}
                    onChange={(e) => handlePrivacyChange('showEmail', e.target.checked)}
                  />
                }
                label="Mostrar correo electrónico en el perfil"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings?.privacy?.showStats || false}
                    onChange={(e) => handlePrivacyChange('showStats', e.target.checked)}
                  />
                }
                label="Compartir estadísticas con miembros del hogar"
              />
            </FormGroup>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom color="error">
              Zona de Peligro
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <DeleteIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Eliminar cuenta"
                  secondary="Esta acción no se puede deshacer"
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Eliminar
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Box>
        </TabPanel>

        {/* Data Tab */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Gestión de Datos
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ExportIcon sx={{ mr: 2 }} />
                      <Typography variant="h6">Exportar Datos</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Descarga todos tus datos financieros en el formato que prefieras.
                    </Typography>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => setExportDialogOpen(true)}
                    >
                      Exportar
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ImportIcon sx={{ mr: 2 }} />
                      <Typography variant="h6">Importar Datos</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Importa datos desde otro sistema o desde un respaldo anterior.
                    </Typography>
                    <Button
                      variant="contained"
                      fullWidth
                      disabled
                    >
                      Importar (Próximamente)
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <DeleteIcon sx={{ mr: 2, color: 'error.main' }} />
                      <Typography variant="h6" color="error">Limpiar Todos los Datos</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Elimina permanentemente todos tus datos (pagos, transacciones, presupuestos) y comienza de nuevo. 
                      Esta acción no puede deshacerse.
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      fullWidth
                      onClick={() => setResetDataDialogOpen(true)}
                    >
                      Limpiar Todos los Datos
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Tus datos están seguros y respaldados automáticamente cada 24 horas.
                    Última copia de seguridad: {new Date().toLocaleDateString()}
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Paper>

      {/* Password Change Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cambiar Contraseña</DialogTitle>
        <DialogContent>
          <form onSubmit={handlePasswordSubmit(handlePasswordUpdate)}>
            <Controller
              name="currentPassword"
              control={passwordControl}
              rules={{ required: 'Contraseña actual requerida' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Contraseña actual"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword?.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
            <Controller
              name="newPassword"
              control={passwordControl}
              rules={{
                required: 'Nueva contraseña requerida',
                minLength: {
                  value: 8,
                  message: 'La contraseña debe tener al menos 8 caracteres',
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Nueva contraseña"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword?.message}
                />
              )}
            />
            <Controller
              name="confirmPassword"
              control={passwordControl}
              rules={{
                required: 'Confirma la nueva contraseña',
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Confirmar nueva contraseña"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword?.message}
                />
              )}
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordSubmit(handlePasswordUpdate)}
          >
            Cambiar Contraseña
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Data Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Exportar Datos</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Selecciona el formato en el que deseas exportar tus datos:
          </Typography>
          <List>
            <ListItem
              button
              onClick={() => exportDataMutation.mutate('json')}
            >
              <ListItemIcon>
                <ExportIcon />
              </ListItemIcon>
              <ListItemText
                primary="JSON"
                secondary="Formato de intercambio de datos"
              />
            </ListItem>
            <ListItem
              button
              onClick={() => exportDataMutation.mutate('csv')}
            >
              <ListItemIcon>
                <ExportIcon />
              </ListItemIcon>
              <ListItemText
                primary="CSV"
                secondary="Compatible con Excel y hojas de cálculo"
              />
            </ListItem>
            <ListItem
              button
              onClick={() => exportDataMutation.mutate('excel')}
            >
              <ListItemIcon>
                <ExportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Excel"
                secondary="Archivo .xlsx con múltiples hojas"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle color="error">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1 }} />
            Eliminar Cuenta
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Esta acción es permanente y no se puede deshacer.
          </Alert>
          <Typography variant="body2">
            Al eliminar tu cuenta:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CancelIcon color="error" />
              </ListItemIcon>
              <ListItemText primary="Se eliminarán todos tus datos financieros" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CancelIcon color="error" />
              </ListItemIcon>
              <ListItemText primary="Perderás acceso a todos los hogares compartidos" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CancelIcon color="error" />
              </ListItemIcon>
              <ListItemText primary="No podrás recuperar tu información" />
            </ListItem>
          </List>
          <TextField
            label="Escribe 'ELIMINAR' para confirmar"
            fullWidth
            margin="normal"
            onChange={(e) => {
              if (e.target.value === 'ELIMINAR') {
                // Enable delete button
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteAccountMutation.mutate()}
            disabled
          >
            Eliminar Cuenta
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Data Dialog */}
      <Dialog
        open={resetDataDialogOpen}
        onClose={() => setResetDataDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle color="error">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1 }} />
            Limpiar Todos los Datos
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>¡Advertencia!</strong> Esta acción eliminará permanentemente:
            </Typography>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Todos los pagos y calendarios de pago</li>
              <li>Todas las transacciones</li>
              <li>Todos los presupuestos (semanales y principales)</li>
              <li>Todas las notificaciones</li>
              <li>Datos compartidos en hogares</li>
            </ul>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Esta acción <strong>NO</strong> puede deshacerse.
            </Typography>
          </Alert>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const password = formData.get('password') as string;
            resetDataMutation.mutate(password);
          }}>
            <TextField
              name="password"
              label="Ingresa tu contraseña para confirmar"
              type="password"
              fullWidth
              margin="normal"
              required
              autoComplete="current-password"
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDataDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const form = document.querySelector('form');
              form?.requestSubmit();
            }}
            disabled={resetDataMutation.isPending}
            startIcon={resetDataMutation.isPending ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {resetDataMutation.isPending ? 'Limpiando...' : 'Limpiar Todos los Datos'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;