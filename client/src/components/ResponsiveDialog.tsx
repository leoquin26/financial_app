import React from 'react';
import {
  Dialog,
  DialogProps,
  useTheme,
  useMediaQuery,
} from '@mui/material';

interface ResponsiveDialogProps extends DialogProps {
  children: React.ReactNode;
}

const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  children,
  ...props
}) => {
  return (
    <Dialog
      {...props}
      className="responsive-dialog"
    >
      {children}
    </Dialog>
  );
};

export default ResponsiveDialog;
