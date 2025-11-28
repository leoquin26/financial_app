import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    IconButton,
    Button,
    Chip,
    Divider,
    CircularProgress,
    Alert,
    Tab,
    Tabs,
    Badge,
    Menu,
    MenuItem,
    Tooltip,
    Card,
    CardContent
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    Warning,
    CheckCircle,
    Info,
    Error,
    TrendingUp,
    CalendarToday,
    Assessment,
    Delete,
    DoneAll,
    FilterList,
    Refresh,
    MoreVert,
    ArrowForward
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    data: any;
    isRead: boolean;
    priority?: string;
    actionUrl?: string;
    emailSent?: boolean;
    createdAt: string;
}

const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'budget_alert':
        case 'budget_exceeded':
            return <Warning color="warning" />;
        case 'goal_achieved':
        case 'payment_paid':
        case 'success':
            return <CheckCircle color="success" />;
        case 'transaction':
            return <TrendingUp color="primary" />;
        case 'payment_reminder':
            return <CalendarToday color="info" />;
        case 'payment_overdue':
        case 'error':
            return <Error color="error" />;
        case 'weekly_report':
        case 'monthly_report':
            return <Assessment color="secondary" />;
        default:
            return <Info color="info" />;
    }
};

const getPriorityChip = (priority?: string) => {
    switch (priority) {
        case 'urgent':
            return <Chip label="Urgente" size="small" color="error" />;
        case 'high':
            return <Chip label="Alta" size="small" color="warning" />;
        case 'normal':
            return <Chip label="Normal" size="small" color="primary" variant="outlined" />;
        default:
            return null;
    }
};

const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
        'budget_alert': 'Alerta de Presupuesto',
        'budget_exceeded': 'Presupuesto Excedido',
        'transaction': 'Transacción',
        'payment_reminder': 'Recordatorio de Pago',
        'payment_overdue': 'Pago Vencido',
        'payment_paid': 'Pago Realizado',
        'weekly_report': 'Resumen Semanal',
        'monthly_report': 'Resumen Mensual',
        'household_invite': 'Invitación a Hogar',
        'household_update': 'Actualización de Hogar',
        'goal_progress': 'Progreso de Meta',
        'goal_achieved': 'Meta Alcanzada',
        'info': 'Información',
        'warning': 'Advertencia',
        'success': 'Éxito',
        'error': 'Error'
    };
    return labels[type] || type;
};

