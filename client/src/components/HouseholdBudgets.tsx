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
      const response = await axios.get(`/api/weekly-budget/household/${householdId}`);
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
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
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

    const actualBudgetTotal = budget.totalBudget || totalAllocated || 0;
    const percentageUsed = actualBudgetTotal > 0 ? (totalSpent / actualBudgetTotal) * 100 : 0;
    const remaining = actualBudgetTotal - totalSpent;

    return {
      totalAllocated,
      totalSpent,
      totalPaid,
      percentageUsed,
      remaining,
      actualBudgetTotal,
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
      <Box mb={3}>
        <Card sx={{ 
          border: isCurrentWeek ? '2px solid' : '1px solid', 
          borderColor: isCurrentWeek ? 'primary.main' : 'divider',
          borderRadius: 2,
          boxShadow: 2,
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2.5}>
              <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 48, sm: 56 }, height: { xs: 48, sm: 56 }, fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>
                {(() => {
                  const userName = budget.userId?.name || 
                    (budget.userId?._id && userNameMap.get(budget.userId._id)) || 
                    (typeof budget.userId === 'string' && userNameMap.get(budget.userId)) || 
                    'Unknown User';
                  return userName.charAt(0).toUpperCase();
                })()}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {budget.userId?.name || 
                   (budget.userId?._id && userNameMap.get(budget.userId._id)) || 
                   (typeof budget.userId === 'string' && userNameMap.get(budget.userId)) || 
                   'Unknown User'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {format(new Date(budget.weekStartDate), 'MMM d')} - {format(new Date(budget.weekEndDate), 'MMM d, yyyy')}
                </Typography>
              </Box>
            </Box>
            {isCurrentWeek && (
              <Chip label="Current Week" color="primary" size="medium" sx={{ fontWeight: 'bold' }} />
            )}
          </Box>

          <Grid container spacing={3} mb={3}>
            <Grid item xs={6} sm={3}>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Total Budget
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  ${budget.totalBudget.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Allocated
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  ${stats.totalAllocated.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Spent
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  ${stats.totalSpent.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Remaining
                </Typography>
                <Typography variant="h6" fontWeight="bold" color={stats.remaining < 0 ? 'error.main' : 'success.main'}>
                  ${stats.remaining.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box mb={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="body2" fontWeight="medium">Budget Progress</Typography>
              <Typography variant="body2" fontWeight="bold" color="textSecondary">
                {stats.percentageUsed.toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(stats.percentageUsed, 100)}
              sx={{
                height: 10,
                borderRadius: 2,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  backgroundColor: stats.percentageUsed > 100 ? 'error.main' : 'primary.main',
                },
              }}
            />
          </Box>

          {/* Who Paid */}
          {stats.paidByUsers && stats.paidByUsers.length > 0 && (
            <Box mb={3}>
              <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                Paid By
              </Typography>
              <Box display="flex" gap={1.5} flexWrap="wrap">
                {stats.paidByUsers.map((user, index) => (
                  <Chip
                    key={index}
                    icon={<PersonIcon />}
                    label={`${user.name}: $${user.amount.toFixed(2)}`}
                    size="medium"
                    color="success"
                    variant="outlined"
                    sx={{ py: 0.5 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Top Categories */}
          {budget.categories && budget.categories.length > 0 && (
            <Box mb={3}>
              <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                Top Categories
              </Typography>
              <Box display="flex" gap={1.5} flexWrap="wrap">
                {budget.categories
                  .filter(cat => cat.categoryId && cat.categoryId._id)
                  .slice(0, 3)
                  .sort((a, b) => b.allocation - a.allocation)
                  .map((cat) => (
                    <Chip
                      key={cat.categoryId._id}
                      label={`${cat.categoryId.name || 'Unknown'}: $${cat.allocation.toFixed(0)}`}
                      size="medium"
                      sx={{
                        backgroundColor: (cat.categoryId.color || '#666') + '20',
                        color: cat.categoryId.color || '#666',
                        borderColor: cat.categoryId.color || '#666',
                        border: '1px solid',
                        py: 0.5,
                      }}
                    />
                  ))}
              </Box>
            </Box>
          )}
          
          {/* Toggle Button */}
          <Box display="flex" justifyContent="center" mt={3} gap={2} flexWrap="wrap">
            <Button
              onClick={() => toggleBudget(budget._id)}
              endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              size="medium"
              variant="outlined"
              sx={{ minWidth: 140 }}
            >
              {isExpanded ? 'Hide Details' : 'View Details'}
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
              size="medium"
              variant="outlined"
              color="warning"
              sx={{ minWidth: 120 }}
            >
              Fix Names
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* Expanded Details */}
      <Collapse in={isExpanded}>
        <Box mt={2}>
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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {currentBudgets.length > 0 && (
        <Box mb={5}>
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
            <BudgetIcon sx={{ verticalAlign: 'middle', mr: 1.5 }} />
            Current Week Budgets
          </Typography>
          {currentBudgets.map(budget => (
            <BudgetCard key={budget._id} budget={budget} />
          ))}
        </Box>
      )}

      {pastBudgets.length > 0 && (
        <Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
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
