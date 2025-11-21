import React, { useEffect, useState } from 'react';
import { Snackbar, Alert, Button, Box } from '@mui/material';
import { RefreshOutlined } from '@mui/icons-material';

const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

const VersionCheck: React.FC = () => {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Get initial version
    checkVersion();

    // Set up periodic version checks
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CACHE_UPDATED') {
          console.log('Cache updated to version:', event.data.version);
          setUpdateAvailable(true);
        }
      });

      // Check for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker updated');
        setUpdateAvailable(true);
      });
    }

    return () => clearInterval(interval);
  }, []);

  const checkVersion = async () => {
    try {
      // Fetch with cache bypass to always get fresh version
      const response = await fetch('/version.json', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) return;
      
      const versionData = await response.json();
      const newVersion = versionData.buildNumber;

      if (currentVersion && currentVersion !== newVersion) {
        console.log('New version available:', newVersion);
        setUpdateAvailable(true);
      }

      setCurrentVersion(newVersion);
    } catch (error) {
      console.error('Failed to check version:', error);
    }
  };

  const handleUpdate = async () => {
    setIsRefreshing(true);

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }

    // Unregister service worker to force update
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // Force reload with cache bypass
    window.location.reload();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    // Check again in 30 minutes
    setTimeout(checkVersion, 30 * 60 * 1000);
  };

  return (
    <Snackbar
      open={updateAvailable}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={handleDismiss}
    >
      <Alert
        severity="info"
        icon={<RefreshOutlined />}
        action={
          <Box display="flex" gap={1}>
            <Button
              size="small"
              color="inherit"
              onClick={handleDismiss}
              disabled={isRefreshing}
            >
              Later
            </Button>
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              onClick={handleUpdate}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Updating...' : 'Update Now'}
            </Button>
          </Box>
        }
        sx={{ width: '100%', maxWidth: 500 }}
      >
        A new version is available! Update to get the latest features and improvements.
      </Alert>
    </Snackbar>
  );
};

export default VersionCheck;
