import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  showCloseButton?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  transitionType?: 'slide' | 'fade' | 'none';
  icon?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  showCloseButton = true,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  icon,
  noPadding = false,
  className,
}) => {
  const handleClose = (event: {}, reason: "backdropClick" | "escapeKeyDown") => {
    if (disableBackdropClick && reason === 'backdropClick') return;
    if (disableEscapeKeyDown && reason === 'escapeKeyDown') return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      className={className}
    >
      {title && (
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {icon && (
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                {icon}
              </Box>
            )}
            <Box flex={1}>
              <Typography variant="h6" component="div" fontWeight={600}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                position: 'absolute',
                right: 12,
                top: 12,
                color: 'grey.500',
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}

      <DialogContent sx={{ p: noPadding ? 0 : undefined }}>
        {children}
      </DialogContent>

      {actions && (
        <DialogActions>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default BaseModal;
