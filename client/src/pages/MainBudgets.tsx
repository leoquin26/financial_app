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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, differenceInDays } from 'date-fns';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
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
  const queryClient = useQueryClient();
  const [periodFilter, setPeriodFilter] = useState<'all' | 'monthly' | 'quarterly' | 'yearly'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

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
  });

  // Navigate to weekly budget
  const navigateToWeeklyBudget = async (mainBudgetId: string, weekNumber: number) => {
    try {
      // Create or get the weekly budget
      const response = await axios.post(`/api/main-budgets/${mainBudgetId}/weekly/${weekNumber}`);
      const weeklyBudget = response.data;
      
      // Navigate to the weekly budget page
      navigate(`/budgets/week/${weeklyBudget._id}`);
    } catch (error) {
      console.error('Error navigating to weekly budget:', error);
      toast.error('Failed to load weekly budget');
    }
  };

  // Get current/active budgets
  const activeBudgets = budgets.filter(b => b.isCurrentPeriod && b.status === 'active');

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box>
          <Skeleton variant="text" height={60} width={300} />
          <Skeleton variant="rectangular" height={200} sx={{ mt: 2 }} />
          <Grid container spacing={3} mt={2}>
            {[1, 2, 3, 4].map(i => (
              <Grid item xs={12} md={3} key={i}>
                <Skeleton variant="rectangular" height={150} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Budget Management
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your budgets across different time periods
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
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
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            size="large"
          >
            Create Budget
          </Button>
        </Box>
      </Box>

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
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Active Budgets
          </Typography>
          {activeBudgets.map(budget => (
            <Paper key={budget._id} sx={{ p: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
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
                          <Typography variant="h6" fontWeight="bold">
                            ${budget.totalBudget.toLocaleString()}
                          </Typography>
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
                        onClick={() => navigate(`/budgets/${budget._id}`)}
                      >
                        <CardContent>
                          <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} md={3}>
                              <Typography variant="h5" fontWeight="bold" color="primary">
                                {format(new Date(budget.period.startDate), 'MMMM yyyy')}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Full Month View
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box display="flex" justifyContent="space-around">
                                <Box textAlign="center">
                                  <Typography variant="caption" color="textSecondary">Budget</Typography>
                                  <Typography variant="h6">${budget.totalBudget.toLocaleString()}</Typography>
                                </Box>
                                <Box textAlign="center">
                                  <Typography variant="caption" color="textSecondary">Spent</Typography>
                                  <Typography variant="h6" color="primary">${budget.analytics.totalSpent.toLocaleString()}</Typography>
                                </Box>
                                <Box textAlign="center">
                                  <Typography variant="caption" color="textSecondary">Remaining</Typography>
                                  <Typography variant="h6" color={budget.analytics.totalRemaining < 0 ? 'error' : 'success'}>
                                    ${budget.analytics.totalRemaining.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={3} textAlign="right">
                              <Button 
                                variant="contained" 
                                endIcon={<ArrowForwardIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/budgets/${budget._id}`);
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
      {budgets.length === 0 ? (
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
                    // Quick create current month budget
                    try {
                      const now = new Date();
                      const response = await axios.post('/api/main-budgets', {
                        name: `${format(now, 'MMMM yyyy')} Budget`,
                        periodType: 'monthly',
                        totalBudget: 0,
                        categories: [],
                        settings: {
                          autoCreateWeekly: true
                        }
                      });
                      queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
                      toast.success('Budget created! Add your budget amount to get started.');
                    } catch (error) {
                      toast.error('Failed to create budget');
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
          <Typography variant="h6" fontWeight="bold" mb={2}>
            All Budgets
          </Typography>
          <Grid container spacing={3}>
            {budgets.filter(b => !activeBudgets.includes(b)).map(budget => (
              <Grid item xs={12} md={6} lg={4} key={budget._id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          {budget.name}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip 
                            label={budget.period.type} 
                            size="small" 
                            variant="outlined"
                          />
                          <Chip 
                            label={budget.status} 
                            size="small" 
                            color={
                              budget.status === 'active' ? 'primary' : 
                              budget.status === 'completed' ? 'success' : 'default'
                            }
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Box mb={2}>
                      <Typography variant="caption" color="textSecondary">
                        {format(new Date(budget.period.startDate), 'MMM d, yyyy')} - 
                        {format(new Date(budget.period.endDate), 'MMM d, yyyy')}
                      </Typography>
                    </Box>

                    <Box display="flex" justifyContent="space-between" mb={2}>
                      <Box>
                        <Typography variant="caption" color="textSecondary">
                          Budget
                        </Typography>
                        <Typography variant="h6">
                          ${budget.totalBudget.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="caption" color="textSecondary">
                          Spent
                        </Typography>
                        <Typography variant="h6" color="primary">
                          ${budget.analytics.totalSpent.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>

                    <LinearProgress 
                      variant="determinate" 
                      value={budget.progressPercentage} 
                      sx={{ mb: 2 }}
                    />

                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => navigate(`/budgets/${budget._id}`)}
                      endIcon={<ArrowForwardIcon />}
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

      {/* Create Budget Dialog */}
      <CreateMainBudgetDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['mainBudgets'] });
          setCreateDialogOpen(false);
        }}
      />
    </Container>
  );
};

export default MainBudgets;
