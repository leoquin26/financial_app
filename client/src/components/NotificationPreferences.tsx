import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    Divider,
    Button,
    Alert,
    CircularProgress,
    Tooltip,
    IconButton,
    Collapse,
    Chip
} from '@mui/material';
import {
    Email,
    Notifications,
    NotificationsActive,
    Warning,
    TrendingUp,
    CalendarMonth,
    Assessment,
    Info,
    ExpandMore,
    ExpandLess,
    Send
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface NotificationSettings {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    transactionAlerts: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
}

const NotificationPreferences: React.FC = () => {
    const queryClient = useQueryClient();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [testEmailStatus, setTestEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch current preferences
    const { data, isLoading, error } = useQuery({
        queryKey: ['notificationPreferences'],
        queryFn: async () => {
            const response = await axios.get('/api/notifications/preferences');
            return response.data;
        }
    });

    // Update preferences mutation
    const updateMutation = useMutation({
        mutationFn: async (notifications: NotificationSettings) => {
            const response = await axios.put('/api/notifications/preferences', { notifications });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
        }
    });

    // Test email mutation
    const testEmailMutation = useMutation({
        mutationFn: async (template: string) => {
            const response = await axios.post('/api/notifications/test-email', { template });
            return response.data;
        },
        onSuccess: () => {
            setTestEmailStatus({ type: 'success', message: 'Email de prueba enviado correctamente' });
            setTimeout(() => setTestEmailStatus(null), 5000);
        },
        onError: (error: any) => {
            setTestEmailStatus({ 
                type: 'error', 
                message: error.response?.data?.error || 'Error al enviar email de prueba' 
            });
            setTimeout(() => setTestEmailStatus(null), 5000);
        }
    });

    const handleToggle = (key: keyof NotificationSettings) => {
        if (!data?.notifications) return;
        
        const newSettings = {
            ...data.notifications,
            [key]: !data.notifications[key]
        };
        
        updateMutation.mutate(newSettings);
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Error al cargar las preferencias de notificación
            </Alert>
        );
    }

    const settings = data?.notifications || {
        email: true,
        push: true,
        budgetAlerts: true,
        transactionAlerts: true,
        weeklyReport: false,
        monthlyReport: true
    };

    const notificationOptions = [
        {
            key: 'email' as keyof NotificationSettings,
            label: 'Notificaciones por Email',
            description: 'Recibe alertas importantes en tu correo electrónico',
            icon: <Email color="primary" />,
            category: 'general'
        },
        {
            key: 'push' as keyof NotificationSettings,
            label: 'Notificaciones en la App',
            description: 'Recibe notificaciones en tiempo real dentro de la aplicación',
            icon: <NotificationsActive color="primary" />,
            category: 'general'
        },
        {
            key: 'budgetAlerts' as keyof NotificationSettings,
            label: 'Alertas de Presupuesto',
            description: 'Notificaciones cuando te acercas o excedes tu presupuesto',
            icon: <Warning color="warning" />,
            category: 'alerts'
        },
        {
            key: 'transactionAlerts' as keyof NotificationSettings,
            label: 'Alertas de Transacciones',
            description: 'Notificaciones para nuevas transacciones registradas',
            icon: <TrendingUp color="success" />,
            category: 'alerts'
        },
        {
            key: 'weeklyReport' as keyof NotificationSettings,
            label: 'Resumen Semanal',
            description: 'Recibe un resumen de tus finanzas cada lunes',
            icon: <CalendarMonth color="info" />,
            category: 'reports'
        },
        {
            key: 'monthlyReport' as keyof NotificationSettings,
            label: 'Resumen Mensual',
            description: 'Recibe un análisis completo de tus finanzas cada mes',
            icon: <Assessment color="secondary" />,
            category: 'reports'
        }
    ];

    const generalOptions = notificationOptions.filter(o => o.category === 'general');
    const alertOptions = notificationOptions.filter(o => o.category === 'alerts');
    const reportOptions = notificationOptions.filter(o => o.category === 'reports');

    return (
        <Box>
            {testEmailStatus && (
                <Alert 
                    severity={testEmailStatus.type} 
                    sx={{ mb: 2 }}
                    onClose={() => setTestEmailStatus(null)}
                >
                    {testEmailStatus.message}
                </Alert>
            )}

            {/* General Notifications */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Notifications color="primary" />
                        <Typography variant="h6">Canales de Notificación</Typography>
                    </Box>
                    
                    {generalOptions.map((option, index) => (
                        <React.Fragment key={option.key}>
                            <Box 
                                display="flex" 
                                justifyContent="space-between" 
                                alignItems="center"
                                py={1.5}
                            >
                                <Box display="flex" alignItems="center" gap={2}>
                                    {option.icon}
                                    <Box>
                                        <Typography variant="body1" fontWeight={500}>
                                            {option.label}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.description}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Switch
                                    checked={settings[option.key]}
                                    onChange={() => handleToggle(option.key)}
                                    disabled={updateMutation.isPending}
                                />
                            </Box>
                            {index < generalOptions.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}
                </CardContent>
            </Card>

            {/* Alert Notifications */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Warning color="warning" />
                        <Typography variant="h6">Alertas</Typography>
                        <Chip label="Recomendado" size="small" color="primary" />
                    </Box>
                    
                    {alertOptions.map((option, index) => (
                        <React.Fragment key={option.key}>
                            <Box 
                                display="flex" 
                                justifyContent="space-between" 
                                alignItems="center"
                                py={1.5}
                            >
                                <Box display="flex" alignItems="center" gap={2}>
                                    {option.icon}
                                    <Box>
                                        <Typography variant="body1" fontWeight={500}>
                                            {option.label}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.description}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Switch
                                    checked={settings[option.key]}
                                    onChange={() => handleToggle(option.key)}
                                    disabled={updateMutation.isPending || !settings.email && !settings.push}
                                />
                            </Box>
                            {index < alertOptions.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}

                    {!settings.email && !settings.push && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Activa al menos un canal de notificación para recibir alertas
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Report Notifications */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Assessment color="secondary" />
                        <Typography variant="h6">Reportes Automáticos</Typography>
                    </Box>
                    
                    {reportOptions.map((option, index) => (
                        <React.Fragment key={option.key}>
                            <Box 
                                display="flex" 
                                justifyContent="space-between" 
                                alignItems="center"
                                py={1.5}
                            >
                                <Box display="flex" alignItems="center" gap={2}>
                                    {option.icon}
                                    <Box>
                                        <Typography variant="body1" fontWeight={500}>
                                            {option.label}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.description}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Switch
                                    checked={settings[option.key]}
                                    onChange={() => handleToggle(option.key)}
                                    disabled={updateMutation.isPending || !settings.email}
                                />
                            </Box>
                            {index < reportOptions.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}

                    {!settings.email && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Los reportes se envían por email. Activa las notificaciones por email para recibirlos.
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Advanced Options */}
            <Card>
                <CardContent>
                    <Box 
                        display="flex" 
                        alignItems="center" 
                        justifyContent="space-between"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        sx={{ cursor: 'pointer' }}
                    >
                        <Box display="flex" alignItems="center" gap={1}>
                            <Info color="info" />
                            <Typography variant="h6">Opciones Avanzadas</Typography>
                        </Box>
                        <IconButton size="small">
                            {showAdvanced ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                    </Box>

                    <Collapse in={showAdvanced}>
                        <Box mt={2}>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Prueba las notificaciones por email para verificar que todo funcione correctamente.
                            </Typography>

                            <Box display="flex" gap={2} flexWrap="wrap">
                                <Button
                                    variant="outlined"
                                    startIcon={testEmailMutation.isPending ? <CircularProgress size={16} /> : <Send />}
                                    onClick={() => testEmailMutation.mutate('paymentReminder')}
                                    disabled={testEmailMutation.isPending || !settings.email}
                                    size="small"
                                >
                                    Probar Recordatorio
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={testEmailMutation.isPending ? <CircularProgress size={16} /> : <Send />}
                                    onClick={() => testEmailMutation.mutate('budgetAlert')}
                                    disabled={testEmailMutation.isPending || !settings.email}
                                    size="small"
                                >
                                    Probar Alerta
                                </Button>
                            </Box>

                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    <strong>Horarios de notificaciones:</strong>
                                </Typography>
                                <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
                                    <li>Recordatorios de pago: 8:00 AM (hora de Lima)</li>
                                    <li>Alertas de pagos vencidos: 9:00 AM</li>
                                    <li>Alertas de presupuesto: Cada 6 horas</li>
                                    <li>Resumen semanal: Lunes 8:00 AM</li>
                                </Typography>
                            </Alert>
                        </Box>
                    </Collapse>
                </CardContent>
            </Card>
        </Box>
    );
};

export default NotificationPreferences;

