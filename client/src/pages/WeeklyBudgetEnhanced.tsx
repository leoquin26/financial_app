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
  Divider,
  Collapse,
  Paper,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
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
  Schedule as ScheduleIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  Payment as PaymentIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { WeeklyBudgetProvider, useWeeklyBudget } from '../contexts/WeeklyBudgetContext';
import BudgetTemplateSelector from '../components/BudgetTemplateSelector';

interface Category {
  _id: string;
  name: string;
  color: string;
  icon: string;
}

const WeeklyBudgetContent: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    currentBudget,
    isLoading,
    totalAllocated,
    totalScheduled,
    totalSpent,
    remainingBudget,
    isOverBudget,
    warnings,
    createBudget,
    addPaymentToCategory,
    updatePaymentStatus,
    deleteCategory,
    deletePayment,
    getCategoryStats,
    refreshBudget,
  } = useWeeklyBudget();

  const [createMode, setCreateMode] = useState<'template' | 'smart' | 'manual' | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [tabValue, setTabValue] = useState(0);
  const [openManualDialog, setOpenManualDialog] = useState(false);
  const [manualBudgetData, setManualBudgetData] = useState({
    totalBudget: '',
    categories: [] as Array<{ categoryId: string; allocation: number }>
  });
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    type: 'category' | 'payment';
    categoryId?: string;
    paymentId?: string;
    name?: string;
  }>({ open: false, type: 'category' });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data;
    },
  });

  const currentWeekStart = startOfWeek(new Date());
  const currentWeekEnd = endOfWeek(new Date());

  useEffect(() => {
    if (!currentBudget && !isLoading && !showTemplateSelector) {
      setShowTemplateSelector(true);
    }
  }, [currentBudget, isLoading, showTemplateSelector]);

  const handleSelectMode = async (mode: 'template' | 'smart' | 'manual', templateId?: string) => {
    setCreateMode(mode);
    setShowTemplateSelector(false);

    if (mode === 'template' && templateId) {
      await createBudget('template', { templateId, weekStartDate: currentWeekStart.toISOString() });
    } else if (mode === 'smart') {
      await createBudget('smart', { weekStartDate: currentWeekStart.toISOString() });
    } else {
      // Show manual creation dialog
      handleOpenManualDialog();
    }
  };

  const handleOpenManualDialog = () => {
    setOpenManualDialog(true);
    setManualBudgetData({
      totalBudget: currentBudget?.totalBudget.toString() || '',
      categories: currentBudget?.categories.map(cat => ({
        categoryId: cat.categoryId._id || cat.categoryId,
        allocation: cat.allocation
      })) || []
    });
    setSelectedCategories(new Set(
      currentBudget?.categories.map(cat => cat.categoryId._id || cat.categoryId) || []
    ));
  };

  const handleCloseManualDialog = () => {
    setOpenManualDialog(false);
    setManualBudgetData({ totalBudget: '', categories: [] });
    setSelectedCategories(new Set());
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
      setManualBudgetData({
        ...manualBudgetData,
        categories: manualBudgetData.categories.filter(c => c.categoryId !== categoryId)
      });
    } else {
      newSelected.add(categoryId);
      setManualBudgetData({
        ...manualBudgetData,
        categories: [...manualBudgetData.categories, { categoryId, allocation: 0 }]
      });
    }
    setSelectedCategories(newSelected);
  };

  const handleAllocationChange = (categoryId: string, value: string) => {
    setManualBudgetData({
      ...manualBudgetData,
      categories: manualBudgetData.categories.map(cat =>
        cat.categoryId === categoryId 
          ? { ...cat, allocation: parseFloat(value) || 0 }
          : cat
      )
    });
  };

  const handleCreateManualBudget = async () => {
    if (!manualBudgetData.totalBudget || parseFloat(manualBudgetData.totalBudget) <= 0) {
      toast.error('Please enter a valid total budget');
      return;
    }

    if (manualBudgetData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    try {
      await createBudget('manual', {
        weekStartDate: currentWeekStart.toISOString(),
        totalBudget: parseFloat(manualBudgetData.totalBudget),
        categories: manualBudgetData.categories.filter(cat => cat.allocation > 0)
      });
      handleCloseManualDialog();
      setShowTemplateSelector(false);
      refreshBudget();
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddPayment = async (categoryId: string, paymentData: any) => {
    await addPaymentToCategory(categoryId, paymentData);
  };

  const handlePaymentStatusChange = async (paymentId: string, newStatus: 'pending' | 'paid' | 'overdue') => {
    await updatePaymentStatus(paymentId, newStatus);
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    setDeleteConfirmDialog({
      open: true,
      type: 'category',
      categoryId,
      name: categoryName,
    });
  };

  const handleDeletePayment = (categoryId: string, paymentId: string, paymentName: string) => {
    setDeleteConfirmDialog({
      open: true,
      type: 'payment',
      categoryId,
      paymentId,
      name: paymentName,
    });
  };

  const handleConfirmDelete = async () => {
    const { type, categoryId, paymentId } = deleteConfirmDialog;
    
    try {
      if (type === 'category' && categoryId) {
        await deleteCategory(categoryId);
        // Close the expanded category
        const newExpanded = new Set(expandedCategories);
        newExpanded.delete(categoryId);
        setExpandedCategories(newExpanded);
      } else if (type === 'payment' && categoryId && paymentId) {
        await deletePayment(categoryId, paymentId);
      }
      
      setDeleteConfirmDialog({ open: false, type: 'category' });
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (showTemplateSelector) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box mb={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              setShowTemplateSelector(false);
              setCreateMode(null);
            }}
          >
            Back to Budget
          </Button>
        </Box>
        <BudgetTemplateSelector
          currentWeekStart={currentWeekStart}
          onSelectMode={handleSelectMode}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Weekly Budget
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CalendarIcon />}
            onClick={() => navigate('/payment-schedule')}
          >
            Payment Calendar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setShowTemplateSelector(true);
              setCreateMode(null);
            }}
          >
            {currentBudget ? 'New Budget' : 'Create Budget'}
          </Button>
        </Box>
      </Box>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Budget Warnings:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Budget Overview Cards */}
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
                    ${currentBudget?.totalBudget.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ${remainingBudget.toFixed(2)} unallocated
                  </Typography>
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
                  <Typography variant="h5" fontWeight="bold" color={isOverBudget ? 'error' : 'inherit'}>
                    ${totalScheduled.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ${totalAllocated.toFixed(2)} allocated
                  </Typography>
                </Box>
                <PaymentIcon color={isOverBudget ? 'error' : 'primary'} fontSize="large" />
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
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    ${totalSpent.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {((totalSpent / (currentBudget?.totalBudget || 1)) * 100).toFixed(0)}% of budget
                  </Typography>
                </Box>
                <CheckIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ borderColor: isOverBudget ? 'error.main' : undefined, borderWidth: isOverBudget ? 2 : 1 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Status
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color={isOverBudget ? 'error' : 'success'}>
                    {isOverBudget ? 'Over Budget' : 'On Track'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {warnings.length} warnings
                  </Typography>
                </Box>
                {isOverBudget ? (
                  <WarningIcon color="error" fontSize="large" />
                ) : (
                  <TrendingUpIcon color="success" fontSize="large" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progress Bar */}
      {currentBudget && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">Budget Progress</Typography>
            <Typography variant="caption" color="textSecondary">
              {totalSpent.toFixed(2)} / {currentBudget.totalBudget.toFixed(2)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((totalSpent / currentBudget.totalBudget) * 100, 100)}
            sx={{
              height: 12,
              borderRadius: 1,
              backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                background: isOverBudget
                  ? 'linear-gradient(90deg, #f44336 0%, #d32f2f 100%)'
                  : 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)',
              },
            }}
          />
        </Paper>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Categories & Payments" />
          <Tab label="Calendar View" />
          <Tab label="Insights" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && currentBudget && (
        <Box>
          {currentBudget.categories.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary" gutterBottom>
                No categories allocated yet
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenManualDialog}
                sx={{ mt: 2 }}
              >
                Add Categories
              </Button>
            </Paper>
          ) : (
            <Box>
              {currentBudget.categories.map((category) => {
                const stats = getCategoryStats(category.categoryId._id || category.categoryId);
                const isExpanded = expandedCategories.has(category.categoryId._id || category.categoryId);
                const categoryData = typeof category.categoryId === 'object' ? category.categoryId : 
                  categories.find((c: Category) => c._id === category.categoryId);

                return (
                  <Accordion
                    key={category.categoryId._id || category.categoryId}
                    expanded={isExpanded}
                    onChange={() => toggleCategoryExpansion(category.categoryId._id || category.categoryId)}
                    sx={{
                      mb: 2,
                      '&:before': { display: 'none' },
                      boxShadow: 1,
                      '&.Mui-expanded': { margin: '0 0 16px 0' },
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
                            backgroundColor: categoryData?.color + '20',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CategoryIcon sx={{ color: categoryData?.color }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="h6">{categoryData?.name}</Typography>
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
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(
                              category.categoryId._id || category.categoryId,
                              categoryData?.name || 'Category'
                            );
                          }}
                          sx={{ mr: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
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
                              height: 10,
                              borderRadius: 1,
                              backgroundColor: 'action.hover',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 1,
                                backgroundColor: stats.percentageUsed > 100 ? 'error.main' : categoryData?.color,
                              },
                            }}
                          />
                          <Box display="flex" justifyContent="space-between" mt={1}>
                            <Typography variant="caption" color="textSecondary">
                              ${stats.scheduled.toFixed(2)} scheduled
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              ${stats.remaining.toFixed(2)} remaining
                            </Typography>
                          </Box>
                        </Box>

                        {/* Payment List */}
                        {category.payments.length > 0 && (
                          <List disablePadding>
                            {category.payments.map((payment) => (
                              <ListItem
                                key={payment._id || payment.paymentScheduleId}
                                sx={{
                                  borderRadius: 1,
                                  mb: 1,
                                  backgroundColor: payment.status === 'paid' ? 'success.soft' : 'background.paper',
                                  border: '1px solid',
                                  borderColor: payment.status === 'overdue' ? 'error.main' : 'divider',
                                }}
                              >
                                <Box flex={1}>
                                  <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Typography variant="body1" fontWeight="medium">
                                      {payment.name}
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Typography variant="body1" fontWeight="bold">
                                        ${payment.amount.toFixed(2)}
                                      </Typography>
                                      <Chip
                                        label={payment.status}
                                        size="small"
                                        color={
                                          payment.status === 'paid' ? 'success' :
                                          payment.status === 'overdue' ? 'error' : 'warning'
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const nextStatus = payment.status === 'pending' ? 'paid' : 'pending';
                                          handlePaymentStatusChange(payment._id || payment.paymentScheduleId!, nextStatus);
                                        }}
                                        sx={{ cursor: 'pointer' }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDeletePayment(
                                          category.categoryId._id || category.categoryId,
                                          payment._id || payment.paymentScheduleId!,
                                          payment.name
                                        )}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  </Box>
                                  <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                                    <Typography variant="caption" color="textSecondary">
                                      <CalendarIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                                      {format(new Date(payment.scheduledDate), 'MMM d, yyyy')}
                                    </Typography>
                                    {payment.isRecurring && (
                                      <Chip label="Recurring" size="small" variant="outlined" />
                                    )}
                                    {payment.notes && (
                                      <Typography variant="caption" color="textSecondary">
                                        {payment.notes}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </ListItem>
                            ))}
                          </List>
                        )}

                        {/* Add Payment Button */}
                        <Box mt={2}>
                          <Box
                            sx={{
                              border: '2px dashed',
                              borderColor: categoryData?.color || 'divider',
                              borderRadius: 1,
                              p: 2,
                              textAlign: 'center',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                            }}
                            onClick={() => {
                              const newPaymentData = {
                                name: '',
                                amount: 0,
                                scheduledDate: new Date().toISOString(),
                              };
                              handleAddPayment(
                                category.categoryId._id || category.categoryId,
                                newPaymentData
                              );
                            }}
                          >
                            <Button startIcon={<AddIcon />} color="primary">
                              Add Payment
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {tabValue === 1 && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary" gutterBottom>
            Calendar view shows all your scheduled payments
          </Typography>
          <Button
            variant="contained"
            startIcon={<CalendarIcon />}
            onClick={() => navigate('/payment-schedule')}
            sx={{ mt: 2 }}
          >
            Go to Payment Calendar
          </Button>
        </Paper>
      )}

      {tabValue === 2 && currentBudget?.insights && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Budget Insights
          </Typography>
          {currentBudget.insights.recommendations.map((rec, index) => (
            <Alert key={index} severity="info" sx={{ mb: 2 }}>
              {rec}
            </Alert>
          ))}
        </Paper>
      )}

      {/* Manual Budget Creation Dialog */}
      <Dialog 
        open={openManualDialog} 
        onClose={handleCloseManualDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">Create Weekly Budget</Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* Total Budget */}
            <TextField
              label="Total Budget"
              type="number"
              value={manualBudgetData.totalBudget}
              onChange={(e) => setManualBudgetData({ 
                ...manualBudgetData, 
                totalBudget: e.target.value 
              })}
              fullWidth
              margin="normal"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              autoFocus
            />

            {/* Category Selection */}
            <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
              Select Categories
            </Typography>
            <List>
              {categories.map((category: Category) => {
                const isSelected = selectedCategories.has(category._id);
                const categoryData = manualBudgetData.categories.find(
                  c => c.categoryId === category._id
                );
                
                return (
                  <ListItem key={category._id} divider>
                    <Box display="flex" alignItems="center" gap={2} flex={1}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleCategoryToggle(category._id)}
                        color="primary"
                      />
                      <Box
                        width={24}
                        height={24}
                        borderRadius="50%"
                        style={{ backgroundColor: category.color }}
                      />
                      <Typography flex={1}>{category.name}</Typography>
                      {isSelected && (
                        <TextField
                          label="Allocation"
                          type="number"
                          value={categoryData?.allocation || ''}
                          onChange={(e) => handleAllocationChange(category._id, e.target.value)}
                          size="small"
                          sx={{ width: 120 }}
                          InputProps={{
                            startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                          }}
                        />
                      )}
                    </Box>
                  </ListItem>
                );
              })}
            </List>

            {/* Summary */}
            {manualBudgetData.categories.length > 0 && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Total Allocated:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${manualBudgetData.categories.reduce((sum, cat) => sum + cat.allocation, 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Remaining:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold"
                    color={
                      parseFloat(manualBudgetData.totalBudget) - 
                      manualBudgetData.categories.reduce((sum, cat) => sum + cat.allocation, 0) < 0
                        ? 'error' : 'success'
                    }
                  >
                    ${(
                      parseFloat(manualBudgetData.totalBudget || '0') - 
                      manualBudgetData.categories.reduce((sum, cat) => sum + cat.allocation, 0)
                    ).toFixed(2)}
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseManualDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateManualBudget}
            disabled={
              !manualBudgetData.totalBudget || 
              manualBudgetData.categories.length === 0 ||
              parseFloat(manualBudgetData.totalBudget) <= 0
            }
          >
            Create Budget
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, type: 'category' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            <Typography>Confirm Delete</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteConfirmDialog.type === 'category' ? 'the category' : 'this payment'}{' '}
            <strong>{deleteConfirmDialog.name}</strong>?
          </Typography>
          {deleteConfirmDialog.type === 'category' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This will also delete all payments in this category.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmDialog({ open: false, type: 'category' })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            startIcon={<DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

const WeeklyBudgetEnhanced: React.FC = () => {
  return (
    <WeeklyBudgetProvider>
      <WeeklyBudgetContent />
    </WeeklyBudgetProvider>
  );
};

export default WeeklyBudgetEnhanced;
