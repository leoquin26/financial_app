import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  TablePagination,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Checkbox,
  Tooltip,
  Alert,
  Skeleton,
  Menu,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Switch,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  MoreVert as MoreIcon,
  TrendingUp,
  TrendingDown,
  CalendarToday,
  Category,
  AttachMoney,
  AttachMoney as MoneyIcon,
  Description,
  Receipt,
  Refresh as RefreshIcon,
  Payment as PaymentIcon,
  Label as LabelIcon,
  Repeat as RepeatIcon,
  FlashOn as FlashOnIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import { axiosInstance as axios } from '../config/api';
import { formatCurrency, getCurrencySymbol, CURRENCIES } from '../utils/currencies';

interface Transaction {
  _id: string;
  id?: number; // Keep for backwards compatibility
  amount: number;
  currency?: string;
  categoryId: any; // Can be string or populated category object
  category_id?: string; // For backwards compatibility
  category_name?: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  paymentMethod?: string;
  payment_method?: string; // For backwards compatibility
  tags?: string[];
  isRecurring?: boolean;
  is_recurring?: boolean; // For backwards compatibility
  recurringPeriod?: string;
  recurring_period?: string; // For backwards compatibility
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  _id: string;
  name: string;
  color: string;
  icon: string;
  userId?: string | null;
}

