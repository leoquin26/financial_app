import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fab,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  Zoom,
  useTheme,
  useMediaQuery,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Collapse,
  Link,
} from '@mui/material';
import {
  FlashOn as FlashOnIcon,
  AccountBalance as AccountBalanceIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { axiosInstance as axios } from '../config/api';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { getCurrencySymbol } from '../utils/currencies';
import { FormModal, BaseModal } from './Modal';

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
  const [showOptionalFields, setShowOptionalFields] = useState(false);

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
      setIsSubmitting(false); // Reset submission state
      
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
      setIsSubmitting(false); // Reset submission state on error
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
      
      if (pendingQuickTransaction && !isSubmitting) {
        // Check if we haven't already processed this transaction
        console.log('Processing pending quick transaction after budget creation');
        const transactionData = { ...pendingQuickTransaction };
        setPendingQuickTransaction(null); // Clear immediately to prevent double submission
        setIsSubmitting(true); // Set submitting flag
        
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
    setShowOptionalFields(false);
  };

  const onSubmit = (data: QuickPaymentForm) => {
    // Prevent double submission
    if (isSubmitting || quickTransactionMutation.isPending) {
      console.log('Quick transaction already pending, ignoring duplicate submission');
      return;
    }
    
    setIsSubmitting(true);
    
    quickTransactionMutation.mutate({
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'),
      paymentMethod: data.payment_method,
      tags: data.tags ? data.tags.split(',').map(t => t.trim()) : ['quick-payment'],
    });
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

      {/* Quick Payment Modal */}
      <FormModal
        open={openDialog}
        onClose={handleCloseDialog}
        title="Registro Rápido de Pago"
        subtitle="Los pagos rápidos se registran automáticamente en la categoría Quick Payment"
        icon={<FlashOnIcon />}
        onSubmit={handleSubmit(onSubmit)}
        submitText="Registrar Pago"
        cancelText="Cancelar"
        loading={quickTransactionMutation.isPending || isSubmitting}
        submitButtonColor="secondary"
        maxWidth="xs"
        fullWidth={false}
        transitionType={isMobile ? 'slide' : 'fade'}
        className="quick-payment-modal"
      >
            <Grid container spacing={2}>
              <Grid item xs={12}>
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
                      size="medium"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <span style={{ 
                              whiteSpace: 'nowrap', 
                              fontSize: '16px',
                              fontWeight: 500,
                              lineHeight: 1
                            }}>
                              {user?.currency === 'USD' ? '$' : 'S/'}
                            </span>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="payment_method"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Método de pago</InputLabel>
                      <Select
                        {...field}
                        label="Método de pago"
                      >
                        <MenuItem value="cash">Efectivo</MenuItem>
                        <MenuItem value="debit_card">Tarjeta de Débito</MenuItem>
                        <MenuItem value="credit_card">Tarjeta de Crédito</MenuItem>
                        <MenuItem value="transfer">Transferencia</MenuItem>
                        <MenuItem value="other">Otro</MenuItem>
                      </Select>
                    </FormControl>
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
                          size: 'medium',
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => setShowOptionalFields(!showOptionalFields)}
                    sx={{ cursor: 'pointer' }}
                  >
                    {showOptionalFields ? 'Ocultar campos opcionales' : 'Agregar descripción (opcional)'}
                  </Link>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Collapse in={showOptionalFields}>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Descripción"
                        fullWidth
                        multiline
                        rows={2}
                        size="medium"
                        sx={{ mt: 1 }}
                      />
                    )}
                  />
                </Collapse>
              </Grid>
            </Grid>
      </FormModal>

      {/* Budget Creation Modal */}
      <BaseModal
        open={openBudgetDialog}
        onClose={() => setOpenBudgetDialog(false)}
        title="Crear Presupuesto Rápido"
        subtitle="No tienes un presupuesto activo. Necesitas crear uno para registrar pagos rápidos."
        icon={<AccountBalanceIcon />}
        maxWidth="sm"
        showCloseButton={true}
        transitionType={isMobile ? 'slide' : 'fade'}
        actions={
          <>
            <Button 
              onClick={() => {
                setOpenBudgetDialog(false);
                setPendingQuickTransaction(null);
              }}
              variant="outlined"
              fullWidth
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => createQuickBudgetMutation.mutate({ monthlyIncome: 0 })}
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              disabled={createQuickBudgetMutation.isPending}
              fullWidth
            >
              {createQuickBudgetMutation.isPending ? 'Creando...' : 'Crear Presupuesto'}
            </Button>
          </>
        }
      >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: { xs: '50vh', sm: '60vh' }, overflow: 'hidden' }}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Presupuesto Mensual Rápido
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Se creará un presupuesto básico con las siguientes categorías:
              </Typography>
            </Box>
            
            <Box sx={{ 
              p: { xs: 1.5, sm: 2 }, 
              bgcolor: 'background.paper', 
              borderRadius: 1,
              flex: 1,
              overflowY: 'auto',
              minHeight: 0
            }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                Categorías incluidas (Presupuesto Semanal):
              </Typography>
              <Grid container spacing={1} sx={{ mt: 1 }}>
                {[
                  { icon: '⚡', name: 'Quick Payment', amount: 125 },
                  { icon: '🍔', name: 'Alimentación', amount: 75 },
                  { icon: '🚗', name: 'Transporte', amount: 75 },
                  { icon: '📦', name: 'Otros Gastos', amount: 75 },
                ].map((category, index) => (
                  <Grid item xs={12} key={index}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      py: 0.75
                    }}>
                      <Box sx={{ fontSize: { xs: 18, sm: 20 }, width: 28, textAlign: 'center' }}>
                        {category.icon}
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {category.name}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        S/ {category.amount}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ 
                mt: 2, 
                pt: 2, 
                borderTop: 1, 
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Total Semanal:
                </Typography>
                <Typography variant="subtitle2" fontWeight="bold" color="primary">
                  S/ 350.00
                </Typography>
              </Box>
            </Box>
          </Box>
      </BaseModal>
    </>
  );
};

export default FloatingQuickPayment;
