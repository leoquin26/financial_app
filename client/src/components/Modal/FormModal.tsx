import React from 'react';
import { Button, Box, CircularProgress } from '@mui/material';
import BaseModal, { BaseModalProps } from './BaseModal';

interface FormModalProps extends Omit<BaseModalProps, 'actions' | 'children'> {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  submitButtonColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  className?: string;
}

const FormModal: React.FC<FormModalProps> = ({
  children,
  onSubmit,
  onCancel,
  onClose,
  submitText = 'Save',
  cancelText = 'Cancel',
  loading = false,
  submitDisabled = false,
  submitButtonColor = 'primary',
  className,
  ...baseModalProps
}) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(e);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  return (
    <BaseModal
      {...baseModalProps}
      onClose={onClose}
      disableBackdropClick={loading}
      disableEscapeKeyDown={loading}
      className={className}
      actions={
        <>
          <Button
            onClick={handleCancel}
            disabled={loading}
            variant="outlined"
          >
            {cancelText}
          </Button>
          <Button
            type="submit"
            form="modal-form"
            disabled={loading || submitDisabled}
            variant="contained"
            color={submitButtonColor}
            sx={{ position: 'relative', minWidth: 100 }}
          >
            {loading && (
              <CircularProgress
                size={20}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: '-10px',
                  marginLeft: '-10px',
                }}
              />
            )}
            <span style={{ visibility: loading ? 'hidden' : 'visible' }}>
              {submitText}
            </span>
          </Button>
        </>
      }
    >
      <Box
        component="form"
        id="modal-form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {children}
      </Box>
    </BaseModal>
  );
};

export default FormModal;
