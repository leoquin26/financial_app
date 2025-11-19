import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Tooltip,
  Paper
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Add as AddIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek, startOfMonth, endOfMonth, eachWeekOfInterval, isWithinInterval } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

interface WeeklyBudgetSummary {
  _id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalBudget: number;
  allocations: Array<{
    amount: number;
    spent: number;
    status?: string;
  }>;
  remainingBudget: number;
}

interface WeeklyBudgetCalendarProps {
  onWeekSelect?: (weekStart: Date) => void;
}

const WeeklyBudgetCalendar: React.FC<WeeklyBudgetCalendarProps> = ({ onWeekSelect }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogWeek, setCreateDialogWeek] = useState<Date | null>(null);
  const [newBudgetAmount, setNewBudgetAmount] = useState('');

  // Fetch all budgets for the current month view
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['weeklyBudgets', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const response = await axios.get('/api/weekly-budget/range', {
        params: {
          startDate: monthStart.toISOString(),
          endDate: monthEnd.toISOString()
        }
      });
      return response.data;
    }
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (data: { weekStartDate: string; totalBudget: number }) => {
      const response = await axios.post('/api/weekly-budget', {
        ...data,
        allocations: []
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudgets'] });
      toast.success('Weekly budget created');
      setCreateDialogOpen(false);
      setNewBudgetAmount('');
      
      // Navigate to the weekly budget page
      navigate('/weekly-budget');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create budget');
    }
  });

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subWeeks(prev, 4));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addWeeks(prev, 4));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedWeek(startOfWeek(new Date()));
  };

  const handleWeekClick = (weekStart: Date) => {
    setSelectedWeek(weekStart);
    if (onWeekSelect) {
      onWeekSelect(weekStart);
    }
    
    // Check if budget exists for this week
    const budget = budgets.find((b: WeeklyBudgetSummary) => 
      isSameWeek(new Date(b.weekStartDate), weekStart)
    );
    
    if (budget) {
      navigate('/weekly-budget');
    } else {
      setCreateDialogWeek(weekStart);
      setCreateDialogOpen(true);
    }
  };

  const handleCreateBudget = () => {
    if (createDialogWeek && newBudgetAmount) {
      createBudgetMutation.mutate({
        weekStartDate: createDialogWeek.toISOString(),
        totalBudget: parseFloat(newBudgetAmount)
      });
    }
  };

  // Get all weeks in the current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const weeks = eachWeekOfInterval({
    start: monthStart,
    end: monthEnd
  });

  const getBudgetForWeek = (weekStart: Date) => {
    return budgets.find((budget: WeeklyBudgetSummary) => 
      isSameWeek(new Date(budget.weekStartDate), weekStart)
    );
  };

  const getWeekStatus = (budget: WeeklyBudgetSummary) => {
    const totalSpent = budget.allocations.reduce((sum: number, alloc: any) => sum + alloc.spent, 0);
    const totalPaid = budget.allocations.filter((a: any) => a.status === 'paid').length;
    const totalAllocations = budget.allocations.length;
    
    if (totalAllocations === 0) return 'empty';
    if (totalPaid === totalAllocations) return 'completed';
    if (totalSpent > budget.totalBudget) return 'overbudget';
    return 'active';
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Calendar Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={handlePreviousMonth}>
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="h5">
                {format(currentMonth, 'MMMM yyyy')}
              </Typography>
              <IconButton onClick={handleNextMonth}>
                <ChevronRightIcon />
              </IconButton>
            </Box>
            <Button
              startIcon={<TodayIcon />}
              onClick={handleToday}
              variant="outlined"
            >
              Today
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Weeks Grid */}
      <Grid container spacing={2}>
        {weeks.map((weekStart) => {
          const weekEnd = endOfWeek(weekStart);
          const budget = getBudgetForWeek(weekStart);
          const isCurrentWeek = isSameWeek(weekStart, new Date());
          const isSelected = selectedWeek && isSameWeek(weekStart, selectedWeek);
          const status = budget ? getWeekStatus(budget) : 'empty';
          
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={weekStart.toISOString()}>
              <Paper
                elevation={isSelected ? 4 : 1}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: isCurrentWeek ? 2 : 1,
                  borderColor: isCurrentWeek ? 'primary.main' : 'divider',
                  backgroundColor: isSelected ? 'action.selected' : 'background.paper',
                  transition: 'all 0.3s',
                  '&:hover': {
                    elevation: 3,
                    backgroundColor: 'action.hover'
                  }
                }}
                onClick={() => handleWeekClick(weekStart)}
              >
                {/* Week Header */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Week {format(weekStart, 'w')}
                  </Typography>
                  {isCurrentWeek && (
                    <Chip label="Current" size="small" color="primary" />
                  )}
                </Box>

                {/* Week Dates */}
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
                </Typography>

                {/* Budget Info */}
                {budget ? (
                  <Box mt={2}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="h6">
                        ${budget.totalBudget.toFixed(2)}
                      </Typography>
                      {status === 'completed' && (
                        <Tooltip title="All payments completed">
                          <CheckIcon color="success" fontSize="small" />
                        </Tooltip>
                      )}
                      {status === 'overbudget' && (
                        <Tooltip title="Over budget">
                          <WarningIcon color="error" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                    
                    {/* Quick Stats */}
                    <Box mt={1}>
                      <Typography variant="caption" color="textSecondary" display="block">
                        {budget.allocations.length} payments
                      </Typography>
                      <Typography variant="caption" color={budget.remainingBudget >= 0 ? 'success.main' : 'error.main'}>
                        ${Math.abs(budget.remainingBudget).toFixed(2)} {budget.remainingBudget >= 0 ? 'remaining' : 'over'}
                      </Typography>
                    </Box>

                    {/* Progress Bar */}
                    <Box mt={1}>
                      <Box
                        sx={{
                          height: 4,
                          backgroundColor: 'grey.200',
                          borderRadius: 2,
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            backgroundColor: status === 'overbudget' ? 'error.main' : 'success.main',
                            width: `${Math.min(
                              (budget.allocations.filter((a: any) => a.status === 'paid').length / 
                              Math.max(budget.allocations.length, 1)) * 100,
                              100
                            )}%`,
                            transition: 'width 0.3s'
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Box 
                    mt={2} 
                    display="flex" 
                    flexDirection="column" 
                    alignItems="center"
                    sx={{ opacity: 0.6 }}
                  >
                    <AddIcon color="action" />
                    <Typography variant="caption" color="textSecondary">
                      No budget
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Create Budget Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create Weekly Budget</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Create a budget for the week of {createDialogWeek && format(createDialogWeek, 'MMM d, yyyy')}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Total Budget Amount"
            type="number"
            fullWidth
            variant="outlined"
            value={newBudgetAmount}
            onChange={(e) => setNewBudgetAmount(e.target.value)}
            InputProps={{
              startAdornment: <MoneyIcon color="action" sx={{ mr: 1 }} />
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateBudget}
            variant="contained"
            disabled={!newBudgetAmount || createBudgetMutation.isPending}
          >
            Create Budget
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WeeklyBudgetCalendar;
