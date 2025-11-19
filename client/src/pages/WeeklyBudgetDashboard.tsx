import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Tab,
  Tabs,
  LinearProgress
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from '../config/api';
import { startOfWeek, endOfWeek, format, subWeeks } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import WeeklyBudgetCalendar from '../components/WeeklyBudgetCalendar';

interface WeeklyBudgetData {
  _id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalBudget: number;
  allocations: Array<{
    categoryId: {
      _id: string;
      name: string;
      color: string;
    };
    amount: number;
    spent: number;
    status?: string;
  }>;
  remainingBudget: number;
}

const WeeklyBudgetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);

  // Fetch current week budget
  const { data: currentWeekBudget } = useQuery({
    queryKey: ['currentWeekBudget'],
    queryFn: async () => {
      const response = await axios.get('/api/weekly-budget/current');
      return response.data;
    }
  });

  // Fetch last 8 weeks for trends
  const { data: recentBudgets = [] } = useQuery({
    queryKey: ['recentWeeklyBudgets'],
    queryFn: async () => {
      const endDate = endOfWeek(new Date());
      const startDate = startOfWeek(subWeeks(new Date(), 7));
      
      const response = await axios.get('/api/weekly-budget/range', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      return response.data;
    }
  });

  // Calculate statistics
  const stats = {
    currentWeekBudget: currentWeekBudget?.totalBudget || 0,
    currentWeekSpent: currentWeekBudget?.allocations.reduce((sum: number, a: any) => sum + a.spent, 0) || 0,
    currentWeekRemaining: currentWeekBudget?.remainingBudget || 0,
    totalBudgeted: recentBudgets.reduce((sum: number, b: WeeklyBudgetData) => sum + b.totalBudget, 0),
    totalSpent: recentBudgets.reduce((sum: number, b: WeeklyBudgetData) => 
      sum + b.allocations.reduce((s: number, a: any) => s + a.spent, 0), 0
    ),
    averageWeeklyBudget: recentBudgets.length > 0 
      ? recentBudgets.reduce((sum: number, b: WeeklyBudgetData) => sum + b.totalBudget, 0) / recentBudgets.length
      : 0,
    completionRate: currentWeekBudget?.allocations.length > 0
      ? (currentWeekBudget.allocations.filter((a: any) => a.status === 'paid').length / currentWeekBudget.allocations.length) * 100
      : 0
  };

  // Prepare trend data
  const trendData = recentBudgets.map((budget: WeeklyBudgetData) => ({
    week: format(new Date(budget.weekStartDate), 'MMM d'),
    budget: budget.totalBudget,
    spent: budget.allocations.reduce((sum: number, a: any) => sum + a.spent, 0),
    remaining: budget.remainingBudget
  }));

  // Prepare category breakdown for current week
  const categoryData = currentWeekBudget?.allocations.map((alloc: any) => ({
    name: alloc.categoryId.name,
    value: alloc.amount,
    color: alloc.categoryId.color,
    spent: alloc.spent
  })) || [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const handleWeekSelect = (weekStart: Date) => {
    setSelectedWeek(weekStart);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Weekly Budget Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/weekly-budget')}
        >
          Manage Current Week
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Current Week Budget
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${stats.currentWeekBudget.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {format(startOfWeek(new Date()), 'MMM d')} - {format(endOfWeek(new Date()), 'MMM d')}
                  </Typography>
                </Box>
                <DashboardIcon color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Week Progress
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    ${stats.currentWeekSpent.toFixed(2)}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((stats.currentWeekSpent / Math.max(stats.currentWeekBudget, 1)) * 100, 100)}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <TrendingUpIcon color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Average Weekly
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${stats.averageWeeklyBudget.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Last 8 weeks
                  </Typography>
                </Box>
                <AnalyticsIcon color="info" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Completion Rate
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {stats.completionRate.toFixed(0)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Payments completed
                  </Typography>
                </Box>
                <CalendarIcon color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Calendar View" />
          <Tab label="Trends & Analytics" />
          <Tab label="Category Breakdown" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <WeeklyBudgetCalendar onWeekSelect={handleWeekSelect} />
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Budget Trends
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="budget" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Budget"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="spent" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Spent"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  8-Week Summary
                </Typography>
                <Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Total Budgeted:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${stats.totalBudgeted.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Total Spent:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${stats.totalSpent.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Savings:</Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold"
                      color={stats.totalBudgeted - stats.totalSpent >= 0 ? 'success.main' : 'error.main'}
                    >
                      ${Math.abs(stats.totalBudgeted - stats.totalSpent).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body2">Budgets Created:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {recentBudgets.length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && currentWeekBudget && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Budget Allocation by Category
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Category Spending
                </Typography>
                <Box height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" name="Allocated" />
                      <Bar dataKey="spent" fill="#82ca9d" name="Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default WeeklyBudgetDashboard;
