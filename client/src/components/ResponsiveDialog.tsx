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
  maxWidth = 'sm',
  fullWidth = true,
  ...props
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      {...props}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...props.PaperProps?.sx,
          ...(isMobile && {
            margin: 0,
            borderRadius: 0,
            maxHeight: '100%',
            maxWidth: '100%',
          }),
        },
      }}
    >
      {children}
    </Dialog>
  );
};

export default ResponsiveDialog;
