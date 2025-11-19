import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Button,
  Collapse,
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  TrendingUp as ProgressIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'react-toastify';
import HouseholdBudgetDetail from './HouseholdBudgetDetail';

interface HouseholdBudgetsProps {
  householdId: string;
}

interface SharedBudget {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
  };
  weekStartDate: string;
  weekEndDate: string;
  totalBudget: number;
  householdId?: string;
  categories: Array<{
    categoryId: {
      _id: string;
      name: string;
      color: string;
      icon?: string;
    };
    allocation: number;
    payments: Array<{
      _id?: string;
      name: string;
      amount: number;
      status: 'pending' | 'paying' | 'paid' | 'overdue';
      scheduledDate: string;
      paidDate?: string;
      paidBy?: {
        _id: string;
        name: string;
        email: string;
      };
      paymentScheduleId?: string;
    }>;
  }>;
  allocations?: Array<{
    categoryId: {
      _id: string;
      name: string;
      color: string;
      icon?: string;
    };
    allocation: number;
    spent: number;
  }>;
}

const HouseholdBudgets: React.FC<HouseholdBudgetsProps> = ({ householdId }) => {
  const queryClient = useQueryClient();
  const [expandedBudgets, setExpandedBudgets] = useState<Set<string>>(new Set());
  
  // Fetch shared budgets for the household
  const { data: sharedBudgets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['householdBudgets', householdId],
    queryFn: async () => {
      console.log('Fetching household budgets, householdId:', householdId);
      // Force refresh to get properly populated data
      const response = await axios.get(`/api/weekly-budget/household/${householdId}?refresh=true`);
      console.log('Fetched shared budgets:', response.data);
      return response.data as SharedBudget[];
    },
  });
  
  if (error) {
    console.error('Error fetching household budgets:', error);
  }
  
  // Fetch household members
  const { data: household } = useQuery({
    queryKey: ['household', householdId],
    queryFn: async () => {
      const response = await axios.get(`/api/households/${householdId}`);
      return response.data;
    },
  });
  
  // Create a map of user IDs to names from household members
  const userNameMap = new Map<string, string>();
  if (household) {
    if (household.createdBy) {
      userNameMap.set(household.createdBy._id, household.createdBy.name || household.createdBy.username);
    }
    household.members?.forEach((member: any) => {
      if (member.user) {
        userNameMap.set(member.user._id, member.user.name || member.user.username);
      }
    });
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error">
        Error loading household budgets. Please try again later.
        {(error as any)?.response?.data?.details && (
          <div>Details: {(error as any).response.data.details}</div>
        )}
      </Alert>
    );
  }

  if (sharedBudgets.length === 0) {
    return (
      <Alert severity="info">
        No shared budgets yet. Household members can share their weekly budgets from the budget page.
      </Alert>
    );
  }

  // Group budgets by week
  const currentWeekStart = startOfWeek(new Date());
  const currentBudgets = sharedBudgets.filter(budget => 
    new Date(budget.weekStartDate).getTime() === currentWeekStart.getTime()
  );
  const pastBudgets = sharedBudgets.filter(budget => 
    new Date(budget.weekStartDate).getTime() < currentWeekStart.getTime()
  );

  const calculateBudgetStats = (budget: SharedBudget, userNameMap: Map<string, string>) => {
    let totalAllocated = 0;
    let totalSpent = 0;
    let totalPaid = 0;
    const paidByUsers = new Map<string, { name: string; amount: number }>();

    console.log('Budget data:', {
      budgetId: budget._id,
      hasCategories: !!budget.categories,
      categoriesLength: budget.categories?.length,
      hasAllocations: !!budget.allocations,
      allocationsLength: budget.allocations?.length,
      firstCategory: budget.categories?.[0],
    });

    if (budget.categories && budget.categories.length > 0) {
      // New structure with categories
      budget.categories.forEach(cat => {
        totalAllocated += cat.allocation;
        cat.payments.forEach(payment => {
          if (payment.status === 'paid') {
            totalSpent += payment.amount;
            totalPaid += payment.amount;
            
            // Track who paid
            if (payment.paidBy) {
              console.log('Payment with paidBy:', { 
                paymentName: payment.name, 
                paidBy: payment.paidBy,
                paidByType: typeof payment.paidBy,
                paidByKeys: payment.paidBy ? Object.keys(payment.paidBy) : 'null'
              });
              
              // Handle both string ID and object formats
              let userId, userName;
              if (typeof payment.paidBy === 'string') {
                userId = payment.paidBy;
                // Try to get name from userNameMap
                userName = userNameMap.get(userId) || 'Unknown User';
                console.log('PaidBy is string ID:', userId, 'Resolved name:', userName);
              } else if (payment.paidBy && typeof payment.paidBy === 'object') {
                userId = payment.paidBy._id;
                userName = payment.paidBy.name || userNameMap.get(userId) || 'Unknown User';
                console.log('PaidBy is object:', { userId, userName, fullObject: payment.paidBy });
              } else {
                console.log('PaidBy is neither string nor proper object:', payment.paidBy);
                userId = 'unknown';
                userName = 'Unknown User';
              }
              
              const existing = paidByUsers.get(userId);
              if (existing) {
                existing.amount += payment.amount;
              } else {
                paidByUsers.set(userId, {
                  name: userName,
                  amount: payment.amount
                });
              }
            }
          }
        });
      });
    } else if (budget.allocations) {
      // Old structure with allocations
      budget.allocations.forEach(alloc => {
        totalAllocated += alloc.allocation;
        totalSpent += alloc.spent;
      });
    }

    const percentageUsed = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    const remaining = totalAllocated - totalSpent;

    return {
      totalAllocated,
      totalSpent,
      totalPaid,
      percentageUsed,
      remaining,
      paidByUsers: Array.from(paidByUsers.values()),
    };
  };

  const toggleBudget = (budgetId: string) => {
    const newExpanded = new Set(expandedBudgets);
    if (newExpanded.has(budgetId)) {
      newExpanded.delete(budgetId);
    } else {
      newExpanded.add(budgetId);
    }
    setExpandedBudgets(newExpanded);
  };

  const BudgetCard: React.FC<{ budget: SharedBudget }> = ({ budget }) => {
    const stats = calculateBudgetStats(budget, userNameMap);
    
    // Force re-render when budget data changes by creating a dependency on the actual payment statuses
    const paymentStatuses = budget.categories?.flatMap(cat => 
      cat.payments.map(p => `${p.paymentScheduleId || p._id}-${p.status}`)
    ).join(',') || '';
    
    useEffect(() => {
      console.log(`BudgetCard re-rendered for budget ${budget._id}, stats:`, stats);
      console.log('Payment statuses:', paymentStatuses);
    }, [budget._id, stats.totalSpent, stats.totalPaid, paymentStatuses]);
    const isCurrentWeek = new Date(budget.weekStartDate).getTime() === currentWeekStart.getTime();
    const isExpanded = expandedBudgets.has(budget._id);
    
    // Get all household members for the paidBy selector
    const householdMembers = household ? [
      household.createdBy,
      ...household.members.map((m: any) => m.user)
    ] : [];

    return (
      <Box mb={2}>
        <Card sx={{ border: isCurrentWeek ? '2px solid' : '1px solid', borderColor: isCurrentWeek ? 'primary.main' : 'divider' }}>
          <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {budget.userId?.name?.charAt(0).toUpperCase() || '?'}
              </Avatar>
              <Box>
                <Typography variant="h6">{budget.userId?.name || 'Unknown User'}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {format(new Date(budget.weekStartDate), 'MMM d')} - {format(new Date(budget.weekEndDate), 'MMM d, yyyy')}
                </Typography>
              </Box>
            </Box>
            {isCurrentWeek && (
              <Chip label="Current Week" color="primary" size="small" />
            )}
          </Box>

          <Grid container spacing={2} mb={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="textSecondary">Total Budget</Typography>
              <Typography variant="h6">${budget.totalBudget.toFixed(2)}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="textSecondary">Allocated</Typography>
              <Typography variant="h6">${stats.totalAllocated.toFixed(2)}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="textSecondary">Spent</Typography>
              <Typography variant="h6" color="success.main">
                ${stats.totalSpent.toFixed(2)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="textSecondary">Remaining</Typography>
              <Typography variant="h6" color={stats.remaining < 0 ? 'error.main' : 'inherit'}>
                ${stats.remaining.toFixed(2)}
              </Typography>
            </Grid>
          </Grid>

          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">Budget Progress</Typography>
              <Typography variant="caption" color="textSecondary">
                {stats.percentageUsed.toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(stats.percentageUsed, 100)}
              sx={{
                height: 8,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 1,
                  backgroundColor: stats.percentageUsed > 100 ? 'error.main' : 'primary.main',
                },
              }}
            />
          </Box>

          {/* Who Paid */}
          {stats.paidByUsers && stats.paidByUsers.length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Paid By
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {stats.paidByUsers.map((user, index) => (
                  <Chip
                    key={index}
                    icon={<PersonIcon />}
                    label={`${user.name}: $${user.amount.toFixed(2)}`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Top Categories */}
          {budget.categories && budget.categories.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Top Categories
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {budget.categories
                  .filter(cat => cat.categoryId && cat.categoryId._id)
                  .slice(0, 3)
                  .sort((a, b) => b.allocation - a.allocation)
                  .map((cat) => (
                    <Chip
                      key={cat.categoryId._id}
                      label={`${cat.categoryId.name || 'Unknown'}: $${cat.allocation.toFixed(0)}`}
                      size="small"
                      sx={{
                        backgroundColor: (cat.categoryId.color || '#666') + '20',
                        color: cat.categoryId.color || '#666',
                        borderColor: cat.categoryId.color || '#666',
                        border: '1px solid',
                      }}
                    />
                  ))}
              </Box>
            </Box>
          )}
          
          {/* Toggle Button */}
          <Box display="flex" justifyContent="center" mt={2} gap={1}>
            <Button
              onClick={() => toggleBudget(budget._id)}
              endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              size="small"
            >
              {isExpanded ? 'Hide Details' : 'View Details'}
            </Button>
            <Button
              onClick={async () => {
                try {
                  console.log('Syncing budget:', budget._id);
                  const syncResponse = await axios.post(`/api/weekly-budget/${budget._id}/sync-categories`);
                  console.log('Sync response:', syncResponse.data);
                  
                  // Force a hard refresh of the data
                  queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
                  queryClient.invalidateQueries({ queryKey: ['householdBudgets', householdId] });
                  
                  // Wait a bit for backend to complete
                  setTimeout(() => {
                    refetch();
                  }, 500);
                } catch (error) {
                  console.error('Failed to sync:', error);
                  toast.error('Failed to refresh data');
                }
              }}
              size="small"
              variant="outlined"
            >
              Refresh Data
            </Button>
            {/* Fix paidBy button */}
            <Button
              onClick={async () => {
                try {
                  console.log('Fixing paidBy data for budget:', budget._id);
                  const response = await axios.post(`/api/weekly-budget/${budget._id}/fix-paidby`);
                  console.log('Fix paidBy response:', response.data);
                  toast.success(`Fixed ${response.data.message}`);
                  
                  // Refresh the data
                  queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
                  queryClient.invalidateQueries({ queryKey: ['householdBudgets', householdId] });
                  setTimeout(() => refetch(), 500);
                } catch (error) {
                  console.error('Failed to fix paidBy:', error);
                  toast.error('Failed to fix payment data');
                }
              }}
              size="small"
              variant="outlined"
              color="warning"
            >
              Fix Names
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* Expanded Details */}
      <Collapse in={isExpanded}>
        <Box mt={-2}>
          <HouseholdBudgetDetail 
            budget={budget} 
            householdMembers={householdMembers}
            onUpdate={refetch}
          />
        </Box>
      </Collapse>
    </Box>
    );
  };

  return (
    <Box>
      {currentBudgets.length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            <BudgetIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Current Week Budgets
          </Typography>
          {currentBudgets.map(budget => (
            <BudgetCard key={budget._id} budget={budget} />
          ))}
        </Box>
      )}

      {pastBudgets.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Past Budgets
          </Typography>
          {pastBudgets.slice(0, 3).map(budget => (
            <BudgetCard key={budget._id} budget={budget} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default HouseholdBudgets;
