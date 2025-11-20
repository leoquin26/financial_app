import React, { useState, useEffect } from 'react';
import { Alert, Slide } from '@mui/material';
import { WifiOff as WifiOffIcon } from '@mui/icons-material';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Slide direction="down" in={!isOnline} mountOnEnter unmountOnExit>
      <Alert
        severity="warning"
        icon={<WifiOffIcon />}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          borderRadius: 0,
          zIndex: 9999,
        }}
      >
        You are offline. Some features may be limited.
      </Alert>
    </Slide>
  );
};

export default OfflineIndicator;