const Notifications: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [tabValue, setTabValue] = useState(0);
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);

    // Fetch notifications
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['notifications', typeFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (tabValue === 1) params.append('isRead', 'false');
            if (tabValue === 2) params.append('isRead', 'true');
            const response = await axios.get(`/api/notifications?${params.toString()}`);
            return response.data;
        }
    });

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await axios.put(`/api/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    // Mark all as read mutation
    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await axios.put('/api/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    // Delete notification mutation
    const deleteNotificationMutation = useMutation({
        mutationFn: async (id: string) => {
            await axios.delete(`/api/notifications/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    // Clear all notifications mutation
    const clearAllMutation = useMutation({
        mutationFn: async () => {
            await axios.delete('/api/notifications');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification._id);
        }
        
        // Determine the best navigation URL based on notification type and data
        let targetUrl = notification.actionUrl;
        
        if (!targetUrl) {
            // Fallback based on notification type
            switch (notification.type) {
                case 'payment_reminder':
                case 'payment_overdue':
                case 'payment_paid':
                    targetUrl = notification.data?.weeklyBudgetId 
                        ? `/weekly-budget/${notification.data.weeklyBudgetId}`
                        : '/payments';
                    break;
                case 'budget_alert':
                case 'budget_exceeded':
                    targetUrl = notification.data?.budgetId 
                        ? `/weekly-budget/${notification.data.budgetId}`
                        : '/budgets';
                    break;
                case 'transaction':
                    targetUrl = '/transactions';
                    break;
                case 'weekly_report':
                case 'monthly_report':
                    targetUrl = '/analytics';
                    break;
                case 'household_invite':
                case 'household_update':
                    targetUrl = '/households';
                    break;
                default:
                    return; // Don't navigate for unknown types
            }
        }
        
        navigate(targetUrl);
    };

    const notifications = data?.notifications || [];
    const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

    // Filter notifications by tab and type
    const filteredNotifications = notifications.filter((n: Notification) => {
        if (tabValue === 1 && n.isRead) return false;
        if (tabValue === 2 && !n.isRead) return false;
        if (typeFilter && n.type !== typeFilter) return false;
        return true;
    });

    // Get unique notification types for filter
    const uniqueTypes = Array.from(new Set(notifications.map((n: Notification) => n.type))) as string[];

    if (isLoading) {
        return (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">Error al cargar las notificaciones</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center" gap={2}>
                    <NotificationsIcon fontSize="large" color="primary" />
                    <Typography variant="h4">
                        Notificaciones
                        {unreadCount > 0 && (
                            <Badge 
                                badgeContent={unreadCount} 
                                color="error" 
                                sx={{ ml: 2 }}
                            />
                        )}
                    </Typography>
                </Box>
                
                <Box display="flex" gap={1}>
                    <Tooltip title="Actualizar">
                        <IconButton onClick={() => refetch()}>
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Filtrar">
                        <IconButton onClick={(e) => setFilterAnchor(e.currentTarget)}>
                            <FilterList />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<DoneAll />}
                        onClick={() => markAllAsReadMutation.mutate()}
                        disabled={unreadCount === 0}
                    >
                        Marcar todas leídas
                    </Button>
                </Box>
            </Box>

            {/* Filter Menu */}
            <Menu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
            >
                <MenuItem 
                    onClick={() => { setTypeFilter(null); setFilterAnchor(null); }}
                    selected={!typeFilter}
                >
                    Todas
                </MenuItem>
                <Divider />
                {uniqueTypes.map((type) => (
                    <MenuItem
                        key={type}
                        onClick={() => { setTypeFilter(type); setFilterAnchor(null); }}
                        selected={typeFilter === type}
                    >
                        {getTypeLabel(type)}
                    </MenuItem>
                ))}
            </Menu>

            {/* Summary Cards */}
            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                <Card sx={{ minWidth: 150 }}>
                    <CardContent>
                        <Typography variant="h4" color="primary">{notifications.length}</Typography>
                        <Typography variant="body2" color="text.secondary">Total</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ minWidth: 150 }}>
                    <CardContent>
                        <Typography variant="h4" color="error">{unreadCount}</Typography>
                        <Typography variant="body2" color="text.secondary">Sin leer</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ minWidth: 150 }}>
                    <CardContent>
                        <Typography variant="h4" color="success.main">
                            {notifications.filter((n: Notification) => n.emailSent).length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">Emails enviados</Typography>
                    </CardContent>
                </Card>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 2 }}>
                <Tabs
                    value={tabValue}
                    onChange={(e, newValue) => setTabValue(newValue)}
                    variant="fullWidth"
                >
                    <Tab label="Todas" />
                    <Tab 
                        label={
                            <Badge badgeContent={unreadCount} color="error">
                                Sin leer
                            </Badge>
                        } 
                    />
                    <Tab label="Leídas" />
                </Tabs>
            </Paper>

            {/* Notifications List */}
            <Paper>
                {filteredNotifications.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            No hay notificaciones
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {tabValue === 1 ? 'Todas las notificaciones han sido leídas' : 
                             tabValue === 2 ? 'No hay notificaciones leídas' :
                             'No tienes notificaciones aún'}
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 0 }}>
                        <AnimatePresence>
                            {filteredNotifications.map((notification: Notification, index: number) => (
                                <motion.div
                                    key={notification._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <ListItem
                                        sx={{
                                            backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                                            borderLeft: notification.priority === 'urgent' ? '4px solid' : 'none',
                                            borderLeftColor: 'error.main',
                                            '&:hover': {
                                                backgroundColor: 'action.selected'
                                            }
                                        }}
                                        secondaryAction={
                                            <Box display="flex" alignItems="center" gap={1}>
                                                {notification.actionUrl && (
                                                    <Tooltip title="Ver detalles">
                                                        <IconButton 
                                                            size="small"
                                                            onClick={() => handleNotificationClick(notification)}
                                                        >
                                                            <ArrowForward />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Eliminar">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => deleteNotificationMutation.mutate(notification._id)}
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                    >
                                        <ListItemIcon>
                                            {getNotificationIcon(notification.type)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: notification.isRead ? 'normal' : 'bold'
                                                        }}
                                                    >
                                                        {notification.title}
                                                    </Typography>
                                                    {getPriorityChip(notification.priority)}
                                                    <Chip 
                                                        label={getTypeLabel(notification.type)} 
                                                        size="small" 
                                                        variant="outlined"
                                                    />
                                                    {notification.emailSent && (
                                                        <Chip 
                                                            label="Email enviado" 
                                                            size="small" 
                                                            color="success"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.primary"
                                                        sx={{ mt: 0.5 }}
                                                    >
                                                        {notification.message}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ mt: 0.5, display: 'block' }}
                                                    >
                                                        {formatDistanceToNow(new Date(notification.createdAt), {
                                                            addSuffix: true,
                                                            locale: es
                                                        })}
                                                        {' • '}
                                                        {format(new Date(notification.createdAt), 'dd/MM/yyyy HH:mm')}
                                                    </Typography>
                                                </Box>
                                            }
                                            onClick={() => {
                                                if (!notification.isRead) {
                                                    markAsReadMutation.mutate(notification._id);
                                                }
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    </ListItem>
                                    {index < filteredNotifications.length - 1 && <Divider />}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </List>
                )}
            </Paper>

            {/* Clear All Button */}
            {notifications.length > 0 && (
                <Box display="flex" justifyContent="center" mt={3}>
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => {
                            if (window.confirm('¿Estás seguro de que deseas eliminar todas las notificaciones?')) {
                                clearAllMutation.mutate();
                            }
                        }}
                    >
                        Eliminar todas las notificaciones
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default Notifications;

