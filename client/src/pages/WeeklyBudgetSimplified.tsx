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
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  InputAdornment,
  Breadcrumbs,
  Link,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  AttachMoney as MoneyIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Payment as PaymentIcon,
  Category as CategoryIcon,
  Group as GroupIcon,
  NavigateNext as NavigateNextIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'react-toastify';
import { useNavigate, useParams } from 'react-router-dom';
import InlinePaymentCreator from '../components/InlinePaymentCreator';
import PaymentStatusDropdown from '../components/PaymentStatusDropdown';
import { useAuth } from '../contexts/AuthContext';

interface Category {
  _id: string;
  name: string;
  color: string;
  icon: string;
}

interface Payment {
  _id?: string;
  name: string;
  amount: number;
  scheduledDate: string;
  status: 'pending' | 'paid' | 'overdue';
  isRecurring?: boolean;
  paymentScheduleId?: string;
}

interface CategoryWithPayments {
  category: Category;
  payments: Payment[];
  totalAmount: number;
}

const WeeklyBudgetSimplified: React.FC = () => {
  const navigate = useNavigate();
  const { weekId } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [totalBudget, setTotalBudget] = useState<string>('');
  const [openBudgetDialog, setOpenBudgetDialog] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [openCategorySelector, setOpenCategorySelector] = useState(false);

  const currentWeekStart = startOfWeek(new Date());
  const currentWeekEnd = endOfWeek(new Date());

  // Fetch current week's budget or specific budget by ID
  const { data: currentBudget, isLoading } = useQuery({
    queryKey: ['weeklyBudget', weekId || 'current'],
    queryFn: async () => {
      try {
        if (weekId) {
          const response = await axios.get(`/api/weekly-budget/${weekId}`);
          console.log('Fetched budget by ID:', response.data);
          return response.data;
        } else {
          const response = await axios.get('/api/weekly-budget/current');
          console.log('Fetched current budget:', response.data);
          return response.data;
        }
      } catch (error) {
        console.error('Error fetching budget:', error);
        throw error;
      }
    },
  });

  // Fetch all categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data as Category[];
    },
  });

  // Fetch user's households
  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const response = await axios.get('/api/households');
      return response.data;
    },
  });

  // Fetch payments for the current week
  const { data: weeklyPayments = [] } = useQuery({
    queryKey: ['payments', 'weekly', currentBudget?.weekStartDate || currentWeekStart],
    queryFn: async () => {
      // Use the budget's week dates if available, otherwise use current week
      const fromDate = currentBudget?.weekStartDate || currentWeekStart.toISOString();
      const toDate = currentBudget?.weekEndDate || currentWeekEnd.toISOString();
      
      const response = await axios.get('/api/payments', {
        params: {
          from: fromDate,
          to: toDate,
        },
      });
      return response.data;
    },
    enabled: !!currentBudget || !weekId, // Only fetch if we have the budget data or if it's current week
  });

  // Set/Update total budget
  const setBudgetMutation = useMutation({
    mutationFn: async (budget: number) => {
      if (currentBudget?._id) {
        // Update existing budget
        const response = await axios.patch(`/api/weekly-budget/${currentBudget._id}`, {
          totalBudget: budget
        });
        return response.data;
      } else {
        // Create new budget
        const response = await axios.post('/api/weekly-budget/smart-create', {
          mode: 'manual',
          weekStartDate: currentWeekStart.toISOString(),
          totalBudget: budget,
          categories: [], // We'll add categories as we add payments
        });
        return response.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget', weekId] });
      toast.success('Budget set successfully! Now add categories.');
      setOpenBudgetDialog(false);
      // Open category selector right after creating budget
      if (data.budget && data.budget.categories.length === 0) {
        setTimeout(() => setOpenCategorySelector(true), 500);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to set budget');
    },
  });

  // Group payments by category - use data from currentBudget if available
  const paymentsByCategory: CategoryWithPayments[] = currentBudget?.categories && currentBudget.categories.length > 0
    ? currentBudget.categories.map((budgetCategory: any) => {
        const category = categories.find(c => c._id === (budgetCategory.categoryId._id || budgetCategory.categoryId));
        if (!category) return null;
        
        const payments = budgetCategory.payments || [];
        const totalAmount = payments.reduce((sum: number, payment: any) => 
          sum + payment.amount, 0
        );
        
        return {
          category,
          payments,
          totalAmount,
        };
      }).filter(Boolean)
    : categories.map(category => {
        // Fallback to weeklyPayments for non-budget view
        const categoryPayments = weeklyPayments.filter((payment: any) => 
          payment.categoryId._id === category._id || payment.categoryId === category._id
        );
        
        const totalAmount = categoryPayments.reduce((sum: number, payment: any) => 
          sum + payment.amount, 0
        );

        return {
          category,
          payments: categoryPayments,
          totalAmount,
        };
      }).filter(cat => cat.totalAmount > 0 || expandedCategories.has(cat.category._id));

  // Calculate totals from budget data if available
  const totalScheduled = currentBudget?.categories 
    ? currentBudget.categories.reduce((sum: number, cat: any) => {
        const categoryTotal = (cat.payments || []).reduce((pSum: number, p: any) => pSum + p.amount, 0);
        return sum + categoryTotal;
      }, 0)
    : paymentsByCategory.reduce((sum, cat) => sum + cat.totalAmount, 0);
    
  const totalSpent = currentBudget?.categories
    ? currentBudget.categories.reduce((sum: number, cat: any) => {
        const categorySpent = (cat.payments || [])
          .filter((p: any) => p.status === 'paid')
          .reduce((pSum: number, p: any) => pSum + p.amount, 0);
        return sum + categorySpent;
      }, 0)
    : weeklyPayments
        .filter((p: any) => p.status === 'paid')
        .reduce((sum: number, p: any) => sum + p.amount, 0);

  const handleSetBudget = () => {
    const budgetAmount = parseFloat(totalBudget);
    if (budgetAmount > 0) {
      setBudgetMutation.mutate(budgetAmount);
    } else {
      toast.error('Please enter a valid budget amount');
    }
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

  // Initialize selected categories with all categories from the budget
  React.useEffect(() => {
    console.log('Budget update effect:', { 
      hasBudget: !!currentBudget, 
      categoriesLength: currentBudget?.categories?.length,
      categories: currentBudget?.categories 
    });
    
    if (currentBudget?.categories && currentBudget.categories.length > 0) {
      const budgetCategories = new Set<string>();
      currentBudget.categories.forEach((cat: any) => {
        const categoryId = cat.categoryId._id || cat.categoryId;
        console.log('Processing category:', { cat, categoryId });
        if (categoryId) {
          budgetCategories.add(categoryId);
        }
      });
      console.log('Setting selected categories:', Array.from(budgetCategories));
      if (budgetCategories.size > 0) {
        setSelectedCategories(budgetCategories);
      }
    }
  }, [currentBudget]);

  const handlePaymentAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['payments', 'weekly'] });
    queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
  };

  // Update payment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ paymentId, status }: { paymentId: string; status: string }) => {
      // Check if we have a current budget (embedded payments)
      if (currentBudget?._id) {
        const response = await axios.patch(`/api/weekly-budget/${currentBudget._id}/payment/${paymentId}`, { 
          status,
          paidBy: status === 'paid' ? user?.id : undefined
        });
        return response.data;
      } else {
        // Standalone payment
        const response = await axios.patch(`/api/payments/${paymentId}`, { status });
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'weekly'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['householdBudgets'] });
      toast.success('Payment status updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update payment status');
    },
  });

  const handlePaymentStatusChange = (paymentId: string, newStatus: string) => {
    updateStatusMutation.mutate({ paymentId, status: newStatus });
  };

  // Share budget mutation
  const shareBudgetMutation = useMutation({
    mutationFn: async ({ budgetId, isShared, householdId }: { 
      budgetId: string; 
      isShared: boolean; 
      householdId?: string;
    }) => {
      const response = await axios.patch(`/api/weekly-budget/${budgetId}/share`, {
        isShared,
        householdId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Budget sharing updated!');
      setOpenShareDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update sharing');
    },
  });

  const handleShareToggle = (householdId: string, isShared: boolean) => {
    if (!currentBudget?._id) return;
    
    shareBudgetMutation.mutate({
      budgetId: currentBudget._id,
      isShared,
      householdId: isShared ? householdId : undefined
    });
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      {currentBudget?.parentBudgetId && (
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" />} 
          sx={{ mb: 2 }}
        >
          <Link 
            component="button"
            variant="body1"
            onClick={() => navigate('/budgets')}
            underline="hover"
            color="inherit"
          >
            Budgets
          </Link>
          {currentBudget.parentBudgetId && (
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate(`/budgets/${currentBudget.parentBudgetId._id || currentBudget.parentBudgetId}`)}
              underline="hover"
              color="inherit"
            >
              {currentBudget.parentBudgetId.name || 'Main Budget'}
            </Link>
          )}
          <Typography color="text.primary">
            Week {currentBudget.weekNumber || '1'}
          </Typography>
        </Breadcrumbs>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          {currentBudget?.parentBudgetId && (
            <IconButton 
              onClick={() => navigate('/budgets')}
              sx={{ bgcolor: 'grey.100' }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {currentBudget?.parentBudgetId ? `Week ${currentBudget.weekNumber}` : 'Weekly Budget'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {currentBudget ? 
                `${format(new Date(currentBudget.weekStartDate), 'MMM d')} - ${format(new Date(currentBudget.weekEndDate), 'MMM d, yyyy')}` :
                `${format(currentWeekStart, 'MMM d')} - ${format(currentWeekEnd, 'MMM d, yyyy')}`
              }
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={2}>
          {households.length > 0 && currentBudget && (
            <Button
              variant="outlined"
              startIcon={<GroupIcon />}
              onClick={() => setOpenShareDialog(true)}
              color={currentBudget.isSharedWithHousehold ? "success" : "inherit"}
            >
              {currentBudget.isSharedWithHousehold ? 'Shared' : 'Share'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<CalendarIcon />}
            onClick={() => navigate('/payments')}
          >
            View Calendar
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              setTotalBudget(currentBudget?.totalBudget?.toString() || '');
              setOpenBudgetDialog(true);
            }}
          >
            {currentBudget?.totalBudget > 0 ? 'Edit Budget' : 'Set Budget'}
          </Button>
          {currentBudget && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setOpenCategorySelector(true)}
            >
              Add Category
            </Button>
          )}
        </Box>
      </Box>

      {/* Budget Overview */}
      <Grid container spacing={3} mb={4}>
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
                  {currentBudget?.totalBudget > 0 && (
                    <Typography variant="caption" color="textSecondary">
                      ${(currentBudget.totalBudget - totalScheduled).toFixed(2)} remaining
                    </Typography>
                  )}
                </Box>
                <BudgetIcon color="primary" fontSize="large" />
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
                    Scheduled
                  </Typography>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold"
                    color={currentBudget?.totalBudget && totalScheduled > currentBudget.totalBudget ? 'error' : 'inherit'}
                  >
                    ${totalScheduled.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {currentBudget?.categories 
                      ? currentBudget.categories.reduce((count: number, cat: any) => count + (cat.payments || []).length, 0)
                      : weeklyPayments.length} payments
                  </Typography>
                </Box>
                <PaymentIcon color="primary" fontSize="large" />
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
                    Paid
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    ${totalSpent.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {((totalSpent / (totalScheduled || 1)) * 100).toFixed(0)}% complete
                  </Typography>
                </Box>
                <CheckIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ 
            borderColor: currentBudget?.totalBudget && totalScheduled > currentBudget.totalBudget ? 'error.main' : undefined, 
            borderWidth: currentBudget?.totalBudget && totalScheduled > currentBudget.totalBudget ? 2 : 1 
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Status
                  </Typography>
                  <Typography 
                    variant="h6" 
                    fontWeight="bold" 
                    color={currentBudget?.totalBudget && totalScheduled > currentBudget.totalBudget ? 'error' : 'success'}
                  >
                    {currentBudget?.totalBudget && totalScheduled > currentBudget.totalBudget ? 'Over Budget' : 'On Track'}
                  </Typography>
                </Box>
                {currentBudget?.totalBudget && totalScheduled > currentBudget.totalBudget ? (
                  <WarningIcon color="error" fontSize="large" />
                ) : (
                  <CheckIcon color="success" fontSize="large" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progress Bar */}
      {currentBudget?.totalBudget > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">Budget Usage</Typography>
            <Typography variant="caption" color="textSecondary">
              {totalScheduled.toFixed(2)} / {currentBudget.totalBudget.toFixed(2)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((totalScheduled / currentBudget.totalBudget) * 100, 100)}
            sx={{
              height: 12,
              borderRadius: 1,
              backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                backgroundColor: totalScheduled > currentBudget.totalBudget ? 'error.main' : 'primary.main',
              },
            }}
          />
        </Paper>
      )}

      {/* Instructions */}
      {weeklyPayments.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Getting Started:
          </Typography>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Set your weekly budget using the "Set Budget" button</li>
            <li>Add payments by clicking on any category below</li>
            <li>View all your payments in the calendar</li>
          </ol>
        </Alert>
      )}

      {/* Categories with Payments */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Payments by Category
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setOpenCategorySelector(true)}
        >
          Add Category
        </Button>
      </Box>
      
      {/* Category Selector Dialog */}
      <Dialog
        open={openCategorySelector}
        onClose={() => setOpenCategorySelector(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Categories to Budget</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Categories</InputLabel>
            <Select
              multiple
              value={Array.from(selectedCategories)}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedCategories(new Set(typeof value === 'string' ? value.split(',') : value));
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const category = categories.find(c => c._id === value);
                    return category ? (
                      <Chip 
                        key={value} 
                        label={category.name} 
                        size="small"
                        sx={{ bgcolor: category.color + '20', color: category.color }}
                      />
                    ) : null;
                  })}
                </Box>
              )}
            >
              {categories.map((category) => (
                <MenuItem key={category._id} value={category._id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 1,
                        backgroundColor: category.color + '20',
                      }}
                    />
                    <Typography>{category.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCategorySelector(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (currentBudget?._id && selectedCategories.size > 0) {
                try {
                  const response = await axios.patch(`/api/weekly-budget/${currentBudget._id}/categories`, {
                    categories: Array.from(selectedCategories)
                  });
                  
                  // Auto-expand newly added categories
                  const newExpanded = new Set(expandedCategories);
                  selectedCategories.forEach(catId => {
                    if (!expandedCategories.has(catId)) {
                      newExpanded.add(catId);
                    }
                  });
                  setExpandedCategories(newExpanded);
                  
                  queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
                  toast.success('Categories updated!');
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Failed to update categories');
                }
              }
              setOpenCategorySelector(false);
            }} 
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Show message if no categories selected */}
      {selectedCategories.size === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            No categories added yet
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Click "Add Category" to start organizing your budget
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCategorySelector(true)}
          >
            Add Categories
          </Button>
        </Paper>
      )}

      <List>
        {categories.filter(category => selectedCategories.has(category._id)).map((category) => {
          const categoryData = paymentsByCategory.find(c => c.category._id === category._id);
          const isExpanded = expandedCategories.has(category._id);
          const hasPayments = categoryData && categoryData.payments.length > 0;

          return (
            <Paper key={category._id} sx={{ mb: 2 }}>
              <ListItem
                button
                onClick={() => toggleCategory(category._id)}
                sx={{
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      backgroundColor: category.color + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CategoryIcon sx={{ color: category.color }} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={category.name}
                  secondary={
                    hasPayments && categoryData
                      ? `$${categoryData.totalAmount.toFixed(2)} - ${categoryData.payments.length} payment${categoryData.payments.length > 1 ? 's' : ''}`
                      : 'No payments scheduled'
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end">
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>

              <Collapse in={isExpanded}>
                <Box sx={{ p: 2, pt: 0 }}>
                  {/* Existing Payments */}
                  {hasPayments && categoryData && (
                    <List dense sx={{ mb: 2 }}>
                      {categoryData.payments.map((payment: any) => (
                        <Paper
                          key={payment._id}
                          sx={{
                            p: 2,
                            mb: 2,
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
                              <Typography variant="subtitle1" fontWeight="bold">
                                {payment.name}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                                <Typography variant="body2" color="textSecondary">
                                  <CalendarIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                  {format(new Date(payment.dueDate || payment.scheduledDate), 'MMM d, yyyy')}
                                </Typography>
                                {payment.isRecurring && (
                                  <Chip label="Recurring" size="small" variant="outlined" />
                                )}
                              </Box>
                              {payment.notes && (
                                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                                  {payment.notes}
                                </Typography>
                              )}
                            </Box>
                            <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                              <Typography variant="h6" fontWeight="bold" color="primary">
                                ${payment.amount.toFixed(2)}
                              </Typography>
                              <PaymentStatusDropdown
                                paymentId={payment._id}
                                currentStatus={payment.status}
                                onStatusChange={handlePaymentStatusChange}
                              />
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </List>
                  )}

                  {/* Add Payment Button */}
                  <InlinePaymentCreator
                    categoryId={category._id}
                    categoryName={category.name}
                    categoryColor={category.color}
                    allocation={currentBudget?.totalBudget || 0}
                    currentTotal={totalScheduled}
                    weekStart={currentWeekStart}
                    weekEnd={currentWeekEnd}
                    onSave={handlePaymentAdded}
                    budgetId={currentBudget?._id}
                  />
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </List>

      {/* Set Budget Dialog */}
      <Dialog open={openBudgetDialog} onClose={() => setOpenBudgetDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <BudgetIcon color="primary" />
            Set Weekly Budget
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Total Budget"
            type="number"
            fullWidth
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            helperText="Enter your total budget for this week"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBudgetDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSetBudget} 
            variant="contained"
            disabled={!totalBudget || parseFloat(totalBudget) <= 0}
          >
            Set Budget
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Budget Dialog */}
      <Dialog open={openShareDialog} onClose={() => setOpenShareDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <GroupIcon color="primary" />
            Share Weekly Budget with Household
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Select which household you want to share this weekly budget with. Household members will be able to view your budget.
          </Typography>
          
          {households.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              You are not a member of any households. Join or create a household to share your budget.
            </Alert>
          ) : (
            <List sx={{ mt: 2 }}>
              {households.map((household: any) => (
                <ListItem
                  key={household._id}
                  sx={{
                    border: '1px solid',
                    borderColor: 
                      currentBudget?.householdId === household._id && currentBudget?.isSharedWithHousehold 
                        ? 'success.main' 
                        : 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                      }}
                    >
                      {household.name.charAt(0).toUpperCase()}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={household.name}
                    secondary={`${household.members.length + 1} members`}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label={
                        currentBudget?.householdId === household._id && currentBudget?.isSharedWithHousehold
                          ? 'Shared'
                          : 'Not Shared'
                      }
                      color={
                        currentBudget?.householdId === household._id && currentBudget?.isSharedWithHousehold
                          ? 'success'
                          : 'default'
                      }
                      size="small"
                      onClick={() => handleShareToggle(
                        household._id, 
                        !(currentBudget?.householdId === household._id && currentBudget?.isSharedWithHousehold)
                      )}
                      sx={{ cursor: 'pointer' }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShareDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WeeklyBudgetSimplified;
