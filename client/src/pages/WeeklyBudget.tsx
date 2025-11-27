import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Divider
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  AutoFixHigh as AutoFixIcon,
  Lightbulb as InsightIcon,
  AttachMoney as MoneyIcon,
  Analytics as AnalyticsIcon,
  Delete as DeleteIcon,
  Pending as PendingIcon,
  CheckCircleOutline as PaidIcon,
  Error as OverdueIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfWeek } from 'date-fns';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'react-toastify';
import AIInsights from '../components/AIInsights';
import { useNavigate } from 'react-router-dom';

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface Allocation {
  _id?: string;
  categoryId: {
    _id: string;
    name: string;
    color: string;
  };
  name?: string;
  amount: number;
  spent: number;
  scheduledDate?: string;
  status?: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
  transactionId?: string;
}

interface ScheduledPayment {
  _id: string;
  name: string;
  amount: number;
  dueDate: string;
  categoryId: {
    name: string;
    color: string;
  };
  status: string;
}

// interface WeeklyBudgetData {
//   _id: string;
//   weekStartDate: string;
//   weekEndDate: string;
//   totalBudget: number;
//   allocations: Allocation[];
//   scheduledPayments: ScheduledPayment[];
//   remainingBudget: number;
//   insights?: {
//     topCategories: Array<{
//       categoryId: string;
//       amount: number;
//       percentage: number;
//     }>;
//     savingsPotential: number;
//     recommendations: string[];
//     lastAnalyzed: string;
//   };
// }

interface AutoAllocateResponse {
  allocations: Array<{
    categoryId: string;
    amount: number;
    spent: number;
  }>;
  totalRequired: number;
  remainingBudget: number;
  scheduledPayments: number;
}

