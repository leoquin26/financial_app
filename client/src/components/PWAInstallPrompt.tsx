import React, { useState, useEffect } from 'react';
import {
  Button,
  Snackbar,
  Alert,
  IconButton,
  Box,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  GetApp as GetAppIcon,
  Close as CloseIcon,
  PhoneIphone as PhoneIcon
} from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  
  interface Navigator {
    standalone?: boolean;
  }
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !(window.navigator as any).standalone) {
      // Show iOS install instructions after a delay
      setTimeout(() => {
        const hasSeenIOSPrompt = localStorage.getItem('hasSeenIOSPrompt');
        if (!hasSeenIOSPrompt) {
          setShowIOSPrompt(true);
        }
      }, 3000);
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after a delay if user hasn't seen it
      const hasSeenPrompt = localStorage.getItem('hasSeenInstallPrompt');
      if (!hasSeenPrompt && isMobile) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isMobile]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('hasSeenInstallPrompt', 'true');
  };

  const handleClosePrompt = () => {
    setShowPrompt(false);
    localStorage.setItem('hasSeenInstallPrompt', 'true');
  };

  const handleCloseIOSPrompt = () => {
    setShowIOSPrompt(false);
    localStorage.setItem('hasSeenIOSPrompt', 'true');
  };

  // Don't show anything if already installed
  if (isInstalled) return null;

  // iOS Install Instructions
  if (showIOSPrompt) {
    return (
      <Snackbar
        open={showIOSPrompt}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleCloseIOSPrompt}
      >
        <Alert
          severity="info"
          icon={<PhoneIcon />}
          action={
            <IconButton size="small" onClick={handleCloseIOSPrompt}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{
            maxWidth: 400,
            '& .MuiAlert-message': { width: '100%' }
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Install Financial App
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Tap <strong>Share</strong> button and then <strong>"Add to Home Screen"</strong>
          </Typography>
        </Alert>
      </Snackbar>
    );
  }

  // Android/Desktop Install Prompt
  return (
    <Snackbar
      open={showPrompt && !!deferredPrompt}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={handleClosePrompt}
    >
      <Alert
        severity="info"
        icon={<GetAppIcon />}
        sx={{
          maxWidth: 400,
          '& .MuiAlert-message': { width: '100%' }
        }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Install Financial App
          </Typography>
          <Typography variant="caption" display="block" sx={{ mb: 2 }}>
            Install our app for a better experience with offline access and faster loading
          </Typography>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button size="small" onClick={handleClosePrompt}>
              Not Now
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleInstallClick}
              startIcon={<GetAppIcon />}
            >
              Install
            </Button>
          </Box>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default PWAInstallPrompt;
