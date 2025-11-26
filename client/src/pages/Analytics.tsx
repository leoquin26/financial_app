import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  DateRange,
  FileDownload,
  Info,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  CalendarMonth,
  AttachMoney,
  Savings,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency as formatCurrencyUtil } from '../utils/currencies';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { motion } from 'framer-motion';
import { axiosInstance as axios } from '../config/api';
import toast from 'react-hot-toast';

interface AnalyticsData {
  period: {
    start: Date;
    end: Date;
  };
  overview: {
    income: {
      total: number;
      count: number;
      average: number;
      min?: number;
      max?: number;
    };
    expense: {
      total: number;
      count: number;
      average: number;
      min?: number;
      max?: number;
    };
    balance: number;
    savingsRate: number;
  };
  trends: Array<{
    date: string;
    income: number;
    expense: number;
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    type: string;
    total: number;
    count: number;
    average: number;
  }>;
  topTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    category: string;
    categoryColor: string;
    categoryIcon: string;
    description: string;
    date: Date;
  }>;
  budgetPerformance: Array<{
    id: string;
    category: string;
    categoryColor: string;
    categoryIcon: string;
    budgeted: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'good' | 'warning' | 'exceeded';
  }>;
  dayOfWeekAnalysis: Array<{
    day: string;
    income: number;
    expense: number;
  }>;
  monthGrowth: Array<{
    month: string;
    incomeGrowth: number;
    expenseGrowth: number;
  }>;
}

interface Insight {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

const COLORS = [
  '#4A90E2', '#50C878', '#FFD93D', '#FF6B6B', '#A78BFA',
  '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
];

const Analytics: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('6months');
  const [tabValue, setTabValue] = useState(0);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area');

  // Calculate date range based on period
  const getDateRange = () => {
    const end = endOfMonth(new Date());
    let start;
    
    switch (period) {
      case '1month':
        start = startOfMonth(new Date());
        break;
      case '3months':
        start = startOfMonth(subMonths(new Date(), 2));
        break;
      case '6months':
        start = startOfMonth(subMonths(new Date(), 5));
        break;
      case '1year':
        start = startOfMonth(subMonths(new Date(), 11));
        break;
      default:
        start = startOfMonth(subMonths(new Date(), 5));
    }
    
    return { start, end };
  };

  const { start, end } = getDateRange();

