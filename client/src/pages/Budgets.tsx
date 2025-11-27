import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Tooltip,
  Paper,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp,
  TrendingDown,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  AccountBalance,
  CalendarToday,
  Notifications,
  NotificationsOff,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import { axiosInstance as axios } from '../config/api';
import { formatCurrency as formatCurrencyUtil, getCurrencySymbol } from '../utils/currencies';
import { useAuth } from '../contexts/AuthContext';

interface Budget {
  id: number;
  category_id: number;
  category_name: string;
  amount: number;
  period: string;
  alert_percentage: number;
  is_active: boolean;
  spent: number;
  remaining: number;
  percentage: number;
  color: string;
  icon: string;
  start_date?: string;
  end_date?: string;
}

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

interface BudgetForm {
  category_id: number;
  amount: number;
  period: string;
  alert_percentage: number;
  start_date?: Date | null;
  end_date?: Date | null;
}

const Budgets: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string | boolean>('all');

  // Form
  const { control, handleSubmit, reset, formState: { errors } } = useForm<BudgetForm>({
    defaultValues: {
      category_id: 0,
      amount: 0,
      period: 'monthly',
      alert_percentage: 80,
      start_date: null,
      end_date: null,
    },
  });

  // Queries
  const { data: budgets, isLoading, refetch } = useQuery<Budget[]>({
    queryKey: ['budgets', filterPeriod, filterActive],
    queryFn: async () => {
      const params: any = {};
      if (filterPeriod !== 'all') params.period = filterPeriod;
      if (filterActive !== 'all') params.isActive = filterActive;

      const response = await axios.get('/api/budgets', { params });
      return response.data.budgets;
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data.categories.filter((c: Category) => c.type === 'expense');
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: BudgetForm) => {
      const payload = {
        ...data,
        categoryId: data.category_id,
        startDate: data.start_date ? data.start_date.toISOString().split('T')[0] : undefined,
        endDate: data.end_date ? data.end_date.toISOString().split('T')[0] : undefined,
        alertPercentage: data.alert_percentage,
      };
      const response = await axios.post('/api/budgets', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Presupuesto creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear presupuesto');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.patch(`/api/budgets/${id}/toggle`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Estado del presupuesto actualizado');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar presupuesto');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/budgets/${id}`);
    },
    onSuccess: () => {
      toast.success('Presupuesto eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar presupuesto');
    },
  });

  // Socket listeners
  React.useEffect(() => {
    if (!socket) return;

    const handleBudgetUpdate = () => {
      refetch();
    };

    socket.on('budget-created', handleBudgetUpdate);
    socket.on('budget-updated', handleBudgetUpdate);
    socket.on('budget-deleted', handleBudgetUpdate);
    socket.on('budget-alert', (data) => {
      refetch();
      // The toast is already handled in SocketContext
    });

    return () => {
      socket.off('budget-created', handleBudgetUpdate);
      socket.off('budget-updated', handleBudgetUpdate);
      socket.off('budget-deleted', handleBudgetUpdate);
      socket.off('budget-alert');
    };
  }, [socket, refetch]);

  // Handlers
  const handleOpenDialog = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      reset({
        category_id: budget.category_id,
        amount: budget.amount,
        period: budget.period,
        alert_percentage: budget.alert_percentage,
        start_date: budget.start_date ? new Date(budget.start_date) : null,
        end_date: budget.end_date ? new Date(budget.end_date) : null,
      });
    } else {
      setEditingBudget(null);
      reset();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBudget(null);
    reset();
  };

  const onSubmit = (data: BudgetForm) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este presupuesto?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'PEN');
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'error';
    if (percentage >= 80) return 'warning';
    if (percentage >= 60) return 'info';
    return 'success';
  };

  const getPeriodLabel = (period: string) => {
    const labels: { [key: string]: string } = {
      daily: 'Diario',
      weekly: 'Semanal',
      monthly: 'Mensual',
      yearly: 'Anual',
    };
    return labels[period] || period;
  };

  // Calculate totals
  const totalBudget = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const totalSpent = budgets?.reduce((sum, b) => sum + b.spent, 0) || 0;
  const totalRemaining = totalBudget - totalSpent;
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Presupuestos
        </Typography>
        <Box display="flex" gap={2}>
          <IconButton onClick={() => refetch()} color="primary">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Presupuesto
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Presupuesto Total
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(totalBudget)}
                  </Typography>
                </Box>
                <AccountBalance sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Gastado
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    {formatCurrency(totalSpent)}
                  </Typography>
                </Box>
                <TrendingDown sx={{ fontSize: 40, color: 'error.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Disponible
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {formatCurrency(totalRemaining)}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Progreso General
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {overallPercentage.toFixed(0)}%
                  </Typography>
                </Box>
                <Box position="relative" display="inline-flex">
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      border: `8px solid`,
                      borderColor: getProgressColor(overallPercentage) + '.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {overallPercentage >= 100 ? (
                      <WarningIcon color="error" />
                    ) : overallPercentage >= 80 ? (
                      <WarningIcon color="warning" />
                    ) : (
                      <CheckIcon color="success" />
                    )}
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Período</InputLabel>
              <Select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                label="Período"
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="daily">Diario</MenuItem>
                <MenuItem value="weekly">Semanal</MenuItem>
                <MenuItem value="monthly">Mensual</MenuItem>
                <MenuItem value="yearly">Anual</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Estado</InputLabel>
              <Select
                value={filterActive === true ? 'true' : filterActive === false ? 'false' : 'all'}
                onChange={(e) => setFilterActive(e.target.value === 'true' ? true : e.target.value === 'false' ? false : 'all')}
                label="Estado"
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="true">Activos</MenuItem>
                <MenuItem value="false">Inactivos</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Budget Cards */}
      {isLoading ? (
        <Grid container spacing={3}>
          {[...Array(4)].map((_, i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : budgets?.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <AccountBalance sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" mb={2}>
            No hay presupuestos configurados
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Configurar Primer Presupuesto
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {budgets?.map((budget) => (
            <Grid item xs={12} md={6} lg={4} key={budget.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  sx={{
                    height: '100%',
                    opacity: budget.is_active ? 1 : 0.6,
                    position: 'relative',
                  }}
                >
                  {!budget.is_active && (
                    <Chip
                      label="Inactivo"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 1,
                      }}
                    />
                  )}
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            bgcolor: budget.color + '20',
                            p: 1,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: '1.5rem' }}>{budget.icon}</span>
                        </Box>
                        <Box>
                          <Typography variant="h6">
                            {budget.category_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {getPeriodLabel(budget.period)}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => budget.is_active ? toggleMutation.mutate(budget.id) : null}
                      >
                        {budget.is_active ? (
                          <Tooltip title="Desactivar notificaciones">
                            <Notifications color="action" />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Activar notificaciones">
                            <NotificationsOff color="disabled" />
                          </Tooltip>
                        )}
                      </IconButton>
                    </Box>

                    <Box mb={2}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          Progreso
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {budget.percentage.toFixed(0)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(budget.percentage, 100)}
                        color={getProgressColor(budget.percentage)}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Presupuesto
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {formatCurrency(budget.amount)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Gastado
                        </Typography>
                        <Typography 
                          variant="body1" 
                          fontWeight="bold"
                          color={budget.percentage >= 100 ? 'error.main' : 'text.primary'}
                        >
                          {formatCurrency(budget.spent)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Disponible
                        </Typography>
                        <Typography 
                          variant="body1" 
                          fontWeight="bold"
                          color={budget.remaining >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(budget.remaining)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Alerta en
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {budget.alert_percentage}%
                        </Typography>
                      </Grid>
                    </Grid>

                    {budget.percentage >= budget.alert_percentage && (
                      <Alert 
                        severity={budget.percentage >= 100 ? 'error' : 'warning'}
                        sx={{ mt: 2 }}
                      >
                        {budget.percentage >= 100 
                          ? 'Has excedido el presupuesto'
                          : `Has alcanzado el ${budget.percentage.toFixed(0)}% del presupuesto`
                        }
                      </Alert>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleOpenDialog(budget)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(budget.id)}
                    >
                      Eliminar
                    </Button>
                    <Button
                      size="small"
                      onClick={() => toggleMutation.mutate(budget.id)}
                    >
                      {budget.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </CardActions>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} className="budget-dialog">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Controller
                  name="category_id"
                  control={control}
                  rules={{ required: 'La categoría es requerida' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.category_id}>
                      <InputLabel>Categoría</InputLabel>
                      <Select {...field} label="Categoría">
                        {categories?.map(cat => (
                          <MenuItem key={cat.id} value={cat.id}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <span>{cat.icon}</span>
                              {cat.name}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.category_id && (
                        <Typography variant="caption" color="error">
                          {errors.category_id.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="amount"
                  control={control}
                  rules={{ required: 'El monto es requerido', min: 0.01 }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Monto del Presupuesto"
                      type="number"
                      error={!!errors.amount}
                      helperText={errors.amount?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">{getCurrencySymbol(user?.currency || 'PEN')}</InputAdornment>
                        ),
                      }}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="period"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Período</InputLabel>
                      <Select {...field} label="Período">
                        <MenuItem value="daily">Diario</MenuItem>
                        <MenuItem value="weekly">Semanal</MenuItem>
                        <MenuItem value="monthly">Mensual</MenuItem>
                        <MenuItem value="yearly">Anual</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="alert_percentage"
                  control={control}
                  rules={{ required: 'El porcentaje de alerta es requerido', min: 1, max: 100 }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Porcentaje de Alerta"
                      type="number"
                      error={!!errors.alert_percentage}
                      helperText={errors.alert_percentage?.message || 'Te notificaremos cuando alcances este porcentaje'}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">%</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 1, max: 100 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Recibirás una notificación cuando hayas gastado el {80}% de tu presupuesto
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={createMutation.isPending}
            >
              {editingBudget ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Budgets;