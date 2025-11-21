import React, { useState } from 'react';
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
  Alert,
  CircularProgress,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Avatar,
  CardActionArea,
  FormControlLabel,
  Switch,
  InputAdornment,
  Skeleton,
  Divider,
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowForwardIcon,
  Group as GroupIcon,
  DateRange as DateRangeIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CleaningServices as CleaningServicesIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, differenceInDays } from 'date-fns';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import CreateMainBudgetDialog from '../components/CreateMainBudgetDialog';

interface MainBudget {
  _id: string;
  name: string;
  description?: string;
  period: {
    type: 'monthly' | 'quarterly' | 'yearly' | 'custom';
    startDate: string;
    endDate: string;
    year: number;
    month?: number;
    quarter?: number;
  };
  totalBudget: number;
  status: 'draft' | 'active' | 'completed' | 'archived';
  weeklyBudgets: Array<{
    weekNumber: number;
    budgetId?: string;
    startDate: string;
    endDate: string;
    allocatedAmount: number;
    status: 'pending' | 'active' | 'completed';
  }>;
  analytics: {
    totalSpent: number;
    totalRemaining: number;
    weeklyAverage: number;
  };
  progressPercentage: number;
  daysRemaining: number;
  isCurrentPeriod: boolean;
  householdId?: string;
}

interface WeekCardProps {
  week: MainBudget['weeklyBudgets'][0];
  mainBudgetId: string;
  onNavigate: (weekNumber: number) => void;
}