  // Fetch analytics data
  const { data: analyticsData, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['analytics', period],
    queryFn: async () => {
      const response = await axios.get('/api/analytics/overview', {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          period: 'month'
        }
      });
      return response.data;
    },
  });

  // Fetch insights
  const { data: insightsData } = useQuery<{ insights: Insight[] }>({
    queryKey: ['insights'],
    queryFn: async () => {
      const response = await axios.get('/api/analytics/insights');
      return response.data;
    },
  });

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'PEN');
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const exportData = () => {
    if (!analyticsData) return;
    
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `analytics_${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success('Datos exportados exitosamente');
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (!analyticsData) {
    return (
      <Alert severity="error">
        Error al cargar los datos de análisis
      </Alert>
    );
  }

  const expenseCategories = analyticsData.categoryBreakdown.filter(c => c.type === 'expense');
  const incomeCategories = analyticsData.categoryBreakdown.filter(c => c.type === 'income');

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      {/* Header */}
      <Box 
        display="flex" 
        flexDirection={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }} 
        gap={2}
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Análisis Financiero
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap" justifyContent={{ xs: 'center', sm: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Período</InputLabel>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              label="Período"
            >
              <MenuItem value="1month">Este mes</MenuItem>
              <MenuItem value="3months">3 meses</MenuItem>
              <MenuItem value="6months">6 meses</MenuItem>
              <MenuItem value="1year">1 año</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Actualizar datos">
            <IconButton onClick={() => refetch()}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={exportData}
            size="small"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Exportar
          </Button>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Ingresos Totales
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {formatCurrency(analyticsData.overview.income.total)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {analyticsData.overview.income.count} transacciones
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.light' }}>
                    <TrendingUp color="success" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Gastos Totales
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {formatCurrency(analyticsData.overview.expense.total)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {analyticsData.overview.expense.count} transacciones
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'error.light' }}>
                    <TrendingDown color="error" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Balance
                    </Typography>
                    <Typography 
                      variant="h5" 
                      fontWeight="bold"
                      color={analyticsData.overview.balance >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatCurrency(analyticsData.overview.balance)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {analyticsData.overview.balance >= 0 ? 'Superávit' : 'Déficit'}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.light' }}>
                    <AccountBalance color="primary" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Tasa de Ahorro
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {analyticsData.overview.savingsRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Del ingreso total
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'secondary.light' }}>
                    <Savings color="secondary" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Insights Alert */}
      {insightsData && insightsData.insights.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Insights y Recomendaciones
          </Typography>
          <List>
            {insightsData.insights.map((insight, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemAvatar>
                    {getInsightIcon(insight.type)}
                  </ListItemAvatar>
                  <ListItemText
                    primary={insight.title}
                    secondary={insight.message}
                  />
                </ListItem>
                {index < insightsData.insights.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Charts Tabs */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="Tendencias" icon={<ShowChart />} iconPosition="start" />
          <Tab label="Categorías" icon={<PieChartIcon />} iconPosition="start" />
          <Tab label="Presupuestos" icon={<BarChartIcon />} iconPosition="start" />
          <Tab label="Patrones" icon={<CalendarMonth />} iconPosition="start" />
        </Tabs>

        {/* Trends Chart */}
        {tabValue === 0 && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Tendencia de Ingresos vs Gastos</Typography>
              <FormControl size="small">
                <Select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as any)}
                >
                  <MenuItem value="area">Área</MenuItem>
                  <MenuItem value="line">Línea</MenuItem>
                  <MenuItem value="bar">Barras</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'area' ? (
                <AreaChart data={analyticsData.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Ingresos"
                    stroke="#4CAF50"
                    fill="#4CAF50"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Gastos"
                    stroke="#FF6B6B"
                    fill="#FF6B6B"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              ) : chartType === 'line' ? (
                <LineChart data={analyticsData.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Ingresos"
                    stroke="#4CAF50"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Gastos"
                    stroke="#FF6B6B"
                    strokeWidth={2}
                  />
                </LineChart>
              ) : (
                <BarChart data={analyticsData.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="income" name="Ingresos" fill="#4CAF50" />
                  <Bar dataKey="expense" name="Gastos" fill="#FF6B6B" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        )}

        {/* Categories Chart */}
        {tabValue === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Distribución de Gastos
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    dataKey="total"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ categoryName, percent }) => 
                      `${categoryName} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={index} fill={entry.categoryColor || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Fuentes de Ingresos
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeCategories}
                    dataKey="total"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ categoryName, percent }) => 
                      `${categoryName} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {incomeCategories.map((entry, index) => (
                      <Cell key={index} fill={entry.categoryColor || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        )}

        {/* Budget Performance */}
        {tabValue === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Rendimiento de Presupuestos
            </Typography>
            {analyticsData.budgetPerformance.length > 0 ? (
              <Box>
                {analyticsData.budgetPerformance.map((budget) => (
                  <Box key={budget.id} mb={3}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography>{budget.categoryIcon}</Typography>
                        <Typography variant="subtitle1">{budget.category}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="body2" color="textSecondary">
                          {formatCurrency(budget.spent)} / {formatCurrency(budget.budgeted)}
                        </Typography>
                        <Chip
                          label={`${budget.percentage.toFixed(0)}%`}
                          size="small"
                          color={
                            budget.status === 'exceeded' ? 'error' :
                            budget.status === 'warning' ? 'warning' : 'success'
                          }
                        />
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(budget.percentage, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: 
                            budget.status === 'exceeded' ? 'error.main' :
                            budget.status === 'warning' ? 'warning.main' : 'success.main'
                        }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                No hay presupuestos configurados para este período
              </Alert>
            )}
          </Box>
        )}

        {/* Patterns */}
        {tabValue === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Gastos por Día de la Semana
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.dayOfWeekAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="expense" name="Gastos" fill="#FF6B6B" />
                  <Bar dataKey="income" name="Ingresos" fill="#4CAF50" />
                </BarChart>
              </ResponsiveContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Crecimiento Mes a Mes
              </Typography>
              {analyticsData.monthGrowth.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.monthGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="incomeGrowth"
                      name="Crecimiento Ingresos"
                      stroke="#4CAF50"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenseGrowth"
                      name="Crecimiento Gastos"
                      stroke="#FF6B6B"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Alert severity="info">
                  Datos insuficientes para calcular crecimiento
                </Alert>
              )}
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Top Transactions */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Transacciones Más Importantes
        </Typography>
        <List>
          {analyticsData.topTransactions.map((transaction, index) => (
            <React.Fragment key={transaction.id}>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: transaction.categoryColor }}>
                    {transaction.categoryIcon}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  disableTypography
                  primary={
                    <Box display="flex" justifyContent="space-between">
                      <Typography>{transaction.description || transaction.category}</Typography>
                      <Typography
                        fontWeight="bold"
                        color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box display="flex" justifyContent="space-between" mt={0.5}>
                      <Typography variant="body2" color="textSecondary">{transaction.category}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {format(new Date(transaction.date), 'dd MMM yyyy', { locale: es })}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < analyticsData.topTransactions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Analytics;