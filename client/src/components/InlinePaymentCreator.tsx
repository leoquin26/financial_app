import React, { useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Button,
  Collapse,
  Typography,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useMutation } from '@tanstack/react-query';
import axios from '../config/api';
import { toast } from 'react-toastify';

interface InlinePaymentCreatorProps {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  allocation: number;
  currentTotal: number;
  weekStart: Date;
  weekEnd: Date;
  onSave: () => void;
  budgetId?: string;
}

const InlinePaymentCreator: React.FC<InlinePaymentCreatorProps> = ({
  categoryId,
  categoryName,
  categoryColor,
  allocation,
  currentTotal,
  weekStart,
  weekEnd,
  onSave,
  budgetId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(new Date());

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (budgetId) {
        // Add payment to weekly budget
        const response = await axios.post(`/api/weekly-budget/${budgetId}/category/${categoryId}/payment`, {
          name: data.name,
          amount: data.amount,
          scheduledDate: data.dueDate,
          notes: data.notes || '',
          isRecurring: false,
        });
        return response.data;
      } else {
        // Create standalone payment
        const response = await axios.post('/api/payments', data);
        return response.data;
      }
    },
    onSuccess: () => {
      toast.success('Payment added successfully!');
      handleReset();
      onSave();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add payment');
    },
  });

  const handleReset = () => {
    setName('');
    setAmount('');
    setScheduledDate(new Date());
    setIsExpanded(false);
  };

  const handleSave = () => {
    if (!name || !amount || !scheduledDate) {
      toast.error('Please fill all fields');
      return;
    }

    // Handle both comma and dot as decimal separators
    const normalizedAmount = amount.replace(',', '.');
    const paymentAmount = parseFloat(normalizedAmount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (allocation > 0 && currentTotal + paymentAmount > allocation) {
      toast.warning(`This payment would exceed your budget by $${((currentTotal + paymentAmount) - allocation).toFixed(2)}`);
    }

    const paymentData = {
      name,
      amount: paymentAmount,
      categoryId,
      dueDate: scheduledDate.toISOString(),
      frequency: 'once',
      status: 'pending',
      reminder: {
        enabled: false,
        daysBefore: 1
      },
    };

    createPaymentMutation.mutate(paymentData);
  };

  if (!isExpanded) {
    return (
      <Button
        fullWidth
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setIsExpanded(true)}
        sx={{
          borderStyle: 'dashed',
          borderColor: categoryColor,
          color: categoryColor,
          '&:hover': {
            borderStyle: 'dashed',
            backgroundColor: categoryColor + '10',
          },
        }}
      >
        Add Payment to {categoryName}
      </Button>
    );
  }

  return (
    <Collapse in={isExpanded}>
      <Box
        sx={{
          border: '2px solid',
          borderColor: categoryColor,
          borderRadius: 1,
          p: 2,
          backgroundColor: categoryColor + '08',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle2" fontWeight="bold">
            New Payment
          </Typography>
          <IconButton size="small" onClick={handleReset}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            size="small"
            fullWidth
            label="Payment Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g., ${categoryName} payment`}
          />

          <Box display="flex" gap={2}>
            <TextField
              size="small"
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MoneyIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />

            <DatePicker
              label="Due Date"
              value={scheduledDate}
              onChange={setScheduledDate}
              minDate={weekStart}
              maxDate={weekEnd}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { flex: 1 },
                },
              }}
            />
          </Box>

          {allocation > 0 && (
            <Typography variant="caption" color="textSecondary">
              Remaining budget: ${(allocation - currentTotal).toFixed(2)}
            </Typography>
          )}

          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button
              size="small"
              onClick={handleReset}
              color="inherit"
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={createPaymentMutation.isPending}
              sx={{
                backgroundColor: categoryColor,
                '&:hover': {
                  backgroundColor: categoryColor,
                  filter: 'brightness(0.9)',
                },
              }}
            >
              Schedule Payment
            </Button>
          </Box>
        </Box>
      </Box>
    </Collapse>
  );
};

export default InlinePaymentCreator;