const WeeklyBudget: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [totalBudget, setTotalBudget] = useState('');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [allocations, setAllocations] = useState<Array<{
    categoryId: string;
    name: string;
    amount: string;
    scheduledDate: string;
  }>>([]);
  const [isAutoAllocating, setIsAutoAllocating] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data;
    }
  });

  // Fetch current week budget
  const { data: currentBudget, isLoading } = useQuery({
    queryKey: ['weeklyBudget', 'current'],
    queryFn: async () => {
      const response = await axios.get('/api/weekly-budget/current');
      return response.data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false // Disable refetch on window focus
  });

  // Create/update budget mutation
  const saveBudgetMutation = useMutation({
    mutationFn: async (data: {
      weekStartDate: string;
      totalBudget: number;
      allocations: Array<{ categoryId: string; name?: string; amount: number; spent: number; scheduledDate?: string }>;
    }) => {
      const response = await axios.post('/api/weekly-budget', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget', 'current'] });
      toast.success('Budget saved successfully');
      setOpenDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save budget');
    }
  });

  // Analyze budget mutation
  const analyzeBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      const response = await axios.post(`/api/weekly-budget/${budgetId}/analyze`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Budget analysis completed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to analyze budget');
    }
  });

  // Update allocation status mutation
  const updateAllocationStatusMutation = useMutation({
    mutationFn: async ({ budgetId, allocationId, status }: { 
      budgetId: string; 
      allocationId: string; 
      status: 'pending' | 'paid' | 'overdue' 
    }) => {
      const response = await axios.patch(`/api/weekly-budget/allocation/${budgetId}/${allocationId}`, {
        status
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      console.log('Payment status updated, new data:', data);
      console.log('Allocations:', data.allocations.map((a: any) => ({ 
        name: a.name, 
        amount: a.amount, 
        spent: a.spent, 
        status: a.status 
      })));
      
      // Update the cache directly for immediate UI update
      queryClient.setQueryData(['weeklyBudget', 'current'], data);
      // Don't invalidate immediately - let the cache update persist
      toast.success(`Payment marked as ${variables.status === 'paid' ? 'paid' : 'pending'}`);
      
      // Invalidate other queries after a short delay to avoid race conditions
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['weeklyBudget'], exact: false });
      }, 100);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update payment status');
    }
  });

  // Auto-allocate mutation
  const autoAllocateMutation = useMutation({
    mutationFn: async (data: { weekStartDate: string; totalBudget: number }) => {
      const response = await axios.post('/api/weekly-budget/auto-allocate', data);
      return response.data;
    },
    onSuccess: (data: AutoAllocateResponse) => {
      // Convert auto-allocated data to form format
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const newAllocations = data.allocations.map(alloc => ({
        categoryId: alloc.categoryId,
        name: '',
        amount: alloc.amount.toString(),
        scheduledDate: format(weekStart, 'yyyy-MM-dd')
      }));
      setAllocations(newAllocations);
      toast.success('Budget auto-allocated based on scheduled payments and history');
      setIsAutoAllocating(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to auto-allocate budget');
      setIsAutoAllocating(false);
    }
  });

  // Initialize form when dialog opens
  useEffect(() => {
    if (openDialog && currentBudget) {
      setTotalBudget(currentBudget.totalBudget.toString());
      setAllocations(
        currentBudget.allocations.map((alloc: Allocation) => ({
          categoryId: alloc.categoryId._id,
          name: alloc.name || '',
          amount: alloc.amount.toString(),
          scheduledDate: alloc.scheduledDate ? format(new Date(alloc.scheduledDate), 'yyyy-MM-dd') : format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
        }))
      );
    }
  }, [openDialog, currentBudget]);

  const handleOpenDialog = () => {
    if (!currentBudget || currentBudget.totalBudget === 0) {
      setTotalBudget('');
      setAllocations([]);
    }
    setOpenDialog(true);
  };

  const handleAddAllocation = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    setAllocations([...allocations, { 
      categoryId: '', 
      name: '', 
      amount: '', 
      scheduledDate: format(weekStart, 'yyyy-MM-dd') 
    }]);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleAllocationChange = (index: number, field: string, value: string) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  };

  const handleAutoAllocate = () => {
    if (!totalBudget) {
      toast.error('Please enter a total budget first');
      return;
    }
    
    setIsAutoAllocating(true);
    autoAllocateMutation.mutate({
      weekStartDate: startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(),
      totalBudget: parseFloat(totalBudget)
    });
  };

  const handleSaveBudget = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    
    const formattedAllocations = allocations
      .filter(alloc => alloc.categoryId && alloc.amount)
      .map(alloc => ({
        categoryId: alloc.categoryId,
        name: alloc.name || undefined,
        amount: parseFloat(alloc.amount),
        spent: 0,
        scheduledDate: alloc.scheduledDate || undefined,
        status: 'pending' as const
      }));

    saveBudgetMutation.mutate({
      weekStartDate: weekStart.toISOString(),
      totalBudget: parseFloat(totalBudget),
      allocations: formattedAllocations
    });
  };

  const [stats, setStats] = useState({ spent: 0, remaining: 0, percentage: 0 });
  
  // Recalculate stats when currentBudget changes
  useEffect(() => {
    if (!currentBudget || !currentBudget.allocations) {
      console.log('No budget or allocations, resetting stats');
      setStats({ spent: 0, remaining: 0, percentage: 0 });
      return;
    }

    const totalSpent = currentBudget.allocations.reduce(
      (sum: number, alloc: Allocation) => sum + (alloc.spent || 0),
      0
    );
    const remaining = currentBudget.totalBudget - totalSpent;
    const percentage = currentBudget.totalBudget > 0 
      ? (totalSpent / currentBudget.totalBudget) * 100 
      : 0;

    console.log('Stats recalculated:', { 
      totalSpent, 
      remaining, 
      percentage,
      allocations: currentBudget.allocations.length,
      budget: currentBudget.totalBudget
    });
    setStats({ spent: totalSpent, remaining, percentage });
  }, [currentBudget]);

  // Prepare chart data
  const pieChartData = currentBudget?.allocations.map((alloc: Allocation) => ({
    name: alloc.categoryId.name,
    value: alloc.amount,
    spent: alloc.spent,
    color: alloc.categoryId.color
  })) || [];

  const barChartData = currentBudget?.allocations.map((alloc: Allocation) => ({
    name: alloc.categoryId.name,
    allocated: alloc.amount,
    spent: alloc.spent
  })) || [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Weekly Budget
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CalendarIcon />}
            onClick={() => navigate('/weekly-budget-dashboard')}
          >
            Calendar View
          </Button>
          <Button
            variant="outlined"
            startIcon={<AnalyticsIcon />}
            onClick={() => currentBudget && analyzeBudgetMutation.mutate(currentBudget._id)}
            disabled={!currentBudget || analyzeBudgetMutation.isPending}
          >
            Analyze
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleOpenDialog}
          >
            {currentBudget?.totalBudget > 0 ? 'Edit Budget' : 'Create Budget'}
          </Button>
        </Box>
      </Box>

      {/* Budget Overview */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total Budget
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${currentBudget?.totalBudget?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
                <BudgetIcon color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Spent
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    ${stats.spent.toFixed(2)}
                  </Typography>
                </Box>
                <MoneyIcon color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Remaining
                  </Typography>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold" 
                    color={stats.remaining >= 0 ? 'success.main' : 'error.main'}
                  >
                    ${Math.abs(stats.remaining).toFixed(2)}
                  </Typography>
                </Box>
                {stats.remaining >= 0 ? (
                  <CheckIcon color="success" />
                ) : (
                  <WarningIcon color="error" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box flex={1}>
                  <Typography color="textSecondary" variant="body2">
                    Progress
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color={stats.percentage > 100 ? 'error' : 'primary'}>
                    {stats.percentage.toFixed(0)}%
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ${stats.spent.toFixed(2)} / ${currentBudget?.totalBudget?.toFixed(2) || '0.00'}
                  </Typography>
                  <Box mt={1}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(stats.percentage, 100)}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          borderRadius: 4
                        }
                      }}
                      color={stats.percentage > 100 ? 'error' : 'primary'}
                    />
                  </Box>
                </Box>
                <AnalyticsIcon color="info" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" />
          <Tab label="Category Details" />
          <Tab label="Payment Cards" />
          <Tab label="Insights" />
          <Tab label="Scheduled Payments" />
          <Tab label="AI Assistant" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Budget Allocation
                </Typography>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.name}: $${entry.value}`}
                      >
                        {pieChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                    <Typography color="textSecondary">No budget allocated yet</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Allocated vs Spent
                </Typography>
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="allocated" fill="#8884d8" name="Allocated" />
                      <Bar dataKey="spent" fill="#82ca9d" name="Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                    <Typography color="textSecondary">No data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Category Breakdown
                </Typography>
                {isLoading ? (
                  <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress />
                  </Box>
                ) : currentBudget?.allocations && currentBudget.allocations.length > 0 ? (
                <List>
                  {currentBudget.allocations.map((alloc: Allocation, index: number) => {
                    const percentage = alloc.amount > 0 ? (alloc.spent / alloc.amount) * 100 : 0;
                    const isOverBudget = alloc.spent > alloc.amount;
                    
                    return (
                      <ListItem key={alloc._id || `${alloc.categoryId._id}-${index}`} divider sx={{ py: 2 }}>
                        <Box sx={{ flex: 1, pr: 2 }}>
                          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                            <Box
                              width={20}
                              height={20}
                              borderRadius="50%"
                              style={{ backgroundColor: alloc.categoryId.color }}
                            />
                            <Typography variant="body1">
                              {alloc.categoryId.name}
                              {alloc.name && ` - ${alloc.name}`}
                            </Typography>
                            {alloc.scheduledDate && (
                              <Chip
                                label={`Due: ${format(new Date(alloc.scheduledDate), 'MMM d')}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {isOverBudget && (
                              <Chip
                                label="Over Budget"
                                size="small"
                                color="error"
                              />
                            )}
                          </Box>
                          <Box mt={1.5}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(percentage, 100)}
                              sx={{ 
                                height: 10, 
                                borderRadius: 5,
                                backgroundColor: 'action.hover',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 5,
                                  backgroundColor: isOverBudget ? 'error.main' : 'primary.main'
                                }
                              }}
                            />
                            <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                              <Typography variant="body2" color="textSecondary">
                                ${alloc.spent.toFixed(2)} / ${alloc.amount.toFixed(2)}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                fontWeight="bold"
                                color={isOverBudget ? 'error' : 'primary'}
                              >
                                {percentage.toFixed(0)}%
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'flex-end',
                          minWidth: 120
                        }}>
                          <Typography
                            variant="h6"
                            color={isOverBudget ? 'error' : 'textPrimary'}
                          >
                            ${(alloc.amount - alloc.spent).toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            remaining
                          </Typography>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>
                ) : (
                  <Box textAlign="center" p={4}>
                    <Typography variant="body1" color="textSecondary">
                      No category allocations yet
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && currentBudget && (
        <>
          {/* Payment Summary Cards */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Total Payments
                  </Typography>
                  <Typography variant="h5">
                    ${currentBudget.allocations.reduce((sum: number, a: Allocation) => sum + a.amount, 0).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {currentBudget.allocations.length} payments scheduled
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Paid
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ${currentBudget.allocations
                      .filter((a: Allocation) => a.status === 'paid')
                      .reduce((sum: number, a: Allocation) => sum + a.amount, 0)
                      .toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {currentBudget.allocations.filter((a: Allocation) => a.status === 'paid').length} payments completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Pending
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    ${currentBudget.allocations
                      .filter((a: Allocation) => a.status !== 'paid')
                      .reduce((sum: number, a: Allocation) => sum + a.amount, 0)
                      .toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {currentBudget.allocations.filter((a: Allocation) => a.status !== 'paid').length} payments remaining
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Payment Cards */}
          <Grid container spacing={2}>
          {currentBudget.allocations.map((allocation: Allocation) => {
            const isPaid = allocation.status === 'paid';
            const isPending = allocation.status === 'pending';
            const isOverdue = allocation.status === 'overdue';
            
            // Check if payment is overdue
            const isActuallyOverdue = allocation.scheduledDate && 
              new Date(allocation.scheduledDate) < new Date() && 
              allocation.status === 'pending';
            
            const currentStatus = isPaid ? 'paid' : (isActuallyOverdue ? 'overdue' : 'pending');
            
            return (
              <Grid item xs={12} md={6} lg={4} key={allocation._id}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    height: '100%',
                    borderColor: isPaid ? 'success.main' : isActuallyOverdue ? 'error.main' : 'grey.300',
                    borderWidth: 2,
                    position: 'relative',
                    opacity: updateAllocationStatusMutation.isPending && 
                      updateAllocationStatusMutation.variables?.allocationId === allocation._id ? 0.7 : 1,
                    transition: 'opacity 0.3s'
                  }}
                >
                  <CardContent>
                    {/* Header */}
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Box
                            width={24}
                            height={24}
                            borderRadius="50%"
                            style={{ backgroundColor: allocation.categoryId.color }}
                          />
                          <Typography variant="h6">
                            {allocation.name || allocation.categoryId.name}
                          </Typography>
                        </Box>
                        {allocation.name && (
                          <Typography variant="body2" color="textSecondary">
                            {allocation.categoryId.name}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        {isPaid && <PaidIcon color="success" />}
                        {isPending && !isActuallyOverdue && <PendingIcon color="warning" />}
                        {isActuallyOverdue && <OverdueIcon color="error" />}
                      </Box>
                    </Box>

                    {/* Amount */}
                    <Typography variant="h4" gutterBottom>
                      ${allocation.amount.toFixed(2)}
                    </Typography>

                    {/* Scheduled Date */}
                    {allocation.scheduledDate && (
                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          Due: {format(new Date(allocation.scheduledDate), 'MMM d, yyyy')}
                        </Typography>
                      </Box>
                    )}

                    {/* Status Dropdown */}
                    <Box mb={2}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Status"
                        value={currentStatus}
                        onChange={(e) => {
                          if (currentBudget._id && allocation._id) {
                            updateAllocationStatusMutation.mutate({
                              budgetId: currentBudget._id,
                              allocationId: allocation._id,
                              status: e.target.value as 'pending' | 'paid' | 'overdue'
                            });
                          }
                        }}
                        disabled={updateAllocationStatusMutation.isPending}
                        InputProps={{
                          endAdornment: updateAllocationStatusMutation.isPending && (
                            <CircularProgress size={20} />
                          )
                        }}
                        SelectProps={{
                          native: true,
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </TextField>
                    </Box>

                    {/* Paid Date */}
                    {allocation.paidDate && (
                      <Typography variant="body2" color="textSecondary">
                        Paid on: {format(new Date(allocation.paidDate), 'MMM d, yyyy')}
                      </Typography>
                    )}

                    {/* Progress Bar */}
                    <Box mt={2}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          Progress
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          ${allocation.spent.toFixed(2)} / ${allocation.amount.toFixed(2)}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min((allocation.spent / allocation.amount) * 100, 100)}
                        color={isPaid ? 'success' : 'primary'}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
          </Grid>
        </>
      )}

      {tabValue === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Budget Insights & Recommendations
                  </Typography>
                  <InsightIcon color="primary" />
                </Box>
                {currentBudget?.insights ? (
                  <>
                    {currentBudget.insights.savingsPotential > 0 && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          Potential savings identified: ${currentBudget.insights.savingsPotential.toFixed(2)}
                        </Typography>
                      </Alert>
                    )}
                    <List>
                      {currentBudget.insights.recommendations.map((rec: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={rec}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                    {currentBudget.insights.lastAnalyzed && (
                      <Typography variant="caption" color="textSecondary">
                        Last analyzed: {format(new Date(currentBudget.insights.lastAnalyzed), 'MMM d, yyyy h:mm a')}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Box textAlign="center" py={4}>
                    <Typography color="textSecondary" gutterBottom>
                      No insights available yet
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AnalyticsIcon />}
                      onClick={() => currentBudget && analyzeBudgetMutation.mutate(currentBudget._id)}
                      sx={{ mt: 2 }}
                    >
                      Generate Insights
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Scheduled Payments This Week
                </Typography>
                <List>
                  {currentBudget?.scheduledPayments?.length > 0 ? (
                    currentBudget.scheduledPayments.map((payment: ScheduledPayment) => (
                      <ListItem key={payment._id} divider>
                        <Box flex={1}>
                          <Typography variant="body1">{payment.name}</Typography>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Chip
                              label={payment.categoryId.name}
                              size="small"
                              style={{
                                backgroundColor: payment.categoryId.color,
                                color: 'white'
                              }}
                            />
                            <Typography variant="body2">
                              Due: {format(new Date(payment.dueDate), 'MMM d')}
                            </Typography>
                            <Chip
                              label={payment.status}
                              size="small"
                              color={
                                payment.status === 'paid' ? 'success' :
                                payment.status === 'overdue' ? 'error' : 'default'
                              }
                            />
                          </Box>
                        </Box>
                        <ListItemSecondaryAction>
                          <Typography variant="h6">
                            ${payment.amount}
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))
                  ) : (
                    <ListItem>
                      <ListItemText
                        primary="No scheduled payments for this week"
                        primaryTypographyProps={{ color: 'textSecondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AIInsights />
          </Grid>
        </Grid>
      )}

      {/* Budget Setup Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} className="budget-setup-dialog">
        <DialogTitle>
          {currentBudget?.totalBudget > 0 ? 'Edit Weekly Budget' : 'Set Up Weekly Budget'}
        </DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              label="Total Weekly Budget"
              type="number"
              fullWidth
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="subtitle1">
                  Category Allocations
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Optional - You can add allocations later
                </Typography>
              </Box>
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  startIcon={<AutoFixIcon />}
                  onClick={handleAutoAllocate}
                  disabled={!totalBudget || isAutoAllocating}
                >
                  Auto-Allocate
                </Button>
                <Button
                  size="small"
                  onClick={handleAddAllocation}
                >
                  Add Category
                </Button>
              </Box>
            </Box>

            {isAutoAllocating && (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={24} />
              </Box>
            )}

            <List>
              {allocations.map((alloc, index) => (
                <ListItem key={index} disableGutters>
                  <Box width="100%" mb={2}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <TextField
                          select
                          label="Category"
                          fullWidth
                          value={alloc.categoryId}
                          onChange={(e) => handleAllocationChange(index, 'categoryId', e.target.value)}
                          SelectProps={{
                            native: true,
                          }}
                        >
                          <option value="">Select category</option>
                          {categories.map((cat: Category) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Name/Description"
                          fullWidth
                          value={alloc.name}
                          onChange={(e) => handleAllocationChange(index, 'name', e.target.value)}
                          placeholder="e.g., Monthly Rent"
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Amount"
                          type="number"
                          fullWidth
                          value={alloc.amount}
                          onChange={(e) => handleAllocationChange(index, 'amount', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          label="Payment Date"
                          type="date"
                          fullWidth
                          value={alloc.scheduledDate}
                          onChange={(e) => handleAllocationChange(index, 'scheduledDate', e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1}>
                        <IconButton
                          onClick={() => handleRemoveAllocation(index)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Box>
                </ListItem>
              ))}
            </List>

            {allocations.length > 0 && (
              <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
                <Typography variant="body2" color="textSecondary">
                  Total Allocated: $
                  {allocations
                    .reduce((sum, alloc) => sum + (parseFloat(alloc.amount) || 0), 0)
                    .toFixed(2)
                  } / ${totalBudget || 0}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveBudget}
            variant="contained"
            disabled={!totalBudget || saveBudgetMutation.isPending}
          >
            Save Budget
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WeeklyBudget;
