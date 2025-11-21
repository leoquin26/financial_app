import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalanceWallet,
  Savings,
  ArrowUpward,
  ArrowDownward,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { axiosInstance as axios } from '../config/api';

interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    month: number;
    year: number;
  };
  comparison: {
    incomeChange: number;
    incomeChangePercent: number;
    expenseChange: number;
    expenseChangePercent: number;
  };
  expensesByCategory: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    total: number;
    count: number;
  }>;
  incomeByCategory: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    total: number;
    count: number;
  }>;
  expensesByPerson: Array<{
    person: string;
    total: number;
    count: number;
  }>;
  recentTransactions: Array<{
    id: number;
    amount: number;
    category_name: string;
    description: string;
    date: string;
    type: string;
    icon: string;
    color: string;
    person: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expenses: number;
  }>;
  budgets: Array<{
    id: number;
    category_name: string;
    amount: number;
    spent: number;
    percentage: number;
    color: string;
    icon: string;
  }>;
  goals: Array<{
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string;
  }>;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await axios.get('/api/dashboard/summary', {
        params: { month: selectedMonth, year: selectedYear },
      });
      return response.data;
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  };

  const StatCard = ({ title, value, change, changePercent, icon, color }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography color="textSecondary" gutterBottom variant="body2">
                {title}
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {formatCurrency(value)}
              </Typography>
              {change !== undefined && (
                <Box display="flex" alignItems="center" mt={1}>
                  {change >= 0 ? (
                    <ArrowUpward fontSize="small" color="success" />
                  ) : (
                    <ArrowDownward fontSize="small" color="error" />
                  )}
                  <Typography
                    variant="body2"
                    color={change >= 0 ? 'success.main' : 'error.main'}
                    ml={0.5}
                  >
                    {formatCurrency(Math.abs(change))} ({changePercent.toFixed(1)}%)
                  </Typography>
                </Box>
              )}
            </Box>
            <Box
              sx={{
                bgcolor: color + '20',
                p: 1.5,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (isLoading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Skeleton variant="rectangular" height={150} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error al cargar el dashboard. Por favor, intenta de nuevo.
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Dashboard Financiero
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Mes</InputLabel>
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as number)}
              label="Mes"
            >
              {[
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
              ].map((month, index) => (
                <MenuItem key={index + 1} value={index + 1}>
                  {month}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Año</InputLabel>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as number)}
              label="Año"
            >
              {[2023, 2024, 2025, 2026].map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton onClick={() => refetch()} color="primary">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/transactions')}
          >
            Nueva Transacción
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ingresos"
            value={data.summary.totalIncome}
            change={data.comparison.incomeChange}
            changePercent={data.comparison.incomeChangePercent}
            icon={<TrendingUp sx={{ fontSize: 30, color: 'success.main' }} />}
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Gastos"
            value={data.summary.totalExpenses}
            change={data.comparison.expenseChange}
            changePercent={data.comparison.expenseChangePercent}
            icon={<TrendingDown sx={{ fontSize: 30, color: 'error.main' }} />}
            color="#FF6B6B"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Balance"
            value={data.summary.balance}
            icon={<AccountBalanceWallet sx={{ fontSize: 30, color: 'primary.main' }} />}
            color="#4A90E2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ahorros"
            value={data.goals?.reduce((acc, goal) => acc + goal.current_amount, 0) || 0}
            icon={<Savings sx={{ fontSize: 30, color: 'secondary.main' }} />}
            color="#50C878"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} mb={3}>
        {/* Monthly Trend Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 400 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              Tendencia Mensual
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  stackId="1"
                  stroke="#4CAF50"
                  fill="#4CAF50"
                  fillOpacity={0.6}
                  name="Ingresos"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stackId="2"
                  stroke="#FF6B6B"
                  fill="#FF6B6B"
                  fillOpacity={0.6}
                  name="Gastos"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Expenses by Category Pie Chart */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 400 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              Gastos por Categoría
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={data.expensesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.total)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {data.expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Budget Alerts and Recent Transactions */}
      <Grid container spacing={3}>
        {/* Budget Alerts */}
        {data.budgets.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Alertas de Presupuesto
              </Typography>
              {data.budgets.map((budget) => (
                <Box key={budget.id} mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">
                      {budget.icon} {budget.category_name}
                    </Typography>
                    <Typography variant="body2" color={budget.percentage > 100 ? 'error' : 'warning.main'}>
                      {budget.percentage.toFixed(0)}% usado
                    </Typography>
                  </Box>
                  <Box sx={{ width: '100%', bgcolor: 'grey.200', borderRadius: 1, height: 8 }}>
                    <Box
                      sx={{
                        width: `${Math.min(budget.percentage, 100)}%`,
                        bgcolor: budget.percentage > 100 ? 'error.main' : 'warning.main',
                        borderRadius: 1,
                        height: '100%',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>
        )}

        {/* Recent Transactions */}
        <Grid item xs={12} md={data.budgets.length > 0 ? 6 : 12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Transacciones Recientes
              </Typography>
              <Button size="small" onClick={() => navigate('/transactions')}>
                Ver todas
              </Button>
            </Box>
            {data.recentTransactions.map((transaction) => (
              <Box
                key={transaction.id}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
                borderBottom="1px solid"
                borderColor="divider"
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      bgcolor: transaction.color + '20',
                      p: 1,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {transaction.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {transaction.category_name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {transaction.description || 'Sin descripción'}
                    </Typography>
                  </Box>
                </Box>
                <Box textAlign="right">
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {format(new Date(transaction.date), 'dd MMM', { locale: es })}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
