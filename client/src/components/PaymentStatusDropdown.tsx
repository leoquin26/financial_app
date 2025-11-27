import React, { useState, useRef, useCallback } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Chip,
  CircularProgress,
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
  const [isUpdating, setIsUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState<'pending' | 'paying' | 'paid' | 'overdue' | 'cancelled'>(currentStatus);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Update local status when prop changes (after successful update)
  React.useEffect(() => {
    setLocalStatus(currentStatus);
    setIsUpdating(false);
  }, [currentStatus]);

  const handleChange = useCallback((event: SelectChangeEvent<string>) => {
    const newStatus = event.target.value;
    
    // Prevent multiple simultaneous updates
    if (isUpdating) {
      console.log('PaymentStatusDropdown: Update already in progress, ignoring');
      return;
    }
    
    console.log('PaymentStatusDropdown handleChange:', { paymentId, currentStatus, newStatus });
    
    // Update local state immediately for better UX
    setLocalStatus(newStatus as 'pending' | 'paying' | 'paid' | 'overdue' | 'cancelled');
    setIsUpdating(true);
    
    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Debounce the actual update to prevent rapid consecutive calls
    debounceTimer.current = setTimeout(() => {
      onStatusChange(paymentId, newStatus);
      // isUpdating will be set to false when currentStatus prop updates
    }, 300); // 300ms debounce
  }, [paymentId, currentStatus, onStatusChange, isUpdating]);

  const config = statusConfig[localStatus] || statusConfig.pending;

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <FormControl size="small" sx={{ minWidth: 120, position: 'relative' }}>
      <Select
        value={localStatus}
        onChange={handleChange}
        disabled={disabled || isUpdating}
        open={isOpen}
        onOpen={() => !isUpdating && setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        displayEmpty
        renderValue={(value) => (
          <Chip
            label={statusConfig[value as keyof typeof statusConfig].label}
            color={statusConfig[value as keyof typeof statusConfig].color}
            size="small"
            icon={isUpdating ? <CircularProgress size={16} /> : statusConfig[value as keyof typeof statusConfig].icon}
            sx={{ cursor: isUpdating ? 'wait' : 'pointer' }}
            onClick={(e) => {
              if (!isUpdating) {
                console.log('Chip clicked');
              }
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
