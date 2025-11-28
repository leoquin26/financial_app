import React from 'react';
import { Button, Typography, Box } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BaseModal from './BaseModal';

export type ConfirmModalType = 'info' | 'warning' | 'success' | 'error' | 'confirm';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  type?: ConfirmModalType;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

const getIcon = (type: ConfirmModalType) => {
  switch (type) {
    case 'warning':
      return <WarningAmberIcon sx={{ fontSize: 48, color: 'warning.main' }} />;
    case 'error':
      return <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main' }} />;
    case 'success':
      return <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'success.main' }} />;
    case 'info':
    case 'confirm':
    default:
      return <InfoOutlinedIcon sx={{ fontSize: 48, color: 'info.main' }} />;
  }
};

const getButtonColor = (type: ConfirmModalType): ConfirmModalProps['confirmButtonColor'] => {
  switch (type) {
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'success':
      return 'success';
    default:
      return 'primary';
  }
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonColor,
  loading = false,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
    if (!loading) {
      onClose();
    }
  };

  const buttonColor = confirmButtonColor || getButtonColor(type);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="xs"
      showCloseButton={false}
      disableBackdropClick={loading}
      disableEscapeKeyDown={loading}
      actions={
        <>
          <Button
            onClick={onClose}
            disabled={loading}
            variant="outlined"
            fullWidth
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            variant="contained"
            color={buttonColor}
            fullWidth
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          py: 2,
        }}
      >
        {getIcon(type)}
        <Typography
          variant="body1"
          sx={{ mt: 2 }}
          color="text.secondary"
        >
          {message}
        </Typography>
      </Box>
    </BaseModal>
  );
};

export default ConfirmModal;
