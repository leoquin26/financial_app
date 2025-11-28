import React, { useEffect, useState, useCallback } from 'react';
import {
    Snackbar,
    Alert,
    AlertTitle,
    Box,
    Typography,
    IconButton,
    Slide,
    SlideProps,
    Badge
} from '@mui/material';
import {
    Close,
    Warning,
    CheckCircle,
    Info,
    Error,
    TrendingUp,
    CalendarToday,
    Assessment,
    Notifications
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    actionUrl?: string;
    createdAt: string;
}

interface NotificationToastProps {
    maxVisible?: number;
    autoHideDuration?: number;
}

function SlideTransition(props: SlideProps) {
    return <Slide {...props} direction="left" />;
}

const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'budget_alert':
        case 'budget_exceeded':
            return <Warning />;
        case 'success':
        case 'goal_achieved':
        case 'payment_paid':
            return <CheckCircle />;
        case 'error':
        case 'payment_overdue':
            return <Error />;
        case 'transaction':
            return <TrendingUp />;
        case 'payment_reminder':
            return <CalendarToday />;
        case 'weekly_report':
        case 'monthly_report':
            return <Assessment />;
        default:
            return <Info />;
    }
};

const getNotificationSeverity = (type: string, priority?: string): 'success' | 'info' | 'warning' | 'error' => {
    if (priority === 'urgent') return 'error';
    if (priority === 'high') return 'warning';
    
    switch (type) {
        case 'success':
        case 'goal_achieved':
        case 'payment_paid':
            return 'success';
        case 'error':
        case 'payment_overdue':
        case 'budget_exceeded':
            return 'error';
        case 'warning':
        case 'budget_alert':
            return 'warning';
        default:
            return 'info';
    }
};

const NotificationToast: React.FC<NotificationToastProps> = ({ 
    maxVisible = 3,
    autoHideDuration = 6000 
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Connect to socket
    useEffect(() => {
        if (!user?.id) return;

        const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const newSocket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        newSocket.on('connect', () => {
            console.log('NotificationToast: Socket connected');
            // Join user room for notifications
            newSocket.emit('join-user-room', user.id);
        });

        newSocket.on('new-notification', (notification: Notification) => {
            console.log('New notification received:', notification);
            
            // Add to toast queue
            setNotifications(prev => {
                const newNotifications = [notification, ...prev].slice(0, maxVisible);
                return newNotifications;
            });

            // Invalidate notifications query to update the menu
            queryClient.invalidateQueries({ queryKey: ['notifications'] });

            // Play notification sound for high priority
            if (notification.priority === 'urgent' || notification.priority === 'high') {
                playNotificationSound();
            }
        });

        newSocket.on('disconnect', () => {
            console.log('NotificationToast: Socket disconnected');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user?.id, maxVisible, queryClient]);

    // Play notification sound
    const playNotificationSound = useCallback(() => {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);
        } catch (error) {
            console.log('Could not play notification sound');
        }
    }, []);

    // Handle notification close
    const handleClose = (notificationId: string) => {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
    };

    // Handle notification click
    const handleClick = (notification: Notification) => {
        if (notification.actionUrl) {
            navigate(notification.actionUrl);
        }
        handleClose(notification._id);
    };

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 80,
                right: 16,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                maxWidth: 400,
                width: '100%',
                pointerEvents: 'none'
            }}
        >
            {notifications.map((notification, index) => (
                <Snackbar
                    key={notification._id}
                    open={true}
                    autoHideDuration={autoHideDuration}
                    onClose={() => handleClose(notification._id)}
                    TransitionComponent={SlideTransition}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    sx={{
                        position: 'relative',
                        transform: 'none !important',
                        top: 'auto !important',
                        right: 'auto !important',
                        left: 'auto !important',
                        bottom: 'auto !important',
                        pointerEvents: 'auto'
                    }}
                >
                    <Alert
                        severity={getNotificationSeverity(notification.type, notification.priority)}
                        icon={getNotificationIcon(notification.type)}
                        onClose={() => handleClose(notification._id)}
                        onClick={() => handleClick(notification)}
                        sx={{
                            width: '100%',
                            cursor: notification.actionUrl ? 'pointer' : 'default',
                            boxShadow: 3,
                            '& .MuiAlert-message': {
                                width: '100%'
                            },
                            animation: notification.priority === 'urgent' ? 'pulse 1s ease-in-out infinite' : 'none',
                            '@keyframes pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.8 }
                            }
                        }}
                    >
                        <AlertTitle sx={{ fontWeight: 600 }}>
                            {notification.title}
                        </AlertTitle>
                        <Typography variant="body2" sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                        }}>
                            {notification.message}
                        </Typography>
                        {notification.actionUrl && (
                            <Typography 
                                variant="caption" 
                                color="primary"
                                sx={{ mt: 0.5, display: 'block' }}
                            >
                                Click para ver más →
                            </Typography>
                        )}
                    </Alert>
                </Snackbar>
            ))}
        </Box>
    );
};

export default NotificationToast;

