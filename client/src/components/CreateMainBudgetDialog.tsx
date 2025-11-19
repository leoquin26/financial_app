import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Grid,
  InputAdornment,
  FormControlLabel,
  Switch,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Autocomplete,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  Category as CategoryIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from '../config/api';
import { toast } from 'react-toastify';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface CreateMainBudgetDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Category {
  _id: string;
  name: string;
  color: string;
  icon: string;
}

interface CategoryAllocation {
  categoryId: string;
  defaultAllocation: number;
  percentage: number;
}

const CreateMainBudgetDialog: React.FC<CreateMainBudgetDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    periodType: 'monthly' as 'monthly' | 'quarterly' | 'yearly' | 'custom',
    customStartDate: null as Date | null,
    customEndDate: null as Date | null,
    totalBudget: '',
    categories: [] as CategoryAllocation[],
    settings: {
      autoCreateWeekly: true,
      weeklyBudgetAmount: '',
      rolloverUnspent: false,
      shareWithHousehold: false,
      notifyOnWeekStart: true,
      notifyOnOverspend: true,
      allowFlexibleAllocations: true,
    },
    householdId: '',
  });

  const steps = ['Basic Info', 'Categories', 'Settings', 'Review'];

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data as Category[];
    },
  });

  // Fetch households
  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const response = await axios.get('/api/households');
      return response.data as Array<{ _id: string; name: string }>;
    },
  });

  // Fetch available income
  const { data: availableIncome = { total: 0, allocated: 0, available: 0 } } = useQuery({
    queryKey: ['availableIncome'],
    queryFn: async () => {
      const response = await axios.get('/api/dashboard/available-income');
      return response.data;
    },
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await axios.post('/api/main-budgets', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Budget created successfully!');
      onSuccess();
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create budget');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      periodType: 'monthly',
      customStartDate: null,
      customEndDate: null,
      totalBudget: '',
      categories: [],
      settings: {
        autoCreateWeekly: true,
        weeklyBudgetAmount: '',
        rolloverUnspent: false,
        shareWithHousehold: false,
        notifyOnWeekStart: true,
        notifyOnOverspend: true,
        allowFlexibleAllocations: true,
      },
      householdId: '',
    });
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      // Submit
      createBudgetMutation.mutate(formData);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return formData.name && formData.periodType && 
          (formData.periodType !== 'custom' || (formData.customStartDate && formData.customEndDate));
      case 1:
        return formData.totalBudget && parseFloat(formData.totalBudget) > 0;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const addCategory = (categoryId: string) => {
    if (!formData.categories.find(c => c.categoryId === categoryId)) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, {
          categoryId,
          defaultAllocation: 0,
          percentage: 0,
        }],
      }));
    }
  };

  const removeCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.categoryId !== categoryId),
    }));
  };

  const updateCategoryAllocation = (categoryId: string, allocation: number) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.map(c => 
        c.categoryId === categoryId 
          ? { 
              ...c, 
              defaultAllocation: allocation,
              percentage: formData.totalBudget ? 
                Math.round((allocation / parseFloat(formData.totalBudget)) * 100) : 0
            }
          : c
      ),
    }));
  };

  const getWeeklyAmount = () => {
    if (!formData.totalBudget) return 0;
    const total = parseFloat(formData.totalBudget);
    
    switch (formData.periodType) {
      case 'monthly':
        return Math.floor(total / 4);
      case 'quarterly':
        return Math.floor(total / 13);
      case 'yearly':
        return Math.floor(total / 52);
      case 'custom':
        if (formData.customStartDate && formData.customEndDate) {
          const days = Math.ceil((formData.customEndDate.getTime() - formData.customStartDate.getTime()) / (1000 * 60 * 60 * 24));
          const weeks = Math.ceil(days / 7);
          return Math.floor(total / weeks);
        }
        return 0;
      default:
        return 0;
    }
  };

  const getPeriodDates = () => {
    const now = new Date();
    switch (formData.periodType) {
      case 'monthly':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case 'quarterly':
        return {
          start: startOfQuarter(now),
          end: endOfQuarter(now),
        };
      case 'yearly':
        return {
          start: startOfYear(now),
          end: endOfYear(now),
        };
      case 'custom':
        return {
          start: formData.customStartDate,
          end: formData.customEndDate,
        };
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <TextField
              fullWidth
              label="Budget Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
              required
              placeholder="e.g., November 2024 Budget"
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
              multiline
              rows={2}
              placeholder="Add any notes about this budget..."
            />

            <FormControl fullWidth margin="normal" required>
              <InputLabel>Budget Period</InputLabel>
              <Select
                value={formData.periodType}
                label="Budget Period"
                onChange={(e) => setFormData(prev => ({ ...prev, periodType: e.target.value as any }))}
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
                <MenuItem value="custom">Custom Period</MenuItem>
              </Select>
            </FormControl>

            {formData.periodType === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <DatePicker
                      label="Start Date"
                      value={formData.customStartDate}
                      onChange={(date) => setFormData(prev => ({ ...prev, customStartDate: date }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <DatePicker
                      label="End Date"
                      value={formData.customEndDate}
                      onChange={(date) => setFormData(prev => ({ ...prev, customEndDate: date }))}
                      minDate={formData.customStartDate || undefined}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                </Grid>
              </LocalizationProvider>
            )}

            {formData.periodType !== 'custom' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Budget Period: {getPeriodDates().start && format(getPeriodDates().start!, 'MMM d, yyyy')} - 
                  {getPeriodDates().end && format(getPeriodDates().end!, 'MMM d, yyyy')}
                </Typography>
              </Alert>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            {availableIncome.available > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  You have <strong>${availableIncome.available.toLocaleString()}</strong> available to budget
                </Typography>
                <Typography variant="caption" display="block">
                  (${availableIncome.total.toLocaleString()} income - ${availableIncome.allocated.toLocaleString()} already budgeted)
                </Typography>
              </Alert>
            )}
            
            <TextField
              fullWidth
              label="Total Budget Amount"
              value={formData.totalBudget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d+\.?\d{0,2}$/.test(value)) {
                  setFormData(prev => ({ ...prev, totalBudget: value }));
                }
              }}
              margin="normal"
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              placeholder="0.00"
              helperText={availableIncome.available > 0 ? `Maximum available: $${availableIncome.available.toLocaleString()}` : ''}
            />

            {formData.totalBudget && (
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                Weekly allocation: ${getWeeklyAmount().toLocaleString()}
              </Alert>
            )}

            <Box mb={2}>
              <Typography variant="subtitle1" gutterBottom>
                Category Allocations (Optional)
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Pre-allocate budget amounts to categories. You can adjust these later.
              </Typography>
            </Box>

            <Autocomplete
              options={categories.filter(c => !formData.categories.find(fc => fc.categoryId === c._id))}
              getOptionLabel={(option) => option.name}
              renderInput={(params) => (
                <TextField {...params} label="Add Category" size="small" />
              )}
              onChange={(e, value) => {
                if (value) addCategory(value._id);
              }}
              sx={{ mb: 2 }}
            />

            <List>
              {formData.categories.map(cat => {
                const category = categories.find(c => c._id === cat.categoryId);
                if (!category) return null;

                return (
                  <ListItem key={cat.categoryId}>
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          bgcolor: category.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                        }}
                      >
                        {category.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText 
                      primary={category.name}
                      secondary={`${cat.percentage}% of total budget`}
                    />
                    <TextField
                      size="small"
                      value={cat.defaultAllocation || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d+\.?\d{0,2}$/.test(value)) {
                          updateCategoryAllocation(cat.categoryId, parseFloat(value) || 0);
                        }
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      sx={{ width: 120, mr: 2 }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => removeCategory(cat.categoryId)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Budget Settings
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.settings.autoCreateWeekly}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, autoCreateWeekly: e.target.checked }
                  }))}
                />
              }
              label="Auto-create weekly budgets"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.settings.rolloverUnspent}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, rolloverUnspent: e.target.checked }
                  }))}
                />
              }
              label="Roll over unspent amounts to next period"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.settings.allowFlexibleAllocations}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, allowFlexibleAllocations: e.target.checked }
                  }))}
                />
              }
              label="Allow flexible category allocations"
            />

            <Box mt={3}>
              <Typography variant="subtitle1" gutterBottom>
                Notifications
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.notifyOnWeekStart}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, notifyOnWeekStart: e.target.checked }
                    }))}
                  />
                }
                label="Notify when new week starts"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.notifyOnOverspend}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, notifyOnOverspend: e.target.checked }
                    }))}
                />
              }
              label="Notify when overspending"
            />
            </Box>

            {households.length > 0 && (
              <Box mt={3}>
                <Typography variant="subtitle1" gutterBottom>
                  Household Sharing
                </Typography>
                
                <FormControl fullWidth margin="normal">
                  <InputLabel>Share with Household</InputLabel>
                  <Select
                    value={formData.householdId}
                    label="Share with Household"
                    onChange={(e) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        householdId: e.target.value,
                        settings: { ...prev.settings, shareWithHousehold: !!e.target.value }
                      }));
                    }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {households.map(household => (
                      <MenuItem key={household._id} value={household._id}>
                        {household.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>
        );

      case 3:
        const totalAllocated = formData.categories.reduce((sum, cat) => sum + cat.defaultAllocation, 0);
        const remainingBudget = parseFloat(formData.totalBudget || '0') - totalAllocated;

        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Your Budget
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="subtitle2" fontWeight="bold">{formData.name}</Typography>
                  <Typography variant="body2">{formData.description || 'No description'}</Typography>
                </Alert>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">Period</Typography>
                <Typography variant="body1" fontWeight="bold">
                  {formData.periodType.charAt(0).toUpperCase() + formData.periodType.slice(1)}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">Dates</Typography>
                <Typography variant="body1">
                  {getPeriodDates().start && format(getPeriodDates().start!, 'MMM d')} - 
                  {getPeriodDates().end && format(getPeriodDates().end!, 'MMM d, yyyy')}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">Total Budget</Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  ${parseFloat(formData.totalBudget || '0').toLocaleString()}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">Weekly Amount</Typography>
                <Typography variant="h6" fontWeight="bold">
                  ${getWeeklyAmount().toLocaleString()}
                </Typography>
              </Grid>

              {formData.categories.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Category Allocations</Typography>
                  {formData.categories.map(cat => {
                    const category = categories.find(c => c._id === cat.categoryId);
                    return (
                      <Box key={cat.categoryId} display="flex" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <span style={{ fontSize: '1.2rem' }}>{category?.icon}</span>
                          <Typography variant="body2">{category?.name}</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight="bold">
                          ${cat.defaultAllocation} ({cat.percentage}%)
                        </Typography>
                      </Box>
                    );
                  })}
                  <Box display="flex" justifyContent="space-between" mt={2} pt={1} borderTop={1} borderColor="divider">
                    <Typography variant="body2">Remaining</Typography>
                    <Typography variant="body2" fontWeight="bold" color={remainingBudget < 0 ? 'error' : 'textPrimary'}>
                      ${remainingBudget.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Settings</Typography>
                {formData.settings.autoCreateWeekly && (
                  <Chip label="Auto-create weekly budgets" size="small" sx={{ mr: 1, mb: 1 }} />
                )}
                {formData.settings.rolloverUnspent && (
                  <Chip label="Rollover unspent" size="small" sx={{ mr: 1, mb: 1 }} />
                )}
                {formData.settings.shareWithHousehold && (
                  <Chip label="Shared with household" size="small" color="secondary" sx={{ mr: 1, mb: 1 }} />
                )}
              </Grid>
            </Grid>
          </Box>
        );
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Create Main Budget
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3, mt: 2 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Box sx={{ minHeight: 400 }}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          disabled={activeStep === 0} 
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!canProceed() || createBudgetMutation.isPending}
        >
          {activeStep === steps.length - 1 ? 'Create Budget' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateMainBudgetDialog;