const WeekCard: React.FC<WeekCardProps> = ({ week, mainBudgetId, onNavigate }) => {
  // Determine actual status based on dates
  const now = new Date();
  const weekStart = new Date(week.startDate);
  const weekEnd = new Date(week.endDate);
  
  // Check if this is the current week
  const isCurrentWeek = now >= weekStart && now <= weekEnd;
  const isPastWeek = now > weekEnd;
  const isFutureWeek = now < weekStart;
  
  // Override status based on dates
  const actualStatus = isPastWeek ? 'past' : (isCurrentWeek ? 'active' : 'upcoming');
  const hasData = week.budgetId !== null;

  return (
    <Card 
      sx={{ 
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.3s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        },
        border: isCurrentWeek ? '2px solid' : '1px solid',
        borderColor: isCurrentWeek ? 'primary.main' : isPastWeek ? 'grey.300' : 'divider',
        bgcolor: isPastWeek ? 'grey.50' : 'background.paper',
        opacity: isPastWeek && !hasData ? 0.7 : 1,
      }}
    >
      <CardActionArea onClick={() => onNavigate(week.weekNumber)} sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight="bold">
              Week {week.weekNumber}
            </Typography>
            {isCurrentWeek && (
              <Chip 
                label="Active" 
                color="primary" 
                size="small"
                icon={<ScheduleIcon />}
              />
            )}
            {isPastWeek && (
              <Chip 
                label="Past" 
                color="default" 
                size="small"
                icon={<HistoryIcon />}
              />
            )}
            {isFutureWeek && (
              <Chip 
                label="Upcoming" 
                variant="outlined" 
                size="small"
              />
            )}
          </Box>

          <Typography variant="caption" color="textSecondary" display="block" mb={2}>
            {format(new Date(week.startDate), 'MMM d')} - {format(new Date(week.endDate), 'MMM d')}
          </Typography>

          <Typography 
            variant="h5" 
            fontWeight="bold" 
            color={isCurrentWeek ? 'primary' : isPastWeek ? 'textSecondary' : 'textPrimary'}
          >
            ${week.allocatedAmount.toLocaleString()}
          </Typography>
          
          {week.budgetId && (
            <Box display="flex" alignItems="center" gap={0.5} mt={1}>
              <Typography variant="body2" color="textSecondary">
                View details
              </Typography>
              <ArrowForwardIcon fontSize="small" color="action" />
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const MainBudgets: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [periodFilter, setPeriodFilter] = useState<'all' | 'monthly' | 'quarterly' | 'yearly'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<MainBudget | null>(null);
  
  // Force recalculation when returning from other pages
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
    queryClient.invalidateQueries({ queryKey: ['availableIncome'] });
  }, [location.pathname, queryClient]);

  // Fetch main budgets
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['mainBudgets', periodFilter, statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (periodFilter !== 'all') params.period = periodFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const response = await axios.get('/api/main-budgets', { params });
      return response.data as MainBudget[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Fetch available income (total income - total allocated to budgets)
  const { data: availableIncome = { total: 0, allocated: 0, available: 0 } } = useQuery({
    queryKey: ['availableIncome'],
    queryFn: async () => {
      const response = await axios.get('/api/dashboard/available-income');
      return response.data;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Fetch all weekly budgets to show them alongside main budgets
  const { data: weeklyBudgets = [] } = useQuery({
    queryKey: ['weeklyBudgets', 'all'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/weekly-budget');
        return Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        console.error('Error fetching weekly budgets:', error);
        return [];
      }
    },
  });

  // Navigate to weekly budget
  const navigateToWeeklyBudget = async (mainBudgetId: string, weekNumber: number) => {
    try {
      // Create or get the weekly budget
      const response = await axios.post(`/api/main-budgets/${mainBudgetId}/weekly/${weekNumber}`);
      const weeklyBudget = response.data;
      
      // Invalidate main budgets to ensure fresh data when returning
      queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
      
      // Navigate to the weekly budget page
      navigate(`/budgets/week/${weeklyBudget._id}`);
    } catch (error) {
      console.error('Error navigating to weekly budget:', error);
      toast.error('Failed to load weekly budget');
    }
  };

  // Delete budget mutation
  const deleteBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      const response = await axios.delete(`/api/main-budgets/${budgetId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Budget deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['availableIncome'] });
      setDeleteDialogOpen(false);
      setBudgetToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete budget');
    },
  });

  // Get current/active budgets
  const activeBudgets = budgets.filter(b => b.isCurrentPeriod && b.status === 'active');
  
  // Get past, future, and other budgets
  const now = new Date();
  const pastBudgets = budgets.filter(b => 
    new Date(b.period.endDate) < now && 
    !activeBudgets.includes(b)
  );
  const futureBudgets = budgets.filter(b => 
    new Date(b.period.startDate) > now && 
    !activeBudgets.includes(b)
  );
  const otherBudgets = budgets.filter(b => 
    !activeBudgets.includes(b) && 
    !pastBudgets.includes(b) && 
    !futureBudgets.includes(b)
  );

  // Auto-recalculate budgets where total doesn't match sum of weekly allocations
  React.useEffect(() => {
    const recalculateBudgets = async () => {
      let hasRecalculated = false;
      
      for (const budget of activeBudgets) {
        // Calculate sum of weekly allocations
        const weeklySum = budget.weeklyBudgets.reduce((sum, week) => sum + (week.allocatedAmount || 0), 0);
        
        // If total doesn't match the sum, recalculate
        if (budget.totalBudget !== weeklySum && weeklySum > 0) {
          try {
            console.log(`Recalculating budget ${budget.name}: ${budget.totalBudget} -> ${weeklySum}`);
            await axios.post(`/api/main-budgets/${budget._id}/recalculate-total`);
            hasRecalculated = true;
          } catch (error) {
            console.error('Failed to auto-recalculate budget:', budget._id, error);
          }
        }
      }
      
      // If we recalculated any budgets, invalidate the query to refresh
      if (hasRecalculated) {
        queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
      }
    };

    if (activeBudgets.length > 0) {
      // Run immediately
      recalculateBudgets();
      
      // Also run after a delay to catch any timing issues
      const timeoutId = setTimeout(() => {
        recalculateBudgets();
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeBudgets.length, queryClient]); // Run when number of active budgets changes

  if (isLoading) {
    return (
      <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, sm: 3 } }}>
        <Box>
          <Skeleton variant="text" height={60} width={300} />
          <Skeleton variant="rectangular" height={200} sx={{ mt: 2 }} />
          <Grid container spacing={3} mt={2}>
            {[1, 2, 3, 4].map(i => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rectangular" height={150} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Budget Management
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your budgets across different time periods
          </Typography>
        </Box>
        <Box display="flex" gap={2} flexWrap="wrap">
          {activeBudgets.length > 0 && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<CalendarIcon />}
              onClick={async () => {
                const activeBudget = activeBudgets[0];
                const currentWeek = activeBudget.weeklyBudgets.find(w => {
                  const now = new Date();
                  const start = new Date(w.startDate);
                  const end = new Date(w.endDate);
                  return now >= start && now <= end;
                });
                if (currentWeek) {
                  await navigateToWeeklyBudget(activeBudget._id, currentWeek.weekNumber);
                }
              }}
              size="large"
            >
              Current Week
            </Button>
          )}
          <Button
            variant="outlined"
            color="primary"
            startIcon={<TrendingUpIcon />}
            onClick={async () => {
              // Quick create budget for next month with same amount as this month
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 1);
              
              try {
                const lastBudget = activeBudgets[0]?.totalBudget || 3000;
                const response = await axios.post('/api/main-budgets', {
                  name: format(nextMonth, 'MMMM yyyy') + ' Budget',
                  description: 'Monthly budget',
                  periodType: 'monthly',
                  totalBudget: lastBudget,
                  categories: [],
                  settings: {
                    autoCreateWeekly: true,
                    rolloverUnspent: false,
                    shareWithHousehold: false,
                    notifyOnWeekStart: true,
                    notifyOnOverspend: true,
                  }
                });
                toast.success('Budget created! Click any week to start planning.');
                queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
              } catch (error: any) {
                toast.error(error.response?.data?.error || 'Failed to create budget');
              }
            }}
            size="large"
          >
            Quick Start Next Month
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            size="large"
          >
            Create Budget
          </Button>
        </Box>
      </Box>

      {/* Available Income Card */}
      <Card sx={{ 
        mb: 3, 
        background: availableIncome.available < 0 
          ? 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)' 
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        borderRadius: 2 
      }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" color="white">
                Available to Budget
              </Typography>
              <Typography variant="h3" color="white" fontWeight="bold">
                {availableIncome.available < 0 ? '-' : ''}${Math.abs(availableIncome.available).toLocaleString()}
              </Typography>
              {availableIncome.available < 0 && (
                <Typography variant="body2" color="rgba(255,255,255,0.9)" fontWeight="bold">
                  Over budget!
                </Typography>
              )}
              <Box mt={1}>
                <Typography variant="body2" color="rgba(255,255,255,0.8)">
                  Total Income: ${availableIncome.total.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="rgba(255,255,255,0.8)">
                  Total Spent: ${(availableIncome.total - availableIncome.available - availableIncome.allocated).toFixed(0).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="rgba(255,255,255,0.8)">
                  Allocated to Budgets: ${availableIncome.allocated.toLocaleString()}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <BudgetIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.3)' }} />
              <IconButton
                sx={{ color: 'rgba(255,255,255,0.8)' }}
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['availableIncome'] });
                  toast.info('Refreshing available income...');
                }}
                title="Refresh available income"
              >
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={periodFilter}
            label="Period"
            onChange={(e) => setPeriodFilter(e.target.value as any)}
          >
            <MenuItem value="all">All Periods</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="quarterly">Quarterly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Active Budgets */}
      {activeBudgets.length > 0 && (
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight="bold">
              Active Budgets
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={async () => {
                // Force recalculate all active budgets before refreshing
                for (const budget of activeBudgets) {
                  const weeklySum = budget.weeklyBudgets.reduce((sum, week) => sum + (week.allocatedAmount || 0), 0);
                  if (weeklySum > 0) {
                    try {
                      await axios.post(`/api/main-budgets/${budget._id}/recalculate-total`);
                    } catch (error) {
                      console.error('Failed to recalculate:', budget._id);
                    }
                  }
                }
                // Then refresh the data
                queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
                toast.success('Budgets refreshed');
              }}
              size="small"
              variant="outlined"
            >
              Refresh
            </Button>
          </Box>
          {activeBudgets.map(budget => (
            <Paper key={budget._id} sx={{ p: { xs: 2, sm: 2.5, md: 3 }, mb: 2.5, borderRadius: 2, boxShadow: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2} flexWrap="wrap" gap={2}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h5" fontWeight="bold">
                          {budget.name}
                        </Typography>
                        <Chip 
                          label={budget.period.type} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                        {budget.householdId && (
                          <Chip 
                            label="Shared" 
                            size="small" 
                            icon={<GroupIcon />}
                            color="secondary"
                          />
                        )}
                      </Box>
                      {budget.description && (
                        <Typography variant="body2" color="textSecondary" mb={2}>
                          {budget.description}
                        </Typography>
                      )}
                      <Box display="flex" gap={3}>
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Total Budget
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" fontWeight="bold">
                              ${budget.totalBudget.toLocaleString()}
                            </Typography>
                            {(() => {
                              const weeklySum = budget.weeklyBudgets.reduce((sum, week) => sum + (week.allocatedAmount || 0), 0);
                              return weeklySum > 0; // Always show button if there are weekly allocations
                            })() && (
                              <Tooltip title={`Recalculate total from weekly budgets ($${budget.weeklyBudgets.reduce((sum, week) => sum + (week.allocatedAmount || 0), 0).toLocaleString()})`}>
                                <IconButton
                                  size="small"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await axios.post(`/api/main-budgets/${budget._id}/recalculate-total`);
                                      queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
                                      toast.success('Total budget updated');
                                    } catch (error) {
                                      toast.error('Failed to recalculate total');
                                    }
                                  }}
                                  color="primary"
                                >
                                  <RefreshIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Spent
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" color="primary">
                            ${budget.analytics.totalSpent.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Remaining
                          </Typography>
                          <Typography 
                            variant="h6" 
                            fontWeight="bold" 
                            color={budget.analytics.totalRemaining < 0 ? 'error' : 'success'}
                          >
                            ${budget.analytics.totalRemaining.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Days Left
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {budget.daysRemaining}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <Box display="flex" gap={1}>
                      <IconButton 
                        onClick={() => navigate(`/budgets/${budget._id}/analytics`)}
                        color="primary"
                        title="Analytics"
                      >
                        <AssessmentIcon />
                      </IconButton>
                      <IconButton title="Edit">
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        onClick={() => {
                          setBudgetToDelete(budget);
                          setDeleteDialogOpen(true);
                        }}
                        color="error"
                        title="Delete Budget"
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton 
                        onClick={async () => {
                          try {
                            const response = await axios.post(`/api/main-budgets/${budget._id}/cleanup-future-weeks`);
                            toast.success(response.data.message);
                            queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
                          } catch (error) {
                            toast.error('Failed to clean future weeks');
                          }
                        }}
                        color="secondary"
                        title="Clean Future Weeks"
                      >
                        <CleaningServicesIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
                  <Box mb={3}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="textSecondary">
                        Budget Progress
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {budget.progressPercentage}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={budget.progressPercentage} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: budget.progressPercentage > 90 ? 'error.main' : 
                                  budget.progressPercentage > 75 ? 'warning.main' : 'primary.main'
                        }
                      }}
                    />
                  </Box>

                  {/* View Toggle and Breakdown */}
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Breakdown
                      </Typography>
                      <ToggleButtonGroup
                          value={viewMode}
                          exclusive
                          onChange={(e, newMode) => newMode && setViewMode(newMode)}
                          size="small"
                        >
                          <ToggleButton value="weekly">
                            <CalendarIcon sx={{ mr: 0.5, fontSize: 18 }} />
                            Weekly
                          </ToggleButton>
                          <ToggleButton value="monthly">
                            <DateRangeIcon sx={{ mr: 0.5, fontSize: 18 }} />
                            Monthly
                          </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {viewMode === 'weekly' ? (
                      <Grid container spacing={2}>
                        {budget.weeklyBudgets.map(week => (
                            <Grid item xs={12} sm={6} md={3} key={week.weekNumber}>
                              <WeekCard 
                                week={week} 
                                mainBudgetId={budget._id}
                                onNavigate={(weekNum) => navigateToWeeklyBudget(budget._id, weekNum)}
                              />
                            </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 3,
                          }
                        }}
                        onClick={async () => {
                          // Navigate to current week
                          const now = new Date();
                          const currentWeek = budget.weeklyBudgets.find(w => {
                            const start = new Date(w.startDate);
                            const end = new Date(w.endDate);
                            return now >= start && now <= end;
                          });
                          
                          if (currentWeek) {
                            await navigateToWeeklyBudget(budget._id, currentWeek.weekNumber);
                          } else {
                            // Fallback to first week
                            const firstWeek = budget.weeklyBudgets[0];
                            if (firstWeek) {
                              await navigateToWeeklyBudget(budget._id, firstWeek.weekNumber);
                            }
                          }
                        }}
                      >
                        <CardContent>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                              <Typography variant="h5" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                                {format(new Date(budget.period.startDate), 'MMMM yyyy')}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Full Month View
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box display="flex" justifyContent="space-around" flexWrap="wrap" gap={2}>
                                <Box textAlign="center" flex="1 1 auto" minWidth="80px">
                                  <Typography variant="caption" color="textSecondary">Budget</Typography>
                                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>${budget.totalBudget.toLocaleString()}</Typography>
                                </Box>
                                <Box textAlign="center" flex="1 1 auto" minWidth="80px">
                                  <Typography variant="caption" color="textSecondary">Spent</Typography>
                                  <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>${budget.analytics.totalSpent.toLocaleString()}</Typography>
                                </Box>
                                <Box textAlign="center" flex="1 1 auto" minWidth="80px">
                                  <Typography variant="caption" color="textSecondary">Remaining</Typography>
                                  <Typography variant="h6" color={budget.analytics.totalRemaining < 0 ? 'error' : 'success'} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                    ${budget.analytics.totalRemaining.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={3} textAlign={{ xs: 'center', md: 'right' }}>
                              <Button 
                                variant="contained" 
                                endIcon={<ArrowForwardIcon />}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  // Navigate to current week in monthly view
                                  const now = new Date();
                                  const currentWeek = budget.weeklyBudgets.find(w => {
                                    const start = new Date(w.startDate);
                                    const end = new Date(w.endDate);
                                    return now >= start && now <= end;
                                  });
                                  
                                  if (currentWeek) {
                                    await navigateToWeeklyBudget(budget._id, currentWeek.weekNumber);
                                  } else {
                                    // Fallback to first week
                                    const firstWeek = budget.weeklyBudgets[0];
                                    if (firstWeek) {
                                      await navigateToWeeklyBudget(budget._id, firstWeek.weekNumber);
                                    }
                                  }
                                }}
                              >
                                Manage Budget
                              </Button>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Box>
      )}

      {/* All Budgets List */}
      {budgets.length === 0 && weeklyBudgets.length === 0 ? (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'primary.50' }}>
              <BudgetIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" fontWeight="bold" mb={2}>
                Welcome to Budget Management
              </Typography>
              <Typography variant="body1" color="textSecondary" mb={4} sx={{ maxWidth: 600, mx: 'auto' }}>
                Create a main budget for your desired period (monthly, quarterly, or yearly) and we'll automatically 
                organize it into weekly budgets for detailed tracking.
              </Typography>
              <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setCreateDialogOpen(true);
                  }}
                  sx={{ px: 4 }}
                >
                  Create Monthly Budget
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<CalendarIcon />}
                  onClick={async () => {
                    // Use the same quick monthly budget creation as quick payment
                    try {
                      const response = await axios.post('/api/weekly-budget/quick-monthly', {
                        monthlyIncome: 0
                      });
                      
                      if (response.data.weeklyBudget?._id) {
                        toast.success('Presupuesto rápido creado exitosamente!');
                        navigate(`/budgets/week/${response.data.weeklyBudget._id}`);
                      }
                      
                      queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
                      queryClient.invalidateQueries({ queryKey: ['weeklyBudgets'] });
                    } catch (error) {
                      toast.error('Failed to create quick budget');
                    }
                  }}
                  sx={{ px: 4 }}
                >
                  Quick Start This Month
                </Button>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📅 Step 1: Choose Period
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Select monthly for detailed tracking, quarterly for medium-term planning, 
                  or yearly for long-term budgeting.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  💰 Step 2: Set Budget
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Enter your total budget for the period. It will be automatically divided 
                  into weekly amounts for easier management.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 Step 3: Track Weekly
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Click on any week to add expenses, track payments, and monitor your 
                  spending in detail.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Box>
          {/* Future Budgets */}
          {futureBudgets.length > 0 && (
            <Box mb={4}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Upcoming Budgets
              </Typography>
              <Grid container spacing={2}>
                {futureBudgets.map(budget => (
                  <Grid item xs={12} md={6} lg={4} key={budget._id}>
                    <Card sx={{ 
                      borderRadius: 2, 
                      boxShadow: 1,
                      borderStyle: 'dashed',
                      borderColor: 'primary.main',
                      borderWidth: 2,
                      '&:hover': { boxShadow: 3 },
                      transition: 'box-shadow 0.3s'
                    }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {budget.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {format(new Date(budget.period.startDate), 'MMM d')} - 
                              {format(new Date(budget.period.endDate), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip 
                              label="upcoming" 
                              size="small"
                              color="info"
                              icon={<ScheduleIcon />}
                            />
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setBudgetToDelete(budget);
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                              title="Delete Budget"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        <Box mb={2}>
                          <Typography variant="caption" color="textSecondary">Budget</Typography>
                          <Typography variant="h5" fontWeight="bold">
                            ${budget.totalBudget.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" mt={1}>
                            Starts in {Math.abs(budget.daysRemaining)} days
                          </Typography>
                        </Box>

                        <Button 
                          fullWidth 
                          variant="contained"
                          endIcon={<ArrowForwardIcon />}
                          onClick={async () => {
                            // Navigate to the first week of this budget
                            const firstWeek = budget.weeklyBudgets[0];
                            if (firstWeek) {
                              await navigateToWeeklyBudget(budget._id, firstWeek.weekNumber);
                            } else {
                              toast.error('No weeks found in this budget');
                            }
                          }}
                          sx={{ borderRadius: 2 }}
                        >
                          Setup Budget
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Past Budgets */}
          {pastBudgets.length > 0 && (
            <Box mb={4}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Past Budgets
              </Typography>
              <Grid container spacing={2}>
                {pastBudgets.map(budget => (
                  <Grid item xs={12} md={6} lg={4} key={budget._id}>
                    <Card sx={{ 
                      borderRadius: 2, 
                      boxShadow: 1,
                      backgroundColor: 'grey.50',
                      '&:hover': { boxShadow: 3 },
                      transition: 'box-shadow 0.3s'
                    }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {budget.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {format(new Date(budget.period.startDate), 'MMM d')} - 
                              {format(new Date(budget.period.endDate), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip 
                              label="completed" 
                              size="small"
                              color="default"
                              icon={<CheckIcon />}
                            />
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setBudgetToDelete(budget);
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                              title="Delete Budget"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between" mb={2}>
                          <Box>
                            <Typography variant="caption" color="textSecondary">Budget</Typography>
                            <Typography variant="body1" fontWeight="medium">
                              ${budget.totalBudget.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="textSecondary">Spent</Typography>
                            <Typography variant="body1" fontWeight="medium" color="primary">
                              ${budget.analytics.totalSpent.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="textSecondary">Result</Typography>
                            <Typography 
                              variant="body1" 
                              fontWeight="medium" 
                              color={budget.analytics.totalRemaining >= 0 ? 'success.main' : 'error.main'}
                            >
                              {budget.analytics.totalRemaining >= 0 ? '+' : ''} 
                              ${budget.analytics.totalRemaining.toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>

                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(budget.progressPercentage, 100)}
                          sx={{ 
                            height: 6, 
                            borderRadius: 3,
                            mb: 2,
                            backgroundColor: 'action.hover',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: budget.progressPercentage > 100 ? 'error.main' : 'success.main',
                            }
                          }}
                        />

                        <Button 
                          fullWidth 
                          variant="outlined"
                          endIcon={<ArrowForwardIcon />}
                          onClick={async () => {
                            // For past budgets, navigate to the last week
                            const lastWeek = budget.weeklyBudgets[budget.weeklyBudgets.length - 1];
                            if (lastWeek) {
                              await navigateToWeeklyBudget(budget._id, lastWeek.weekNumber);
                            } else {
                              toast.error('No weeks found in this budget');
                            }
                          }}
                          sx={{ borderRadius: 2 }}
                        >
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* All Other Budgets */}
          {otherBudgets.length > 0 && (
            <Box>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                All Budgets
              </Typography>
              <Grid container spacing={2}>
                {otherBudgets.map(budget => (
                  <Grid item xs={12} md={6} lg={4} key={budget._id}>
                    <Card sx={{ 
                      borderRadius: 2, 
                      boxShadow: 1,
                      '&:hover': { boxShadow: 3 },
                      transition: 'box-shadow 0.3s'
                    }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {budget.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {budget.period.type} • {format(new Date(budget.period.startDate), 'MMM yyyy')}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip 
                              label={budget.status} 
                              size="small"
                              color={
                                budget.status === 'active' ? 'success' : 
                                budget.status === 'completed' ? 'default' :
                                budget.status === 'draft' ? 'warning' : 'error'
                              }
                              variant="outlined"
                            />
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setBudgetToDelete(budget);
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                              title="Delete Budget"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between" mb={2}>
                          <Box>
                            <Typography variant="caption" color="textSecondary">Budget</Typography>
                            <Typography variant="h6">
                              ${budget.totalBudget.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="textSecondary">Spent</Typography>
                            <Typography variant="h6" color="primary">
                              ${budget.analytics.totalSpent.toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>

                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(budget.progressPercentage, 100)} 
                          sx={{ mb: 2, height: 6, borderRadius: 3 }}
                        />

                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={async () => {
                            // Navigate to the first or current week
                            const now = new Date();
                            let targetWeek = budget.weeklyBudgets.find(w => {
                              const start = new Date(w.startDate);
                              const end = new Date(w.endDate);
                              return now >= start && now <= end;
                            });
                            
                            // If no current week, use first week
                            if (!targetWeek) {
                              targetWeek = budget.weeklyBudgets[0];
                            }
                            
                            if (targetWeek) {
                              await navigateToWeeklyBudget(budget._id, targetWeek.weekNumber);
                            } else {
                              toast.error('No weeks found in this budget');
                            }
                          }}
                          endIcon={<ArrowForwardIcon />}
                          sx={{ borderRadius: 2 }}
                        >
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* Weekly Budgets Section - Show weekly budgets created via quick payment */}
      {weeklyBudgets.length > 0 && budgets.length === 0 && (
        <Box>
          <Typography variant="h5" fontWeight="bold" mb={3}>
            Presupuestos Semanales
          </Typography>
          <Grid container spacing={3}>
            {weeklyBudgets.map((weeklyBudget: any) => (
              <Grid item xs={12} md={6} lg={4} key={weeklyBudget._id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 4 },
                    transition: 'all 0.2s'
                  }}
                  onClick={() => navigate(`/budgets/week/${weeklyBudget._id}`)}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box flex={1}>
                        <Typography variant="h6" fontWeight="bold">
                          Semana {format(new Date(weeklyBudget.weekStartDate), 'MMM d')} - {format(new Date(weeklyBudget.weekEndDate), 'MMM d')}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Presupuesto Semanal Rápido
                        </Typography>
                      </Box>
                      <Chip 
                        label="activo" 
                        size="small"
                        color="success"
                        icon={<PlayArrowIcon />}
                      />
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" mb={2}>
                      <Box>
                        <Typography variant="caption" color="textSecondary">Presupuesto</Typography>
                        <Typography variant="h6">
                          S/ {weeklyBudget.totalBudget?.toFixed(2) || '0.00'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="textSecondary">Gastado</Typography>
                        <Typography variant="h6" color="primary">
                          S/ {(weeklyBudget.totalBudget - weeklyBudget.remainingBudget)?.toFixed(2) || '0.00'}
                        </Typography>
                      </Box>
                    </Box>

                    <LinearProgress 
                      variant="determinate" 
                      value={weeklyBudget.totalBudget > 0 ? ((weeklyBudget.totalBudget - weeklyBudget.remainingBudget) / weeklyBudget.totalBudget * 100) : 0} 
                      sx={{ mb: 2, height: 6, borderRadius: 3 }}
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      endIcon={<ArrowForwardIcon />}
                      sx={{ borderRadius: 2 }}
                    >
                      Ver Detalles
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Create Budget Dialog */}
      <CreateMainBudgetDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
          setCreateDialogOpen(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setBudgetToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Budget</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. All data associated with this budget will be permanently deleted.
          </Alert>
          {budgetToDelete && (
            <Box>
              <Typography variant="body1" mb={2}>
                Are you sure you want to delete the following budget?
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="h6" fontWeight="bold">
                  {budgetToDelete.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {format(new Date(budgetToDelete.period.startDate), 'MMM d, yyyy')} - 
                  {format(new Date(budgetToDelete.period.endDate), 'MMM d, yyyy')}
                </Typography>
                <Box mt={1}>
                  <Typography variant="body2">
                    <strong>Total Budget:</strong> ${budgetToDelete.totalBudget.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Amount Spent:</strong> ${budgetToDelete.analytics.totalSpent.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Weekly Budgets:</strong> {budgetToDelete.weeklyBudgets.length} weeks
                  </Typography>
                </Box>
              </Paper>
              <Alert severity="info" sx={{ mt: 2 }}>
                This will also delete:
                <ul style={{ margin: '8px 0' }}>
                  <li>All weekly budgets within this period</li>
                  <li>All categories and payment schedules</li>
                  <li>All tracking data and analytics</li>
                </ul>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setBudgetToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (budgetToDelete) {
                deleteBudgetMutation.mutate(budgetToDelete._id);
              }
            }}
            color="error"
            variant="contained"
            disabled={deleteBudgetMutation.isPending}
          >
            {deleteBudgetMutation.isPending ? 'Deleting...' : 'Delete Budget'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MainBudgets;
