import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Grid,
  Zoom,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  FlashOn as FlashOnIcon,
  Close as CloseIcon,
  AccountBalance as AccountBalanceIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { axiosInstance as axios } from '../config/api';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

interface QuickPaymentForm {
  amount: number;
  description: string;
  date: Date;
  payment_method: string;
  tags?: string;
  currency?: string;
}

interface FloatingQuickPaymentProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const FloatingQuickPayment: React.FC<FloatingQuickPaymentProps> = ({ 
  position = 'bottom-right' 
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [openDialog, setOpenDialog] = useState(false);
  const [openBudgetDialog, setOpenBudgetDialog] = useState(false);
  const [pendingQuickTransaction, setPendingQuickTransaction] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<QuickPaymentForm>({
    defaultValues: {
      amount: 0,
      description: '',
      date: new Date(),
      payment_method: 'cash',
      tags: 'quick-payment',
      currency: user?.currency || 'PEN',
    },
  });

  // Quick transaction mutation
  const quickTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.post('/api/transactions/quick', data);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.requiresBudget) {
        setPendingQuickTransaction(data.transactionData);
        setOpenBudgetDialog(true);
        setOpenDialog(false);
      } else {
        toast.success(data.message || 'Pago rápido registrado exitosamente');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
        queryClient.invalidateQueries({ queryKey: ['weeklyBudgets'] });
        queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
        queryClient.invalidateQueries({ queryKey: ['weekly-budget'] });
        queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
        handleCloseDialog();
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al registrar pago rápido');
    },
  });

  // Create quick budget mutation
  const createQuickBudgetMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.post('/api/weekly-budget/quick-monthly', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Presupuesto creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-budget'] });
      
      if (data.weeklyBudget?._id) {
        navigate(`/budgets/week/${data.weeklyBudget._id}`);
      }
      
      if (pendingQuickTransaction) {
        // Check if we haven't already processed this transaction
        console.log('Processing pending quick transaction after budget creation');
        const transactionData = { ...pendingQuickTransaction };
        setPendingQuickTransaction(null); // Clear immediately to prevent double submission
        
        setTimeout(() => {
          quickTransactionMutation.mutate(transactionData);
        }, 500);
      }
      
      setOpenBudgetDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear presupuesto');
    },
  });

  const handleOpenDialog = () => {
    reset({
      amount: 0,
      currency: user?.currency || 'PEN',
      description: '',
      date: new Date(),
      payment_method: 'cash',
      tags: 'quick-payment',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const onSubmit = async (data: QuickPaymentForm) => {
    // Prevent double submission
    if (isSubmitting || quickTransactionMutation.isPending) {
      console.log('Quick transaction already pending, ignoring duplicate submission');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await quickTransactionMutation.mutateAsync({
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        paymentMethod: data.payment_method,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : ['quick-payment'],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adjust position for mobile bottom navigation
  const bottomOffset = isMobile ? 90 : 24; // 90px to clear bottom navigation on mobile
  const rightOffset = isMobile ? 16 : 24; // Less margin on mobile
  
  // Position styles with mobile adjustments
  const positionStyles = {
    'bottom-right': { 
      bottom: bottomOffset, 
      right: rightOffset,
      ...(isMobile && { 
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)' // iOS safe area + nav height
      })
    },
    'bottom-left': { 
      bottom: bottomOffset, 
      left: rightOffset,
      ...(isMobile && { 
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)'
      })
    },
    'top-right': { top: 84, right: rightOffset },
    'top-left': { top: 84, left: rightOffset },
  };

  return (
    <>
      {/* Floating Action Button */}
      <Zoom in={true}>
        <Fab
          color="secondary"
          aria-label="quick payment"
          onClick={handleOpenDialog}
          sx={{
            position: 'fixed',
            ...positionStyles[position],
            zIndex: 1300,
          }}
        >
          <FlashOnIcon />
        </Fab>
      </Zoom>

      {/* Quick Payment Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1}>
                <FlashOnIcon color="secondary" />
                <Typography variant="h6">Registro Rápido de Pago</Typography>
              </Box>
              <IconButton onClick={handleCloseDialog} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Los pagos rápidos se registran automáticamente en la categoría "Quick Payment"
            </Alert>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="amount"
                  control={control}
                  rules={{ 
                    required: 'El monto es requerido',
                    min: { value: 0.01, message: 'El monto debe ser mayor a 0' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Monto"
                      type="number"
                      fullWidth
                      error={!!errors.amount}
                      helperText={errors.amount?.message}
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1 }}>S/</Typography>,
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="payment_method"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Método de pago"
                      fullWidth
                      SelectProps={{ native: true }}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="debit_card">Tarjeta de Débito</option>
                      <option value="credit_card">Tarjeta de Crédito</option>
                      <option value="transfer">Transferencia</option>
                      <option value="other">Otro</option>
                    </TextField>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'secondary.light',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: 'secondary.main',
                      color: 'white',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24
                    }}
                  >
                    ⚡
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Quick Payment
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Categoría exclusiva para pagos rápidos
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Descripción (opcional)"
                      fullWidth
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: 'La fecha es requerida' }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Fecha del pago"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.date,
                          helperText: errors.date?.message,
                        },
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button 
              type="submit" 
              variant="contained"
              color="secondary"
              startIcon={<FlashOnIcon />}
              disabled={isSubmitting || quickTransactionMutation.isPending}
            >
              Registrar Pago
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Budget Creation Dialog */}
      <Dialog 
        open={openBudgetDialog} 
        onClose={() => setOpenBudgetDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AccountBalanceIcon color="primary" />
            Crear Presupuesto Rápido
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            No tienes un presupuesto activo. Necesitas crear uno para registrar pagos rápidos.
          </Alert>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Presupuesto Mensual Rápido
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Se creará un presupuesto básico con las siguientes categorías:
            </Typography>
            
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Categorías incluidas (Presupuesto Semanal):</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>⚡</span>
                  <Typography variant="body2">Quick Payment - S/ 125</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>🍔</span>
                  <Typography variant="body2">Alimentación - S/ 75</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>🚗</span>
                  <Typography variant="body2">Transporte - S/ 75</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>📦</span>
                  <Typography variant="body2">Otros Gastos - S/ 75</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">
                  Total Semanal: S/ {(125 + 75 + 75 + 75).toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenBudgetDialog(false);
            setPendingQuickTransaction(null);
          }}>
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              createQuickBudgetMutation.mutate({
                monthlyIncome: 0
              });
            }}
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            disabled={createQuickBudgetMutation.isPending}
          >
            Crear Presupuesto
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FloatingQuickPayment;
