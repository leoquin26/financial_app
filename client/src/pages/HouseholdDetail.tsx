import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Avatar,
  AvatarGroup,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  FormGroup,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  LinearProgress,
  Alert,
  Tooltip,
  Divider,
  Menu,
  Skeleton,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material';
import {
  Home as HomeIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  Category as CategoryIcon,
  CalendarMonth as CalendarIcon,
  MoreVert as MoreVertIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as ViewIcon,
  Group as GroupIcon,
  Share as ShareIcon,
  ExitToApp as LeaveIcon,
  PersonAdd as PersonAddIcon,
  AccountBalance as AccountBalanceIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`household-tabpanel-${index}`}
      aria-labelledby={`household-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const HouseholdDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  // Settings form
  const { control: settingsControl, handleSubmit: handleSettingsSubmit, reset: resetSettings, formState: { errors: settingsErrors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      currency: 'PEN',
      defaultBudgetPeriod: 'monthly',
      autoAcceptMembers: false,
      requireApprovalForExpenses: false,
      expenseLimit: 0,
      notifyOnExpense: true,
      notifyOnBudgetExceed: true,
      shareAnalytics: true,
      allowGuestView: false,
    }
  });

  // Fetch household details
  const { data: household, isLoading: householdLoading } = useQuery({
    queryKey: ['household', id],
    queryFn: async () => {
      const response = await axios.get(`/api/households/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch household transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['household-transactions', id, dateRange],
    queryFn: async () => {
      const response = await axios.get(`/api/households/${id}/transactions`, {
        params: {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        },
      });
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch household budgets
  const { data: budgets, isLoading: budgetsLoading } = useQuery({
    queryKey: ['household-budgets', id],
    queryFn: async () => {
      const response = await axios.get(`/api/households/${id}/budgets`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch household analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['household-analytics', id, dateRange],
    queryFn: async () => {
      const response = await axios.get(`/api/households/${id}/analytics`, {
        params: {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        },
      });
      return response.data;
    },
    enabled: !!id,
  });

  // Update member permissions
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { memberId: string; permissions: any }) => {
      const response = await axios.put(
        `/api/households/${id}/members/${data.memberId}/permissions`,
        { permissions: data.permissions }
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Permisos actualizados');
      queryClient.invalidateQueries({ queryKey: ['household', id] });
      setPermissionsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar permisos');
    },
  });

  // Update member role
  const updateRoleMutation = useMutation({
    mutationFn: async (data: { memberId: string; role: string }) => {
      const response = await axios.put(
        `/api/households/${id}/members/${data.memberId}/role`,
        { role: data.role }
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Rol actualizado');
      queryClient.invalidateQueries({ queryKey: ['household', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar rol');
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await axios.delete(
        `/api/households/${id}/members/${memberId}`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Miembro removido');
      queryClient.invalidateQueries({ queryKey: ['household', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al remover miembro');
    },
  });

  // Update household settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await axios.put(`/api/households/${id}/settings`, settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Configuración actualizada');
      queryClient.invalidateQueries({ queryKey: ['household', id] });
      setSettingsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar configuración');
    },
  });

  // Populate settings form when household data is loaded
  useEffect(() => {
    if (household) {
      resetSettings({
        name: household.name || '',
        description: household.description || '',
        currency: household.settings?.currency || 'PEN',
        defaultBudgetPeriod: household.settings?.defaultBudgetPeriod || 'monthly',
        autoAcceptMembers: household.settings?.autoAcceptMembers || false,
        requireApprovalForExpenses: household.settings?.requireApprovalForExpenses || false,
        expenseLimit: household.settings?.expenseLimit || 0,
        notifyOnExpense: household.settings?.notifyOnExpense ?? true,
        notifyOnBudgetExceed: household.settings?.notifyOnBudgetExceed ?? true,
        shareAnalytics: household.settings?.shareAnalytics ?? true,
        allowGuestView: household.settings?.allowGuestView || false,
      });
    }
  }, [household, resetSettings]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket || !id) return;

    const handleMemberUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['household', id] });
    };

    const handleTransactionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['household-transactions', id] });
      queryClient.invalidateQueries({ queryKey: ['household-analytics', id] });
    };

    const handleBudgetUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['household-budgets', id] });
    };

    socket.on('household-member-updated', handleMemberUpdate);
    socket.on('household-transaction-updated', handleTransactionUpdate);
    socket.on('household-budget-updated', handleBudgetUpdate);

    return () => {
      socket.off('household-member-updated', handleMemberUpdate);
      socket.off('household-transaction-updated', handleTransactionUpdate);
      socket.off('household-budget-updated', handleBudgetUpdate);
    };
  }, [socket, id, queryClient]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <AdminIcon color="error" />;
      case 'admin':
        return <AdminIcon color="warning" />;
      case 'member':
        return <PersonIcon color="primary" />;
      case 'viewer':
        return <ViewIcon color="disabled" />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'admin':
        return 'warning';
      case 'member':
        return 'primary';
      case 'viewer':
        return 'default';
      default:
        return 'default';
    }
  };

  const calculateTotalExpenses = () => {
    if (!transactions?.transactions) return 0;
    return transactions.transactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
  };

  const calculateTotalIncome = () => {
    if (!transactions?.transactions) return 0;
    return transactions.transactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
  };

  const getCategoryData = () => {
    if (!analytics?.categoryBreakdown) return [];
    return analytics.categoryBreakdown.map((cat: any) => ({
      name: cat.name,
      value: cat.total,
      color: cat.color,
    }));
  };

  const getTrendData = () => {
    if (!analytics?.monthlyTrend) return [];
    return analytics.monthlyTrend;
  };

  const currentUserRole = household?.members?.find(
    (m: any) => m.user._id === user?.id || m.user === user?.id
  )?.role;

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);
  const canEditSettings = currentUserRole === 'owner';
  const canAddTransactions = ['owner', 'admin', 'member'].includes(currentUserRole);

  if (householdLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" height={60} />
        <Skeleton variant="rectangular" height={400} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (!household) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary">
          Hogar no encontrado
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/households')}
          sx={{ mt: 2 }}
        >
          Volver a Hogares
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                <HomeIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h4">{household.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {household.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip
                    size="small"
                    icon={<GroupIcon />}
                    label={`${household.members?.length || 0} miembros`}
                  />
                  <Chip
                    size="small"
                    icon={getRoleIcon(currentUserRole)}
                    label={currentUserRole}
                    color={getRoleColor(currentUserRole) as any}
                  />
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {canEditSettings && (
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setSettingsDialogOpen(true)}
                >
                  Configuración
                </Button>
              )}
              {canManageMembers && (
                <Button
                  variant="outlined"
                  startIcon={<PersonAddIcon />}
                  onClick={() => navigate(`/households/${id}/invite`)}
                >
                  Invitar
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<LeaveIcon />}
                onClick={() => {
                  if (window.confirm('¿Estás seguro de que quieres salir del hogar?')) {
                    // Handle leave household
                  }
                }}
              >
                Salir
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDownIcon color="error" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Gastos del mes
                  </Typography>
                  <Typography variant="h5">
                    S/. {calculateTotalExpenses().toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="success" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Ingresos del mes
                  </Typography>
                  <Typography variant="h5">
                    S/. {calculateTotalIncome().toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceIcon color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h5">
                    S/. {(calculateTotalIncome() - calculateTotalExpenses()).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon color="info" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Transacciones
                  </Typography>
                  <Typography variant="h5">
                    {transactions?.transactions?.length || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Paper>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Resumen" icon={<PieChartIcon />} iconPosition="start" />
          <Tab label="Miembros" icon={<GroupIcon />} iconPosition="start" />
          <Tab label="Transacciones" icon={<ReceiptIcon />} iconPosition="start" />
          <Tab label="Presupuestos" icon={<AccountBalanceIcon />} iconPosition="start" />
          <Tab label="Análisis" icon={<BarChartIcon />} iconPosition="start" />
        </Tabs>

        {/* Summary Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Category Breakdown */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Gastos por Categoría
                </Typography>
                {getCategoryData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getCategoryData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: S/.${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getCategoryData().map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 5 }}>
                    No hay datos disponibles
                  </Typography>
                )}
              </Paper>
            </Grid>

            {/* Monthly Trend */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Tendencia Mensual
                </Typography>
                {getTrendData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={getTrendData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stackId="1"
                        stroke="#4caf50"
                        fill="#4caf50"
                        name="Ingresos"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stackId="2"
                        stroke="#f44336"
                        fill="#f44336"
                        name="Gastos"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 5 }}>
                    No hay datos disponibles
                  </Typography>
                )}
              </Paper>
            </Grid>

            {/* Recent Transactions */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Transacciones Recientes
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setTabValue(2)}
                  >
                    Ver todas
                  </Button>
                </Box>
                <List>
                  {transactions?.transactions?.slice(0, 5).map((transaction: any) => (
                    <ListItem key={transaction._id} divider>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: transaction.type === 'income' ? 'success.main' : 'error.main' }}>
                          {transaction.type === 'income' ? <TrendingUpIcon /> : <TrendingDownIcon />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={transaction.description || transaction.category?.name}
                        secondary={format(new Date(transaction.date), 'PPP', { locale: es })}
                      />
                      <Typography
                        variant="h6"
                        color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                      >
                        {transaction.type === 'income' ? '+' : '-'} S/. {transaction.amount.toFixed(2)}
                      </Typography>
                    </ListItem>
                  ))}
                  {(!transactions?.transactions || transactions.transactions.length === 0) && (
                    <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                      No hay transacciones
                    </Typography>
                  )}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Members Tab */}
        <TabPanel value={tabValue} index={1}>
          <List>
            {household.members?.map((member: any) => (
              <Paper key={member.user._id || member.user} sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      {member.user.username?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {member.user.username || member.user.email}
                        <Chip
                          size="small"
                          icon={getRoleIcon(member.role)}
                          label={member.role}
                          color={getRoleColor(member.role) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {member.user.email}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          {member.permissions?.canAddTransactions && (
                            <Chip size="small" label="Agregar transacciones" variant="outlined" />
                          )}
                          {member.permissions?.canEditTransactions && (
                            <Chip size="small" label="Editar transacciones" variant="outlined" />
                          )}
                          {member.permissions?.canDeleteTransactions && (
                            <Chip size="small" label="Eliminar transacciones" variant="outlined" />
                          )}
                          {member.permissions?.canManageBudgets && (
                            <Chip size="small" label="Gestionar presupuestos" variant="outlined" />
                          )}
                          {member.permissions?.canInviteMembers && (
                            <Chip size="small" label="Invitar miembros" variant="outlined" />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  {canManageMembers && member.role !== 'owner' && (
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          setAnchorEl(e.currentTarget);
                          setSelectedMember(member);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              </Paper>
            ))}
          </List>

          {/* Member Actions Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem
              onClick={() => {
                setPermissionsDialogOpen(true);
                setAnchorEl(null);
              }}
            >
              <SecurityIcon sx={{ mr: 1 }} /> Editar permisos
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (window.confirm('¿Estás seguro de remover este miembro?')) {
                  removeMemberMutation.mutate(selectedMember.user._id);
                }
                setAnchorEl(null);
              }}
            >
              <DeleteIcon sx={{ mr: 1 }} /> Remover del hogar
            </MenuItem>
          </Menu>
        </TabPanel>

        {/* Transactions Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Transacciones Compartidas</Typography>
            {canAddTransactions && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setTransactionDialogOpen(true)}
              >
                Nueva Transacción
              </Button>
            )}
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions?.transactions?.map((transaction: any) => (
                  <TableRow key={transaction._id}>
                    <TableCell>
                      {format(new Date(transaction.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={transaction.category?.name}
                        style={{ backgroundColor: transaction.category?.color }}
                      />
                    </TableCell>
                    <TableCell>{transaction.user?.username}</TableCell>
                    <TableCell align="right">
                      <Typography
                        color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                      >
                        {transaction.type === 'income' ? '+' : '-'} S/. {transaction.amount.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Budgets Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Presupuestos del Hogar</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setBudgetDialogOpen(true)}
            >
              Nuevo Presupuesto
            </Button>
          </Box>
          <Grid container spacing={2}>
            {budgets?.map((budget: any) => (
              <Grid item xs={12} md={6} key={budget._id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">
                        {budget.category?.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={budget.period}
                        color="primary"
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Gastado
                        </Typography>
                        <Typography variant="body2">
                          S/. {budget.spent?.toFixed(2) || '0.00'} / S/. {budget.amount.toFixed(2)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((budget.spent / budget.amount) * 100, 100)}
                        color={
                          (budget.spent / budget.amount) > 0.9
                            ? 'error'
                            : (budget.spent / budget.amount) > 0.7
                            ? 'warning'
                            : 'success'
                        }
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Restante
                      </Typography>
                      <Typography
                        variant="body2"
                        color={budget.amount - budget.spent < 0 ? 'error' : 'success.main'}
                      >
                        S/. {(budget.amount - budget.spent).toFixed(2)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Análisis Detallado
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Alert severity="info">
                      <Typography variant="subtitle2">Top Categoría de Gastos</Typography>
                      <Typography variant="h6">
                        {analytics?.topCategory?.name || 'N/A'} - S/. {analytics?.topCategory?.total?.toFixed(2) || '0.00'}
                      </Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Alert severity="success">
                      <Typography variant="subtitle2">Tasa de Ahorro</Typography>
                      <Typography variant="h6">
                        {analytics?.savingsRate?.toFixed(1) || 0}%
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Speed Dial for Quick Actions */}
      {canAddTransactions && (
        <SpeedDial
          ariaLabel="Acciones rápidas"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<MoneyIcon />}
            tooltipTitle="Agregar Transacción"
            onClick={() => setTransactionDialogOpen(true)}
          />
          <SpeedDialAction
            icon={<AccountBalanceIcon />}
            tooltipTitle="Agregar Presupuesto"
            onClick={() => setBudgetDialogOpen(true)}
          />
          <SpeedDialAction
            icon={<PersonAddIcon />}
            tooltipTitle="Invitar Miembro"
            onClick={() => navigate(`/households/${id}/invite`)}
          />
        </SpeedDial>
      )}

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            Configuración del Hogar
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Información General
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="name"
                  control={settingsControl}
                  rules={{ required: 'Nombre requerido' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Nombre del hogar"
                      fullWidth
                      error={!!settingsErrors.name}
                      helperText={settingsErrors.name?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={settingsControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Descripción"
                      fullWidth
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="currency"
                  control={settingsControl}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Moneda</InputLabel>
                      <Select {...field} label="Moneda">
                        <MenuItem value="PEN">PEN - Sol Peruano</MenuItem>
                        <MenuItem value="USD">USD - Dólar</MenuItem>
                        <MenuItem value="EUR">EUR - Euro</MenuItem>
                        <MenuItem value="MXN">MXN - Peso Mexicano</MenuItem>
                        <MenuItem value="COP">COP - Peso Colombiano</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="defaultBudgetPeriod"
                  control={settingsControl}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Período de presupuesto</InputLabel>
                      <Select {...field} label="Período de presupuesto">
                        <MenuItem value="monthly">Mensual</MenuItem>
                        <MenuItem value="yearly">Anual</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Configuración de Miembros
            </Typography>
            <FormGroup>
              <Controller
                name="autoAcceptMembers"
                control={settingsControl}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                      />
                    }
                    label="Aceptar miembros automáticamente (sin aprobación)"
                  />
                )}
              />
              <Controller
                name="allowGuestView"
                control={settingsControl}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                      />
                    }
                    label="Permitir vista de invitados (solo lectura)"
                  />
                )}
              />
            </FormGroup>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Control de Gastos
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="requireApprovalForExpenses"
                  control={settingsControl}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          {...field}
                          checked={field.value}
                        />
                      }
                      label="Requerir aprobación para gastos grandes"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="expenseLimit"
                  control={settingsControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Límite de gasto sin aprobación"
                      type="number"
                      fullWidth
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1 }}>S/.</Typography>,
                      }}
                      helperText="0 = sin límite"
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Notificaciones
            </Typography>
            <FormGroup>
              <Controller
                name="notifyOnExpense"
                control={settingsControl}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                      />
                    }
                    label="Notificar cuando se agregue un gasto"
                  />
                )}
              />
              <Controller
                name="notifyOnBudgetExceed"
                control={settingsControl}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                      />
                    }
                    label="Notificar cuando se exceda el presupuesto"
                  />
                )}
              />
            </FormGroup>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Privacidad y Análisis
            </Typography>
            <FormGroup>
              <Controller
                name="shareAnalytics"
                control={settingsControl}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                      />
                    }
                    label="Compartir análisis con todos los miembros"
                  />
                )}
              />
            </FormGroup>

            {canEditSettings && (
              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  Solo el propietario del hogar puede modificar estas configuraciones.
                  Los cambios se aplicarán inmediatamente para todos los miembros.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSettingsSubmit((data) => {
              updateSettingsMutation.mutate({
                name: data.name,
                description: data.description,
                settings: {
                  currency: data.currency,
                  defaultBudgetPeriod: data.defaultBudgetPeriod,
                  autoAcceptMembers: data.autoAcceptMembers,
                  requireApprovalForExpenses: data.requireApprovalForExpenses,
                  expenseLimit: data.expenseLimit,
                  notifyOnExpense: data.notifyOnExpense,
                  notifyOnBudgetExceed: data.notifyOnBudgetExceed,
                  shareAnalytics: data.shareAnalytics,
                  allowGuestView: data.allowGuestView,
                }
              });
            })}
            disabled={!canEditSettings}
          >
            Guardar Cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={() => setPermissionsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon />
            Editar Permisos de {selectedMember?.user?.username}
          </Box>
        </DialogTitle>
        <DialogContent>
          <FormGroup sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canAddTransactions || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canAddTransactions: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede agregar transacciones"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canEditTransactions || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canEditTransactions: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede editar transacciones"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canDeleteTransactions || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canDeleteTransactions: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede eliminar transacciones"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canManageBudgets || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canManageBudgets: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede gestionar presupuestos"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canManageCategories || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canManageCategories: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede gestionar categorías"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canInviteMembers || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canInviteMembers: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede invitar miembros"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMember?.permissions?.canViewAnalytics || false}
                  onChange={(e) => {
                    setSelectedMember({
                      ...selectedMember,
                      permissions: {
                        ...selectedMember?.permissions,
                        canViewAnalytics: e.target.checked
                      }
                    });
                  }}
                />
              }
              label="Puede ver análisis"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionsDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => {
              if (selectedMember) {
                updatePermissionsMutation.mutate({
                  memberId: selectedMember.user._id || selectedMember.user,
                  permissions: selectedMember.permissions
                });
              }
            }}
          >
            Guardar Permisos
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HouseholdDetail;
