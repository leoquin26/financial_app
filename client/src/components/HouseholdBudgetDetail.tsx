import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  LinearProgress,
  IconButton,
  Avatar,
  List,
  ListItem,
  Badge,
  Paper,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Alert,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Category as CategoryIcon,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import axios from '../config/api';
import { toast } from 'react-toastify';
import PaymentStatusDropdown from './PaymentStatusDropdown';
import { useAuth } from '../contexts/AuthContext';

interface Payment {
  _id?: string;
  name: string;
  amount: number;
  scheduledDate: string;
  status: 'pending' | 'paying' | 'paid' | 'overdue' | 'cancelled';
  paidDate?: string;
  paidBy?: {
    _id: string;
    name: string;
    email: string;
  };
  paymentScheduleId?: string;
}

interface Category {
  categoryId: {
    _id: string;
    name: string;
    color: string;
    icon?: string;
  };
  allocation: number;
  payments: Payment[];
}

interface HouseholdBudgetDetailProps {
  budget: {
    _id: string;
    userId?: {
      _id: string;
      name: string;
      email: string;
    };
    totalBudget: number;
    weekStartDate: string;
    weekEndDate: string;
    categories: Category[];
    householdId?: string;
  };
  householdMembers?: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  onUpdate?: () => void;
}

const HouseholdBudgetDetail: React.FC<HouseholdBudgetDetailProps> = ({ budget, householdMembers = [], onUpdate }) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  
  console.log('HouseholdBudgetDetail - Budget data:', {
    budgetId: budget._id,
    hasCategories: !!budget.categories,
    categoriesLength: budget.categories?.length,
    categories: budget.categories,
  });
  
  // Sync categories mutation
  const syncCategoriesMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/weekly-budget/${budget._id}/sync-categories`);
      console.log('Sync response:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
      if (budget.householdId) {
        queryClient.invalidateQueries({ queryKey: ['householdBudgets', budget.householdId] });
      }
      if (data.categoriesCount > 0) {
        toast.success(`Synced ${data.categoriesCount} categories!`);
      } else {
        toast.info(data.message || 'No payments found for this budget week');
      }
      setIsSyncing(false);
      
      // Call the parent's update callback to force a refetch
      if (onUpdate) {
        console.log('Calling onUpdate callback after sync');
        onUpdate();
      }
    },
    onError: (error: any) => {
      console.error('Sync error:', error.response?.data);
      toast.error(error.response?.data?.error || error.response?.data?.details || 'Failed to sync categories');
      setIsSyncing(false);
    },
  });
  
  const handleSyncCategories = () => {
    setIsSyncing(true);
    syncCategoriesMutation.mutate();
  };

  // Calculate category stats
  const getCategoryStats = (category: Category) => {
    const allocated = category.allocation;
    const spent = category.payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    const scheduled = category.payments.reduce((sum, p) => sum + p.amount, 0);
    const percentageUsed = allocated > 0 ? (spent / allocated) * 100 : 0;
    
    return {
      allocated,
      spent,
      scheduled,
      remaining: allocated - spent,
      percentageUsed,
    };
  };

  // Update payment status and paidBy
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, status, paidBy }: { 
      paymentId: string; 
      status: string; 
      paidBy?: string;
    }) => {
      const response = await axios.patch(`/api/payments/${paymentId}`, { 
        status, 
        paidBy 
      });
      return response.data;
    },
    onSuccess: () => {
      console.log('Payment updated, invalidating queries. HouseholdId:', budget.householdId);
      // Invalidate all household budget queries (with and without specific IDs)
      queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
      // Also invalidate the specific household if we have the ID
      if (budget.householdId) {
        queryClient.invalidateQueries({ queryKey: ['householdBudgets', budget.householdId] });
      }
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Payment updated successfully!');
      
      // Call the parent's update callback to force a refetch
      if (onUpdate) {
        console.log('Calling onUpdate callback');
        onUpdate();
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update payment');
    },
  });

  const handlePaymentStatusChange = (paymentId: string, newStatus: string, paidBy?: string) => {
    console.log('handlePaymentStatusChange called:', { paymentId, newStatus, paidBy, currentUser });
    
    // First, let's fix the payment links before updating
    axios.post(`/api/weekly-budget/${budget._id}/fix-payment-links`)
      .then(() => {
        console.log('Payment links fixed, now updating status');
        updatePaymentMutation.mutate({ 
          paymentId, 
          status: newStatus,
          paidBy: newStatus === 'paid' ? paidBy : undefined
        });
      })
      .catch(error => {
        console.error('Failed to fix payment links:', error);
        // Try to update anyway
        updatePaymentMutation.mutate({ 
          paymentId, 
          status: newStatus,
          paidBy: newStatus === 'paid' ? paidBy : undefined
        });
      });
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const totalAllocated = budget.categories?.reduce((sum, cat) => sum + cat.allocation, 0) || 0;
  const totalSpent = budget.categories?.reduce((sum, cat) => 
    sum + cat.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0), 0
  ) || 0;
  const totalScheduled = budget.categories?.reduce((sum, cat) => 
    sum + cat.payments.reduce((s, p) => s + p.amount, 0), 0
  ) || 0;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Budget Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            {budget.userId && (
              <>
                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                  {budget.userId?.name?.charAt(0).toUpperCase() || '?'}
                </Avatar>
                <Box>
                  <Typography variant="h5">{budget.userId?.name || 'Unknown User'}'s Budget</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {format(new Date(budget.weekStartDate), 'MMM d')} - {format(new Date(budget.weekEndDate), 'MMM d, yyyy')}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
          <Typography variant="h4" color="primary">
            ${budget.totalBudget.toFixed(2)}
          </Typography>
        </Box>

        {/* Budget Stats */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="textSecondary">
              Progress: ${totalSpent.toFixed(2)} / ${totalAllocated.toFixed(2)}
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {((totalSpent / totalAllocated) * 100).toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((totalSpent / totalAllocated) * 100, 100)}
            sx={{
              height: 10,
              borderRadius: 1,
              backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                backgroundColor: (totalSpent / totalAllocated) > 1 ? 'error.main' : 'primary.main',
              },
            }}
          />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Chip label={`Scheduled: $${totalScheduled.toFixed(2)}`} size="small" />
            <Chip 
              label={`Remaining: $${(totalAllocated - totalSpent).toFixed(2)}`} 
              size="small" 
              color={totalAllocated - totalSpent < 0 ? 'error' : 'success'}
            />
          </Box>
        </Box>

        {/* Refresh button for immediate updates */}
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button
            size="small"
            startIcon={<ExpandMoreIcon />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
              if (budget.householdId) {
                queryClient.invalidateQueries({ queryKey: ['householdBudgets', budget.householdId] });
              }
              toast.info('Refreshing budget data...');
            }}
          >
            Refresh
          </Button>
        </Box>

        {/* Categories */}
        <Box>
          {(!budget.categories || budget.categories.length === 0) ? (
            <Alert 
              severity="info" 
              sx={{ mt: 2 }}
              action={
                <Box display="flex" gap={1}>
                  <Button 
                    size="small" 
                    onClick={handleSyncCategories}
                    disabled={isSyncing}
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      try {
                        const response = await axios.get(`/api/weekly-budget/${budget._id}/check-payments`);
                        console.log('Payment diagnostic data:', response.data);
                        toast.info(`Found ${response.data.weekPayments} payments for this week. Check console for details.`);
                      } catch (error) {
                        console.error('Diagnostic error:', error);
                      }
                    }}
                  >
                    Check Payments
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={async () => {
                      try {
                        const response = await axios.post(`/api/weekly-budget/${budget._id}/fix-payment-links`);
                        console.log('Fix links response:', response.data);
                        toast.success(`Fixed ${response.data.paymentsUpdated} payment links!`);
                        queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
                        if (budget.householdId) {
                          queryClient.invalidateQueries({ queryKey: ['householdBudgets', budget.householdId] });
                        }
                      } catch (error) {
                        console.error('Fix links error:', error);
                        toast.error('Failed to fix payment links');
                      }
                    }}
                  >
                    Fix Links
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    onClick={async () => {
                      try {
                        const response = await axios.get(`/api/weekly-budget/${budget._id}/debug-sync`);
                        console.log('Debug sync data:', response.data);
                        toast.info(`Sync issues: ${response.data.syncIssues}. Check console.`);
                      } catch (error) {
                        console.error('Debug error:', error);
                      }
                    }}
                  >
                    Debug
                  </Button>
                </Box>
              }
            >
              <Typography variant="body2">
                No categories found for this budget. Categories can be synchronized from payment schedules.
              </Typography>
            </Alert>
          ) : (
            budget.categories.map((category, index) => {
            const stats = getCategoryStats(category);
            const categoryData = category.categoryId;
            
            if (!categoryData || !categoryData._id) {
              console.warn('Category missing categoryId:', category);
              return null;
            }
            
            const isExpanded = expandedCategories.has(categoryData._id);

            return (
              <Accordion
                key={categoryData._id}
                expanded={isExpanded}
                onChange={() => toggleCategory(categoryData._id)}
                sx={{
                  mb: 1,
                  '&:before': { display: 'none' },
                  boxShadow: 1,
                  '&.Mui-expanded': { margin: '0 0 8px 0' },
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <Badge badgeContent={category.payments.length} color="primary">
                      <ExpandMoreIcon />
                    </Badge>
                  }
                >
                  <Box display="flex" alignItems="center" gap={2} flex={1}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: categoryData.color + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CategoryIcon sx={{ color: categoryData.color }} />
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {categoryData.name}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="body2" color="textSecondary">
                          ${stats.spent.toFixed(2)} / ${stats.allocated.toFixed(2)}
                        </Typography>
                        <Chip
                          label={`${stats.percentageUsed.toFixed(0)}%`}
                          size="small"
                          color={stats.percentageUsed > 100 ? 'error' : stats.percentageUsed > 80 ? 'warning' : 'success'}
                        />
                      </Box>
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails>
                  <Box>
                    {/* Progress Bar */}
                    <Box mb={3}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(stats.percentageUsed, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 1,
                          backgroundColor: 'action.hover',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 1,
                            backgroundColor: stats.percentageUsed > 100 ? 'error.main' : categoryData.color,
                          },
                        }}
                      />
                      <Box display="flex" justifyContent="space-between" mt={0.5}>
                        <Typography variant="caption" color="textSecondary">
                          Scheduled: ${stats.scheduled.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Remaining: ${stats.remaining.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Payments */}
                    {category.payments.length > 0 && (
                      <List disablePadding>
                        {category.payments.map((payment) => {
                          console.log('Rendering payment:', {
                            name: payment.name,
                            status: payment.status,
                            paymentScheduleId: payment.paymentScheduleId,
                            _id: payment._id
                          });
                          return (
                          <Paper
                            key={payment._id || payment.paymentScheduleId}
                            sx={{
                              p: 2,
                              mb: 1,
                              backgroundColor: 
                                payment.status === 'paid' ? 'success.soft' : 
                                payment.status === 'paying' ? 'info.soft' : 
                                'background.paper',
                              border: '1px solid',
                              borderColor: 
                                payment.status === 'overdue' ? 'error.main' : 
                                payment.status === 'paying' ? 'info.main' :
                                payment.status === 'paid' ? 'success.main' :
                                'divider',
                            }}
                          >
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                              <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {payment.name}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                                  <Typography variant="body2" color="textSecondary">
                                    <CalendarIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                    {format(new Date(payment.scheduledDate), 'MMM d, yyyy')}
                                  </Typography>
                                  {payment.status === 'paid' && payment.paidBy && (
                                    <Chip
                                      icon={<PersonIcon />}
                                      label={payment.paidBy.name}
                                      size="small"
                                      color="success"
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              </Box>
                              <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                                <Typography variant="h6" fontWeight="bold" color="primary">
                                  ${payment.amount.toFixed(2)}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <PaymentStatusDropdown
                                    paymentId={payment.paymentScheduleId || payment._id || ''}
                                    currentStatus={payment.status}
                                    onStatusChange={(id, status) => {
                                      if (status === 'paid') {
                                        // Default to current user when marking as paid
                                        handlePaymentStatusChange(id, status, currentUser?.id);
                                      } else {
                                        handlePaymentStatusChange(id, status);
                                      }
                                    }}
                                  />
                                </Box>
                              </Box>
                            </Box>
                          </Paper>
                        )})}
                      </List>
                    )}

                    {category.payments.length === 0 && (
                      <Typography variant="body2" color="textSecondary" align="center">
                        No payments scheduled for this category
                      </Typography>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default HouseholdBudgetDetail;
