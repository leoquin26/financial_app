import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

// Use environment variable for production, fallback to localhost for development
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      const socketUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
      const isProduction = process.env.NODE_ENV === 'production';
      
      const newSocket = io(socketUrl, {
        // Use websocket only in production to avoid polling
        transports: isProduction ? ['websocket'] : ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        // Production optimizations
        ...(isProduction && {
          upgrade: false, // Don't try to upgrade in production
          rememberUpgrade: false,
          // Longer intervals in production
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
        }),
        // Development settings
        ...(!isProduction && {
          upgrade: true,
          rememberUpgrade: true,
        }),
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        newSocket.emit('join-user-room', user.id);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });
      
      // Handle connection errors
      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        // In production, this often indicates websocket issues
        if (process.env.NODE_ENV === 'production' && error.type === 'TransportError') {
          console.warn('WebSocket connection failed. Check Railway websocket support.');
        }
      });
      
      // Handle rate limit and other errors
      newSocket.on('error', (error: any) => {
        console.error('Socket error:', error);
        if (error?.data?.code === 'RATE_LIMIT_EXCEEDED') {
          console.warn('Rate limit exceeded:', error.data.message);
        }
      });

      // Listen for real-time updates
      newSocket.on('transaction-created', (data) => {
        toast.success('Nueva transacción agregada');
      });

      newSocket.on('transaction-updated', (data) => {
        toast('Transacción actualizada', {
          icon: '📝',
        });
      });

      newSocket.on('transaction-deleted', (data) => {
        toast('Transacción eliminada', {
          icon: '🗑️',
        });
      });

      newSocket.on('budget-alert', (data) => {
        toast.error(
          `¡Alerta de presupuesto! Has gastado ${data.percentage.toFixed(0)}% de tu presupuesto de ${data.categoryName}`,
          { duration: 6000 }
        );
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });

      newSocket.on('budget-updated', (data) => {
        toast.success('Presupuesto actualizado');
      });

      newSocket.on('category-updated', (data) => {
        toast('Categoría actualizada', {
          icon: '📁',
        });
      });

      newSocket.on('new-notification', (notification) => {
        // Show toast based on notification type
        const icon = notification.type === 'budget_alert' ? '⚠️' : 
                     notification.type === 'goal_achieved' ? '🎉' : 
                     notification.type === 'transaction' ? '💰' : 'ℹ️';
        
        toast(notification.message, {
          icon: icon,
          duration: 5000
        });
        
        // Refetch notifications to update badge count
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