interface TransactionForm {
  amount: number;
  currency?: string;
  category_id: string;
  description: string;
  date: Date;
  type: 'income' | 'expense';
  payment_method?: string;
  tags?: string;
  is_recurring: boolean;
  recurring_period?: string;
}

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [openQuickDialog, setOpenQuickDialog] = useState(false);
  const [openBudgetDialog, setOpenBudgetDialog] = useState(false);
  const [pendingQuickTransaction, setPendingQuickTransaction] = useState<any>(null);

  // Form
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TransactionForm>({
    defaultValues: {
      amount: 0,
      currency: '',
      category_id: '',
      description: '',
      date: new Date(),
      type: 'expense',
      payment_method: '',
      tags: '',
      is_recurring: false,
      recurring_period: 'monthly',
    },
  });

  const watchType = watch('type');
  const watchRecurring = watch('is_recurring');
  const watchCurrency = watch('currency');

  // Queries
  const { data: transactions, isLoading: loadingTransactions, refetch } = useQuery({
    queryKey: ['transactions', page, rowsPerPage, filterType, filterCategory, dateRange],
    queryFn: async () => {
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };

      if (filterType !== 'all') params.type = filterType;
      if (filterCategory) params.categoryId = filterCategory;

      const response = await axios.get('/api/transactions', { params });
      return response.data;
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data; // Backend returns array directly
    },
  });

  // Get user data for default currency
  const { data: userData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const response = await axios.get('/api/auth/me');
      return response.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: TransactionForm) => {
      const payload = {
        type: data.type,
        amount: parseFloat(data.amount.toString()), // Ensure amount is a number
        currency: data.currency,
        categoryId: data.category_id,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        paymentMethod: data.payment_method,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
        isRecurring: data.is_recurring,
        recurringPeriod: data.recurring_period,
      };
      const response = await axios.post('/api/transactions', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transacción creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear transacción');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransactionForm }) => {
      const payload = {
        type: data.type,
        amount: parseFloat(data.amount.toString()), // Ensure amount is a number
        currency: data.currency,
        categoryId: data.category_id,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        paymentMethod: data.payment_method,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
        isRecurring: data.is_recurring,
        recurringPeriod: data.recurring_period,
      };
      const response = await axios.put(`/api/transactions/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transacción actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar transacción');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/transactions/${id}`);
    },
    onSuccess: () => {
      toast.success('Transacción eliminada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar transacción');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await axios.post('/api/transactions/bulk-delete', { ids });
    },
    onSuccess: () => {
      toast.success('Transacciones eliminadas exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelected([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar transacciones');
    },
  });

  const quickTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.post('/api/transactions/quick', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Check if budget creation is required
      if (data.requiresBudget) {
        setPendingQuickTransaction(data.transactionData);
        setOpenBudgetDialog(true);
        handleCloseQuickDialog();
      } else {
        toast.success(data.message || 'Pago rápido registrado exitosamente');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] }); // This is the key used in WeeklyBudgetSimplified
        queryClient.invalidateQueries({ queryKey: ['weeklyBudgets'] });
        queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
        queryClient.invalidateQueries({ queryKey: ['weekly-budget'] });
        queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
        handleCloseQuickDialog();
        
        // Navigate to budgets page to see the transaction in the budget
        setTimeout(() => {
          navigate('/budgets');
        }, 500);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al registrar pago rápido');
    },
  });

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
      
      // Navigate to the weekly budget view
      if (data.weeklyBudget?._id) {
        navigate(`/budgets/week/${data.weeklyBudget._id}`);
      }
      
      // Now retry the quick transaction
      if (pendingQuickTransaction) {
        // Small delay to ensure budget is properly loaded
        setTimeout(() => {
          quickTransactionMutation.mutate(pendingQuickTransaction);
          setPendingQuickTransaction(null);
        }, 500);
      }
      
      setOpenBudgetDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear presupuesto');
    },
  });

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleTransactionUpdate = () => {
      refetch();
    };

    const handleBudgetUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['currentWeekBudget'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-budget'] });
    };

    socket.on('transaction-created', handleTransactionUpdate);
    socket.on('transaction-updated', handleTransactionUpdate);
    socket.on('transaction-deleted', handleTransactionUpdate);
    socket.on('transactions-deleted', handleTransactionUpdate);
    socket.on('budget-updated', handleBudgetUpdate);

    return () => {
      socket.off('transaction-created', handleTransactionUpdate);
      socket.off('transaction-updated', handleTransactionUpdate);
      socket.off('transaction-deleted', handleTransactionUpdate);
      socket.off('transactions-deleted', handleTransactionUpdate);
      socket.off('budget-updated', handleBudgetUpdate);
    };
  }, [socket, refetch]);

  // Fetch quick categories

  // Handlers
  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      console.log('Editing transaction full data:', transaction);
      console.log('Payment Method:', transaction.paymentMethod, 'or', transaction.payment_method);
      console.log('Tags:', transaction.tags);
      console.log('Is Recurring:', transaction.isRecurring, 'or', transaction.is_recurring);
      console.log('Recurring Period:', transaction.recurringPeriod, 'or', transaction.recurring_period);
      
      setEditingTransaction(transaction);
      
      // Map backend field names to frontend form field names
      const categoryId = (transaction as any).categoryId?._id || (transaction as any).categoryId || transaction.category_id;
      
      // Check all possible field names (camelCase from backend, snake_case for compatibility)
      const formData = {
        amount: transaction.amount,
        currency: transaction.currency || '',
        category_id: categoryId || '',
        description: transaction.description || '',
        date: parseISO(transaction.date),
        type: transaction.type,
        payment_method: (transaction as any).paymentMethod || transaction.payment_method || '',
        tags: Array.isArray(transaction.tags) ? transaction.tags.join(', ') : 
              Array.isArray((transaction as any).tags) ? (transaction as any).tags.join(', ') : '',
        is_recurring: (transaction as any).isRecurring !== undefined ? (transaction as any).isRecurring : 
                     transaction.isRecurring !== undefined ? transaction.isRecurring :
                     transaction.is_recurring || false,
        recurring_period: (transaction as any).recurringPeriod || transaction.recurringPeriod || 
                         transaction.recurring_period || 'monthly',
      };
      
      console.log('Form data being set:', formData);
      reset(formData);
    } else {
      setEditingTransaction(null);
      reset({
        amount: 0,
        currency: userData?.currency || 'PEN',
        category_id: '',
        description: '',
        date: new Date(),
        type: 'expense',
        payment_method: '',
        tags: '',
        is_recurring: false,
        recurring_period: 'monthly',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTransaction(null);
    reset();
  };

  const onSubmit = (data: TransactionForm) => {
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar esta transacción?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`¿Estás seguro de eliminar ${selected.length} transacciones?`)) {
      bulkDeleteMutation.mutate(selected);
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && transactions?.transactions) {
      const newSelected = transactions.transactions.map((t: Transaction) => t._id);
      setSelected(newSelected);
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }

    setSelected(newSelected);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, transaction: Transaction) => {
    console.log('Selected transaction:', transaction);
    setAnchorEl(event.currentTarget);
    setSelectedTransaction(transaction);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTransaction(null);
  };

  const handleOpenQuickDialog = () => {
    // No need to fetch categories anymore - Quick Payment category will be used automatically
    reset({
      amount: 0,
      currency: userData?.currency || 'PEN',
      description: '',
      date: new Date(),
      type: 'expense',
      payment_method: 'cash',
      tags: 'quick-payment',
      is_recurring: false,
    });
    
    setOpenQuickDialog(true);
  };

  const handleCloseQuickDialog = () => {
    setOpenQuickDialog(false);
    // Don't reset the form here, it will be reset when opening next time
  };

  const onSubmitQuick = (data: TransactionForm) => {
    // No category needed - always uses Quick Payment category
    quickTransactionMutation.mutate({
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'),
      paymentMethod: data.payment_method,
      tags: data.tags ? data.tags.split(',').map(t => t.trim()) : ['quick-payment'],
    });
  };


  // Categories don't have type - they can be used for both income and expense
  const filteredCategories = categories || [];

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', px: { xs: 1, sm: 2, md: 3 }, py: 2 }}>
      {/* Header */}
      <Box 
        display="flex" 
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }} 
        gap={2}
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          Transacciones
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap" justifyContent={{ xs: 'flex-end', sm: 'flex-end' }}>
          <IconButton onClick={() => refetch()} color="primary" size={isMobile ? "small" : "medium"}>
            <RefreshIcon />
          </IconButton>
          {selected.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
              size="small"
            >
              {isMobile ? selected.length : `Eliminar (${selected.length})`}
            </Button>
          )}
          <Button
            variant="contained"
            color="secondary"
            startIcon={isMobile ? null : <FlashOnIcon />}
            onClick={handleOpenQuickDialog}
            size="small"
            sx={{ minWidth: isMobile ? 'auto' : '120px' }}
          >
            {isMobile ? '⚡' : 'Pago Rápido'}
          </Button>
          <Button
            variant="contained"
            startIcon={isMobile ? null : <AddIcon />}
            onClick={() => handleOpenDialog()}
            size="small"
            sx={{ minWidth: isMobile ? 'auto' : '120px' }}
          >
            {isMobile ? '+' : 'Nueva Transacción'}
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                label="Tipo"
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="income">Ingresos</MenuItem>
                <MenuItem value="expense">Gastos</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Categoría</InputLabel>
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                label="Categoría"
              >
                <MenuItem value="">Todas</MenuItem>
                {categories?.map(cat => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.icon} {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1}>
              <DatePicker
                label="Desde"
                value={dateRange.start}
                onChange={(date) => setDateRange({ ...dateRange, start: date })}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <DatePicker
                label="Hasta"
                value={dateRange.end}
                onChange={(date) => setDateRange({ ...dateRange, end: date })}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
        {loadingTransactions ? (
          <Box p={3}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={60} sx={{ my: 1 }} />
            ))}
          </Box>
        ) : transactions?.transactions?.length === 0 ? (
          <Box p={5} textAlign="center">
            <Receipt sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No hay transacciones
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ mt: 2 }}
            >
              Agregar Primera Transacción
            </Button>
          </Box>
        ) : (
          <>
            {isMobile ? (
              // Mobile Card View
              <Box>
                {transactions?.transactions?.map((transaction: Transaction) => (
                  <Card key={transaction._id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            {format(parseISO(transaction.date), 'dd/MM/yyyy', { locale: es })}
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {transaction.description || 'Sin descripción'}
                          </Typography>
                        </Box>
                        <Box textAlign="right">
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                          >
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Chip
                          icon={<span>{(transaction as any).categoryId?.icon || transaction.icon || '📂'}</span>}
                          label={(transaction as any).categoryId?.name || transaction.category_name || 'Sin categoría'}
                          size="small"
                          sx={{
                            bgcolor: ((transaction as any).categoryId?.color || transaction.color || '#666') + '20',
                            color: (transaction as any).categoryId?.color || transaction.color || '#666',
                          }}
                        />
                        <Box display="flex" alignItems="center" gap={1}>
                          {transaction.is_recurring && (
                            <Chip label="Recurrente" size="small" variant="outlined" />
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, transaction)}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              // Desktop Table View
              <Table>
                <TableHead>
                  <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selected.length > 0 &&
                        selected.length < (transactions?.transactions?.length || 0)
                      }
                      checked={
                        transactions?.transactions?.length > 0 &&
                        selected.length === transactions?.transactions?.length
                      }
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions?.transactions?.map((transaction: Transaction) => (
                  <TableRow
                    key={transaction._id}
                    hover
                    selected={selected.indexOf(transaction._id) !== -1}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.indexOf(transaction._id) !== -1}
                        onChange={() => handleSelectOne(transaction._id)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(parseISO(transaction.date), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<span>{(transaction as any).categoryId?.icon || transaction.icon || '📂'}</span>}
                        label={(transaction as any).categoryId?.name || transaction.category_name || 'Sin categoría'}
                        size="small"
                        sx={{
                          bgcolor: ((transaction as any).categoryId?.color || transaction.color || '#666') + '20',
                          color: (transaction as any).categoryId?.color || transaction.color || '#666',
                        }}
                      />
                    </TableCell>
                    <TableCell>{transaction.description || '-'}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {transaction.is_recurring && (
                        <Chip label="Recurrente" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, transaction)}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={transactions?.pagination?.total || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </>
        )}
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (selectedTransaction) {
              handleOpenDialog(selectedTransaction);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedTransaction && selectedTransaction._id) {
              handleDelete(selectedTransaction._id);
            } else {
              console.error('Transaction or _id is missing:', selectedTransaction);
              toast.error('Error: Transaction ID is missing');
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Eliminar</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          style: {
            maxHeight: '90vh',
          }
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
          </DialogTitle>
          <DialogContent sx={{ overflowY: 'auto' }}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Tipo</InputLabel>
                      <Select {...field} label="Tipo">
                        <MenuItem value="expense">
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingDown color="error" />
                            Gasto
                          </Box>
                        </MenuItem>
                        <MenuItem value="income">
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingUp color="success" />
                            Ingreso
                          </Box>
                        </MenuItem>
                      </Select>
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
                      label="Monto"
                      type="number"
                      error={!!errors.amount}
                      helperText={errors.amount?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencySymbol(watch('currency') || userData?.currency || 'PEN')}
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <MoneyIcon fontSize="small" />
                          Moneda
                        </Box>
                      </InputLabel>
                      <Select {...field} label="Moneda" value={field.value || userData?.currency || 'PEN'}>
                        <MenuItem value="PEN">🇵🇪 PEN - Sol Peruano</MenuItem>
                        <MenuItem value="USD">🇺🇸 USD - Dólar</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="category_id"
                  control={control}
                  rules={{ required: 'La categoría es requerida' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.category_id}>
                      <InputLabel>Categoría</InputLabel>
                      <Select {...field} label="Categoría">
                        {filteredCategories.map(cat => (
                          <MenuItem key={cat._id} value={cat._id}>
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

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Descripción"
                      multiline
                      rows={2}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Description />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: 'La fecha es requerida' }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Fecha"
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

              <Grid item xs={12} sm={6}>
                <Controller
                  name="payment_method"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PaymentIcon fontSize="small" />
                          Método de Pago
                        </Box>
                      </InputLabel>
                      <Select {...field} label="Método de Pago">
                        <MenuItem value="">Ninguno</MenuItem>
                        <MenuItem value="cash">💵 Efectivo</MenuItem>
                        <MenuItem value="debit">💳 Débito</MenuItem>
                        <MenuItem value="credit">💳 Crédito</MenuItem>
                        <MenuItem value="transfer">🏦 Transferencia</MenuItem>
                        <MenuItem value="yape">📱 Yape</MenuItem>
                        <MenuItem value="plin">📱 Plin</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Etiquetas"
                      placeholder="Separadas por comas: urgente, importante, planificado"
                      helperText="Separa las etiquetas con comas"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LabelIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="is_recurring"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch 
                          {...field} 
                          checked={field.value}
                          icon={<RepeatIcon />}
                          checkedIcon={<RepeatIcon />}
                        />
                      }
                      label="Pago Recurrente"
                      sx={{ mt: 1 }}
                    />
                  )}
                />
              </Grid>

              {watchRecurring && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="recurring_period"
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
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTransaction ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Quick Payment Dialog */}
      <Dialog 
        open={openQuickDialog} 
        onClose={handleCloseQuickDialog} 
        maxWidth="sm" 
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmitQuick)}>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <FlashOnIcon color="secondary" />
              Registro Rápido de Pago
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Registra pagos del día rápidamente. Se vinculará automáticamente con tu presupuesto activo.
            </Alert>
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="amount"
                  control={control}
                  rules={{ required: 'El monto es requerido', min: 0.01 }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Monto del Pago"
                      type="number"
                      error={!!errors.amount}
                      helperText={errors.amount?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencySymbol(userData?.currency || 'PEN')}
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{ step: 0.01, min: 0 }}
                      autoFocus
                    />
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
                      fullWidth
                      label="¿Qué pagaste?"
                      placeholder="Ej: Almuerzo, Taxi, Compras del mercado..."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Description />
                          </InputAdornment>
                        ),
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
                    <FormControl fullWidth>
                      <InputLabel>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PaymentIcon fontSize="small" />
                          Método de Pago
                        </Box>
                      </InputLabel>
                      <Select {...field} label="Método de Pago">
                        <MenuItem value="cash">💵 Efectivo</MenuItem>
                        <MenuItem value="debit">💳 Débito</MenuItem>
                        <MenuItem value="credit">💳 Crédito</MenuItem>
                        <MenuItem value="transfer">🏦 Transferencia</MenuItem>
                        <MenuItem value="yape">📱 Yape</MenuItem>
                        <MenuItem value="plin">📱 Plin</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
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
            <Button onClick={handleCloseQuickDialog}>Cancelar</Button>
            <Button 
              type="submit" 
              variant="contained"
              color="secondary"
              startIcon={<FlashOnIcon />}
              disabled={quickTransactionMutation.isPending}
            >
              Registrar Pago
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Budget Creation Dialog */}
      <Dialog open={openBudgetDialog} onClose={() => setOpenBudgetDialog(false)} maxWidth="sm" fullWidth>
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
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">
                Total Semanal: S/ {(125 + 75 + 75 + 75).toFixed(2)}
              </Typography>
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
                monthlyIncome: 0 // User can update this later
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
    </Box>
  );
};

export default Transactions;