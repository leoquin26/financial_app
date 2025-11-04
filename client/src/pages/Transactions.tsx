import React, { useState, useEffect } from 'react';
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
  Description,
  Receipt,
  Refresh as RefreshIcon,
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

interface Transaction {
  id: number;
  amount: number;
  category_id: number;
  category_name: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  payment_method?: string;
  location?: string;
  tags?: string[];
  person?: string;
  is_recurring: boolean;
  recurring_period?: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

interface TransactionForm {
  amount: number;
  category_id: number;
  description: string;
  date: Date;
  type: 'income' | 'expense';
  payment_method?: string;
  tags?: string;
  is_recurring: boolean;
  recurring_period?: string;
}

const Transactions: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<number | ''>('');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Form
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TransactionForm>({
    defaultValues: {
      amount: 0,
      category_id: 0,
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
      return response.data.categories;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: TransactionForm) => {
      const payload = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
        categoryId: data.category_id,
      };
      const response = await axios.post('/api/transactions', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transacción creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear transacción');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TransactionForm }) => {
      const payload = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
        categoryId: data.category_id,
      };
      const response = await axios.put(`/api/transactions/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transacción actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar transacción');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/transactions/${id}`);
    },
    onSuccess: () => {
      toast.success('Transacción eliminada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar transacción');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
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

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleTransactionUpdate = () => {
      refetch();
    };

    socket.on('transaction-created', handleTransactionUpdate);
    socket.on('transaction-updated', handleTransactionUpdate);
    socket.on('transaction-deleted', handleTransactionUpdate);

    return () => {
      socket.off('transaction-created', handleTransactionUpdate);
      socket.off('transaction-updated', handleTransactionUpdate);
      socket.off('transaction-deleted', handleTransactionUpdate);
    };
  }, [socket, refetch]);

  // Handlers
  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      reset({
        amount: transaction.amount,
        category_id: transaction.category_id,
        description: transaction.description || '',
        date: parseISO(transaction.date),
        type: transaction.type,
        payment_method: transaction.payment_method || '',
        tags: transaction.tags?.join(', ') || '',
        is_recurring: transaction.is_recurring,
        recurring_period: transaction.recurring_period || 'monthly',
      });
    } else {
      setEditingTransaction(null);
      reset();
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
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
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
      const newSelected = transactions.transactions.map((t: Transaction) => t.id);
      setSelected(newSelected);
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (id: number) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: number[] = [];

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
    setAnchorEl(event.currentTarget);
    setSelectedTransaction(transaction);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTransaction(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  };

  const filteredCategories = categories?.filter(c => c.type === watchType) || [];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Transacciones
        </Typography>
        <Box display="flex" gap={2}>
          <IconButton onClick={() => refetch()} color="primary">
            <RefreshIcon />
          </IconButton>
          {selected.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              Eliminar ({selected.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nueva Transacción
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
                  <MenuItem key={cat.id} value={cat.id}>
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
      <TableContainer component={Paper}>
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
                    key={transaction.id}
                    hover
                    selected={selected.indexOf(transaction.id) !== -1}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.indexOf(transaction.id) !== -1}
                        onChange={() => handleSelectOne(transaction.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(parseISO(transaction.date), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<span>{transaction.icon}</span>}
                        label={transaction.category_name}
                        size="small"
                        sx={{
                          bgcolor: transaction.color + '20',
                          color: transaction.color,
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
                        {formatCurrency(transaction.amount)}
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
            if (selectedTransaction) {
              handleDelete(selectedTransaction.id);
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
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
          </DialogTitle>
          <DialogContent>
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
                          <InputAdornment position="start">S/</InputAdornment>
                        ),
                      }}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
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
                      <InputLabel>Método de Pago</InputLabel>
                      <Select {...field} label="Método de Pago">
                        <MenuItem value="">Ninguno</MenuItem>
                        <MenuItem value="cash">Efectivo</MenuItem>
                        <MenuItem value="debit">Débito</MenuItem>
                        <MenuItem value="credit">Crédito</MenuItem>
                        <MenuItem value="transfer">Transferencia</MenuItem>
                        <MenuItem value="yape">Yape</MenuItem>
                        <MenuItem value="plin">Plin</MenuItem>
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
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="is_recurring"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>¿Es recurrente?</InputLabel>
                      <Select {...field} label="¿Es recurrente?" value={field.value ? 'yes' : 'no'} onChange={(e) => field.onChange(e.target.value === 'yes')}>
                        <MenuItem value="no">No</MenuItem>
                        <MenuItem value="yes">Sí</MenuItem>
                      </Select>
                    </FormControl>
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
    </Box>
  );
};

export default Transactions;