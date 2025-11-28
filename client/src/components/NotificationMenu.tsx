import React, { useState, useEffect } from 'react';
import {
    IconButton,
    Badge,
    Menu,
    MenuItem,
    Box,
    Typography,
    Divider,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip,
    CircularProgress,
    Alert,
    Tooltip
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    NotificationsNone,
    Warning,
    TrendingUp,
    CheckCircle,
    Info,
    Delete,
    DoneAll,
    Clear,
    Error,
    CalendarToday,
    Assessment,
    Settings
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
    _id?: string;
    id?: number;
    type: string;
    title: string;
    message: string;
    data: any;
    is_read?: number;
    isRead?: boolean;
    created_at?: string;
    createdAt?: string;
    priority?: string;
    actionUrl?: string;
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

const getPriorityColor = (priority?: string) => {
    switch (priority) {
        case 'urgent':
            return '#ef4444';
        case 'high':
            return '#f59e0b';
        case 'normal':
            return '#3b82f6';
        default:
            return '#6b7280';
    }
};

const NotificationMenu: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const open = Boolean(anchorEl);

    // Fetch notifications
    const { data, isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const response = await axios.get('/api/notifications');
            return response.data;
        },
        refetchInterval: 30000 // Refetch every 30 seconds
    });

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string | number) => {
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
        mutationFn: async (id: string | number) => {
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
            handleClose();
        }
    });

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationClick = (notification: Notification) => {
        const isRead = notification.isRead || notification.is_read;
        if (!isRead) {
            const notificationId = notification._id || notification.id;
            if (notificationId) {
                markAsReadMutation.mutate(notificationId);
            }
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
                    targetUrl = '/notifications';
            }
        }
        
        handleClose();
        navigate(targetUrl);
    };

    const handleSettingsClick = () => {
        handleClose();
        navigate('/settings?tab=notifications');
    };

    const notifications = data?.notifications || [];
    const unreadCount = notifications.filter((n: Notification) => !n.isRead && !n.is_read).length;

    return (
        <>
            <IconButton
                color="inherit"
                onClick={handleClick}
                aria-label={`${unreadCount} notificaciones nuevas`}
            >
                <Badge badgeContent={unreadCount} color="error">
                    {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNone />}
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        width: 400,
                        maxHeight: 500,
                        overflow: 'hidden'
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Notificaciones</Typography>
                    {unreadCount > 0 && (
                        <Chip 
                            label={`${unreadCount} nueva${unreadCount > 1 ? 's' : ''}`} 
                            size="small" 
                            color="primary" 
                        />
                    )}
                </Box>
                
                <Divider />

                <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                    <Box display="flex" gap={1}>
                        {notifications.length > 0 && (
                            <>
                                <Button
                                    size="small"
                                    startIcon={<DoneAll />}
                                    onClick={() => markAllAsReadMutation.mutate()}
                                    disabled={unreadCount === 0}
                                >
                                    Marcar leídas
                                </Button>
                                <Button
                                    size="small"
                                    startIcon={<Clear />}
                                    onClick={() => clearAllMutation.mutate()}
                                    color="error"
                                >
                                    Limpiar
                                </Button>
                            </>
                        )}
                    </Box>
                    <Tooltip title="Configurar notificaciones">
                        <IconButton size="small" onClick={handleSettingsClick}>
                            <Settings fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Divider />

                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={30} />
                        </Box>
                    ) : notifications.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <NotificationsNone sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                            <Typography color="text.secondary">
                                No tienes notificaciones
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ p: 0 }}>
                            <AnimatePresence>
                                {notifications.map((notification: Notification) => (
                                    <motion.div
                                        key={notification._id || notification.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ListItem
                                            button
                                            onClick={() => handleNotificationClick(notification)}
                                            sx={{
                                                backgroundColor: (notification.isRead || notification.is_read) ? 'transparent' : 'action.hover',
                                                borderLeft: notification.priority ? `3px solid ${getPriorityColor(notification.priority)}` : 'none',
                                                '&:hover': {
                                                    backgroundColor: 'action.selected'
                                                }
                                            }}
                                        >
                                            <ListItemIcon>
                                                {getNotificationIcon(notification.type)}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: (notification.isRead || notification.is_read) ? 'normal' : 'bold'
                                                        }}
                                                    >
                                                        {notification.title}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <>
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            color="text.primary"
                                                            sx={{ display: 'block', mb: 0.5 }}
                                                        >
                                                            {notification.message}
                                                        </Typography>
                                                        <Typography
                                                            component="span"
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            {(() => {
                                                                const dateStr = notification.createdAt || notification.created_at;
                                                                if (!dateStr) return '';
                                                                try {
                                                                    return formatDistanceToNow(new Date(dateStr), {
                                                                        addSuffix: true,
                                                                        locale: es
                                                                    });
                                                                } catch (error) {
                                                                    return 'Reciente';
                                                                }
                                                            })()}
                                                        </Typography>
                                                    </>
                                                }
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const notificationId = notification._id || notification.id;
                                                    if (notificationId) {
                                                        deleteNotificationMutation.mutate(notificationId);
                                                    }
                                                }}
                                                sx={{ ml: 1 }}
                                            >
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </ListItem>
                                        <Divider />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </List>
                    )}
                </Box>
            </Menu>
        </>
    );
};

export default NotificationMenu;
