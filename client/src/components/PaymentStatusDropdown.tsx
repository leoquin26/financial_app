import React, { useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Chip,
} from '@mui/material';
import {
  Schedule as PendingIcon,
  Payment as PayingIcon,
  CheckCircle as PaidIcon,
  Error as OverdueIcon,
  Cancel as CancelledIcon,
} from '@mui/icons-material';

interface PaymentStatusDropdownProps {
  paymentId: string;
  currentStatus: 'pending' | 'paying' | 'paid' | 'overdue' | 'cancelled';
  onStatusChange: (paymentId: string, newStatus: string) => void;
  disabled?: boolean;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    color: 'warning' as const,
    icon: <PendingIcon fontSize="small" />,
  },
  paying: {
    label: 'Paying',
    color: 'info' as const,
    icon: <PayingIcon fontSize="small" />,
  },
  paid: {
    label: 'Paid',
    color: 'success' as const,
    icon: <PaidIcon fontSize="small" />,
  },
  overdue: {
    label: 'Overdue',
    color: 'error' as const,
    icon: <OverdueIcon fontSize="small" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'default' as const,
    icon: <CancelledIcon fontSize="small" />,
  },
};

const PaymentStatusDropdown: React.FC<PaymentStatusDropdownProps> = ({
  paymentId,
  currentStatus,
  onStatusChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const newStatus = event.target.value;
    console.log('PaymentStatusDropdown handleChange:', { paymentId, currentStatus, newStatus });
    onStatusChange(paymentId, newStatus);
  };

  const config = statusConfig[currentStatus] || statusConfig.pending;

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={currentStatus}
        onChange={handleChange}
        disabled={disabled}
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        displayEmpty
        renderValue={(value) => (
          <Chip
            label={statusConfig[value as keyof typeof statusConfig].label}
            color={statusConfig[value as keyof typeof statusConfig].color}
            size="small"
            icon={statusConfig[value as keyof typeof statusConfig].icon}
            sx={{ cursor: 'pointer' }}
            onClick={(e) => {
              console.log('Chip clicked');
              // Don't stop propagation - let the Select handle it
            }}
          />
        )}
        sx={{
          '& .MuiSelect-select': {
            py: 0,
            display: 'flex',
            alignItems: 'center',
          },
          '& fieldset': {
            border: 'none',
          },
        }}
      >
        {Object.entries(statusConfig).map(([status, config]) => (
          <MenuItem key={status} value={status}>
            <Chip
              label={config.label}
              color={config.color}
              size="small"
              icon={config.icon}
              sx={{ width: '100%' }}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default PaymentStatusDropdown;
