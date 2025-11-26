import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  IconButton,
  Chip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  Popover,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as PaidIcon,
  Warning as OverdueIcon,
  Schedule as PendingIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  ListAlt as ListIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { formatCurrency, getCurrencySymbol } from '../utils/currencies';
import { useAuth } from '../contexts/AuthContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Define interfaces
interface PaymentSchedule {
  _id: string;
  name: string;
  amount: number;
  categoryId: {
    _id: string;
    name: string;
    color: string;
  };
  dueDate: string;
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidDate?: string;
  notes?: string;
  reminder: {
    enabled: boolean;
    daysBefore: number;
  };
  isRecurring: boolean;
  recurringEndDate?: string;
  fromWeeklyBudget?: boolean;
  weeklyBudgetId?: string;
}

interface PaymentFormData {
  name: string;
  amount: number;
  categoryId: string;
  dueDate: string;
  frequency: string;
  notes: string;
  reminder: {
    enabled: boolean;
    daysBefore: number;
  };
  isRecurring: boolean;
  recurringEndDate?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string | Date;
  end: string | Date;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    payment: PaymentSchedule;
  };
}

const PaymentScheduleImproved: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSchedule | null>(null);
  const [filter, setFilter] = useState('all');
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const calendarRef = React.useRef<any>(null);

  const [formData, setFormData] = useState<PaymentFormData>({
    name: '',
    amount: 0,
    categoryId: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    frequency: 'once',
    notes: '',
    reminder: {
      enabled: true,
      daysBefore: 3,
    },
    isRecurring: false,
    recurringEndDate: '',
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data;
    },
  });

  // Fetch payments for the selected week
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments', weekStart.toISOString()],
    queryFn: async () => {
      const response = await axios.get('/api/payments', {
        params: {
          from: format(weekStart, 'yyyy-MM-dd'),
          to: format(weekEnd, 'yyyy-MM-dd')
        },
      });
      return response.data;
    },
  });

  // Fetch weekly budgets for the selected range
  const { data: weeklyBudgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['weeklyBudgets', 'range', weekStart.toISOString()],
    queryFn: async () => {
      const response = await axios.get('/api/weekly-budget/range', {
        params: {
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
      });
      console.log('Weekly budgets response:', response.data);
      return response.data || [];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const response = await axios.post('/api/payments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment created successfully');
      setOpenDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create payment');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axios.patch(`/api/payments/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment updated successfully');
      setOpenDialog(false);
      setSelectedPayment(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update payment');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment deleted successfully');
      setOpenDialog(false);
      setSelectedPayment(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete payment');
    },
  });

  // Transform payments to calendar events
  const calendarEvents: CalendarEvent[] = [];
  const processedPaymentIds = new Set<string>();

  // Debug logging
  console.log('Payments data:', payments);
  console.log('Weekly budgets data:', weeklyBudgets);
  console.log('Payments with weeklyBudgetId:', payments.filter((p: PaymentSchedule) => p.weeklyBudgetId));

  // Process weekly budget payments first to mark them as processed
  weeklyBudgets.forEach((budget: any) => {
    if (budget.categories && budget.categories.length > 0) {
      budget.categories.forEach((category: any) => {
        if (category.payments && category.payments.length > 0) {
          category.payments.forEach((payment: any) => {
            const paymentId = payment._id || payment.paymentScheduleId;
            processedPaymentIds.add(paymentId);
          });
        }
      });
    }
  });

  // Process standalone payments (skip if already in weekly budget)
  payments.forEach((payment: PaymentSchedule) => {
    // Skip if this payment was already processed from weekly budget
    if (processedPaymentIds.has(payment._id)) {
      return;
    }
    
    // Also skip if this payment has a weeklyBudgetId (it belongs to a budget)
    if (payment.weeklyBudgetId) {
      console.log('Skipping payment with weeklyBudgetId:', payment.name, payment.weeklyBudgetId);
      return;
    }

    const eventDate = parseISO(payment.dueDate);
    let backgroundColor = payment.categoryId.color;
    let borderColor = payment.categoryId.color;
    let textColor = '#fff';

    if (payment.status === 'paid') {
      backgroundColor = '#4caf50';
      borderColor = '#4caf50';
    } else if (payment.status === 'overdue') {
      backgroundColor = '#f44336';
      borderColor = '#f44336';
    }

    calendarEvents.push({
      id: payment._id,
      title: `💰 ${payment.name} (${formatCurrency(payment.amount, user?.currency || 'PEN')})`,
      start: eventDate.toISOString(),
      end: eventDate.toISOString(),
      backgroundColor,
      borderColor,
      textColor,
      extendedProps: {
        payment: payment
      }
    });
  });

  // Process weekly budget payments
  weeklyBudgets.forEach((budget: any) => {
    if (budget.categories && budget.categories.length > 0) {
      budget.categories.forEach((category: any) => {
        if (category.payments && category.payments.length > 0) {
          category.payments.forEach((payment: any) => {
            const eventDate = parseISO(payment.scheduledDate || payment.dueDate);
            let backgroundColor = category.categoryId.color;
            let borderColor = category.categoryId.color;
            let textColor = '#fff';

            if (payment.status === 'paid') {
              backgroundColor = '#4caf50';
              borderColor = '#4caf50';
            }

            const budgetPayment: PaymentSchedule = {
              _id: payment._id || payment.paymentScheduleId,
              name: payment.name,
              amount: payment.amount,
              categoryId: category.categoryId,
              dueDate: payment.scheduledDate || payment.dueDate,
              frequency: 'once',
              status: payment.status || 'pending',
              paidDate: payment.paidDate,
              notes: `From weekly budget: ${format(parseISO(budget.weekStartDate), 'MMM d')} - ${format(parseISO(budget.weekEndDate), 'MMM d')}`,
              reminder: { enabled: false, daysBefore: 0 },
              isRecurring: false,
              fromWeeklyBudget: true,
              weeklyBudgetId: budget._id
            };

            calendarEvents.push({
              id: budgetPayment._id,
              title: `💰 ${payment.name} (${formatCurrency(payment.amount, user?.currency || 'PEN')})`,
              start: eventDate.toISOString(),
              end: eventDate.toISOString(),
              backgroundColor,
              borderColor,
              textColor,
              extendedProps: {
                payment: budgetPayment
              }
            });
          });
        }
      });
    }
  });

  // Debug calendar events
  console.log('Calendar events:', calendarEvents);
  console.log('Total calendar events:', calendarEvents.length);

  // Calculate statistics - only count unique payments
  const uniquePayments: PaymentSchedule[] = [];
  const seenPaymentIds = new Set<string>();
  
  // Add all calendar event payments (these are the deduplicated ones)
  calendarEvents.forEach(event => {
    const payment = event.extendedProps.payment;
    if (!seenPaymentIds.has(payment._id)) {
      seenPaymentIds.add(payment._id);
      uniquePayments.push(payment);
    }
  });
  
  const stats = {
    total: uniquePayments.reduce((sum, p) => sum + p.amount, 0),
    paid: uniquePayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
    pending: uniquePayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    overdue: uniquePayments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0),
    fromBudget: uniquePayments.filter(p => p.fromWeeklyBudget || p.weeklyBudgetId).length
  };

  // Debug stats after calculation
  console.log('Stats:', stats);
  console.log('Unique payments:', uniquePayments.length);

  const handleDateClick = (arg: any) => {
    setFormData(prev => ({
      ...prev,
      dueDate: format(arg.date, 'yyyy-MM-dd')
    }));
    setOpenDialog(true);
  };

  const handleEventClick = (arg: any) => {
    const payment = arg.event.extendedProps.payment;
    if (payment.fromWeeklyBudget && payment.weeklyBudgetId) {
      navigate(`/budgets/week/${payment.weeklyBudgetId}`);
    } else {
      handleOpenDialog(payment);
    }
  };

  const handleEventMouseEnter = (arg: any) => {
    setAnchorEl(arg.el);
    setHoveredEvent(arg.event);
  };

  const handleEventMouseLeave = () => {
    setAnchorEl(null);
    setHoveredEvent(null);
  };

  const handleOpenDialog = (payment?: PaymentSchedule) => {
    if (payment) {
      setSelectedPayment(payment);
      setFormData({
        name: payment.name,
        amount: payment.amount,
        categoryId: payment.categoryId._id,
        dueDate: format(parseISO(payment.dueDate), 'yyyy-MM-dd'),
        frequency: payment.frequency,
        notes: payment.notes || '',
        reminder: payment.reminder,
        isRecurring: payment.isRecurring,
        recurringEndDate: payment.recurringEndDate || '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPayment(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: 0,
      categoryId: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      frequency: 'once',
      notes: '',
      reminder: {
        enabled: true,
        daysBefore: 3,
      },
      isRecurring: false,
      recurringEndDate: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name || formData.amount <= 0 || !formData.categoryId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedPayment) {
      updateMutation.mutate({
        id: selectedPayment._id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (selectedPayment && window.confirm('Are you sure you want to delete this payment?')) {
      deleteMutation.mutate(selectedPayment._id);
    }
  };

  const handleStatusChange = async (paymentId: string, newStatus: string) => {
    try {
      await axios.patch(`/api/payments/${paymentId}`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Status updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      p: 2
    }}>
      {/* Header */}
      <Box 
        display="flex" 
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }}
        mb={3} 
        gap={2}
      >
        <Typography variant="h4" fontWeight="bold">
          Payment Schedule
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            New Payment
          </Button>
          <IconButton onClick={() => refetch()} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total
                  </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(stats.total, user?.currency || 'PEN')}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {uniquePayments.length} events
                </Typography>
                </Box>
                <MoneyIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Paid
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {formatCurrency(stats.paid, user?.currency || 'PEN')}
                  </Typography>
                </Box>
                <PaidIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    {formatCurrency(stats.pending, user?.currency || 'PEN')}
                  </Typography>
                </Box>
                <PendingIcon color="warning" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Overdue
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    {formatCurrency(stats.overdue, user?.currency || 'PEN')}
                  </Typography>
                </Box>
                <OverdueIcon color="error" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    From Budget
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="info.main">
                    {stats.fromBudget}
                  </Typography>
                </Box>
                <CalendarIcon color="info" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<CalendarIcon />} label="Calendar View" />
          <Tab icon={<ListIcon />} label="List View" />
        </Tabs>
      </Paper>

      {/* Content */}
      {(isLoading || loadingBudgets) ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && (
            <Paper sx={{ 
              p: { xs: 1, sm: 2, md: 3 }, 
              borderRadius: 2, 
              boxShadow: 2,
              width: '100%',
              overflow: 'hidden'
            }}>
              <Box sx={{
                width: '100%',
                overflowX: 'auto',
                '& .fc': {
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  minWidth: { xs: '600px', sm: '100%' },
                },
                '& .fc-event': {
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  fontSize: '0.9em',
                  fontWeight: 500,
                  marginBottom: '2px',
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                },
                '& .fc-event-main': {
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                },
                '& .fc-event-title': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
                '& .fc-daygrid-event': {
                  whiteSpace: 'normal',
                },
                '& .fc-daygrid-day-events': {
                  maxHeight: '100px',
                  overflowY: 'auto',
                },
                '& .fc-more-link': {
                  color: '#1976d2',
                  fontWeight: 'bold',
                },
                '& .fc-today': {
                  backgroundColor: '#e3f2fd !important',
                },
                '& .fc-col-header-cell': {
                  backgroundColor: '#f5f5f5',
                  fontWeight: 'bold',
                },
              }}>
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                  }}
                  events={calendarEvents}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  eventMouseEnter={handleEventMouseEnter}
                  eventMouseLeave={handleEventMouseLeave}
                  height="700px"
                  dayMaxEvents={3}
                  moreLinkText="more"
                  eventDisplay="block"
                  displayEventTime={false}
                  weekends={true}
                  businessHours={{
                    daysOfWeek: [1, 2, 3, 4, 5],
                    startTime: '08:00',
                    endTime: '18:00',
                  }}
                  views={{
                    dayGridMonth: {
                      dayMaxEventRows: 4,
                      moreLinkClick: 'popover'
                    },
                    timeGridWeek: {
                      eventMinHeight: 30,
                      slotMinTime: '06:00:00',
                      slotMaxTime: '22:00:00',
                      expandRows: true
                    },
                    listWeek: {
                      noEventsText: 'No payments scheduled'
                    }
                  }}
                />
              </Box>
            </Paper>
          )}

          {tabValue === 1 && (
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, boxShadow: 2 }}>
              {/* Filter Buttons */}
              <Box mb={2} display="flex" gap={1} flexWrap="wrap">
                <Button
                  variant={filter === 'all' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'pending' ? 'contained' : 'outlined'}
                  size="small"
                  color="warning"
                  onClick={() => setFilter('pending')}
                >
                  Pending
                </Button>
                <Button
                  variant={filter === 'paid' ? 'contained' : 'outlined'}
                  size="small"
                  color="success"
                  onClick={() => setFilter('paid')}
                >
                  Paid
                </Button>
                <Button
                  variant={filter === 'overdue' ? 'contained' : 'outlined'}
                  size="small"
                  color="error"
                  onClick={() => setFilter('overdue')}
                >
                  Overdue
                </Button>
              </Box>

              {/* Payment List */}
              <List>
                {calendarEvents
                  .filter(event => filter === 'all' || event.extendedProps.payment.status === filter)
                  .sort((a, b) => new Date(a.start as string).getTime() - new Date(b.start as string).getTime())
                  .map(event => {
                    const payment = event.extendedProps.payment;
                    return (
                      <ListItem
                        key={event.id}
                        sx={{
                          mb: 1.5,
                          backgroundColor: 'background.paper',
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: payment.categoryId.color }}>
                            <MoneyIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle1" fontWeight="medium">
                                {payment.name}
                              </Typography>
                              {payment.fromWeeklyBudget && (
                                <Chip label="Budget" size="small" color="info" />
                              )}
                              <Chip
                                label={payment.status}
                                size="small"
                                color={
                                  payment.status === 'paid' ? 'success' :
                                  payment.status === 'overdue' ? 'error' : 'warning'
                                }
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                {payment.categoryId.name} • Due: {format(parseISO(payment.dueDate), 'MMM dd, yyyy')}
                              </Typography>
                      {payment.notes && (
                        <Typography variant="caption" color="textSecondary" display="block">
                          {payment.notes}
                        </Typography>
                      )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" fontWeight="bold" sx={{ mr: 2 }}>
                              {formatCurrency(payment.amount, user?.currency || 'PEN')}
                            </Typography>
                            {!payment.fromWeeklyBudget ? (
                              <>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleOpenDialog(payment)}
                                  size="small"
                                >
                                  <EditIcon />
                                </IconButton>
                                <Select
                                  value={payment.status}
                                  onChange={(e) => handleStatusChange(payment._id, e.target.value)}
                                  size="small"
                                  sx={{ minWidth: 100 }}
                                >
                                  <MenuItem value="pending">Pending</MenuItem>
                                  <MenuItem value="paid">Paid</MenuItem>
                                  <MenuItem value="overdue">Overdue</MenuItem>
                                  <MenuItem value="cancelled">Cancelled</MenuItem>
                                </Select>
                              </>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(`/budgets/week/${payment.weeklyBudgetId}`)}
                              >
                                View Budget
                              </Button>
                            )}
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
              </List>
              {calendarEvents.length === 0 && (
                <Box p={4} textAlign="center">
                  <Typography color="textSecondary">
                    No payments scheduled for this period
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {/* Event Hover Popover */}
      <Popover
        open={Boolean(anchorEl) && Boolean(hoveredEvent)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          setHoveredEvent(null);
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
      >
        {hoveredEvent && (
          <Box p={2} maxWidth={300}>
            <Typography variant="subtitle1" fontWeight="bold">
              {hoveredEvent.title}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {hoveredEvent.extendedProps.payment.categoryId.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Due: {format(new Date(hoveredEvent.start), 'MMM dd, yyyy')}
            </Typography>
            <Box mt={1}>
              <Chip
                label={hoveredEvent.extendedProps.payment.status}
                size="small"
                color={
                  hoveredEvent.extendedProps.payment.status === 'paid' ? 'success' :
                  hoveredEvent.extendedProps.payment.status === 'overdue' ? 'error' : 'warning'
                }
              />
              {hoveredEvent.extendedProps.payment.fromWeeklyBudget && (
                <Chip label="From Budget" size="small" color="info" sx={{ ml: 1 }} />
              )}
            </Box>
            {hoveredEvent.extendedProps.payment.notes && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                {hoveredEvent.extendedProps.payment.notes}
              </Typography>
            )}
          </Box>
        )}
      </Popover>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {selectedPayment ? 'Edit Payment' : 'Create New Payment'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Payment Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              fullWidth
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">{getCurrencySymbol(user?.currency || 'PEN')}</InputAdornment>,
              }}
            />
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.categoryId}
                onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              >
                {categories.map((category: any) => (
                  <MenuItem key={category._id} value={category._id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        width={16}
                        height={16}
                        borderRadius="50%"
                        bgcolor={category.color}
                      />
                      {category.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Due Date"
                value={parseISO(formData.dueDate)}
                onChange={(date) => date && setFormData(prev => ({ ...prev, dueDate: format(date, 'yyyy-MM-dd') }))}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                />
              }
              label="Recurring Payment"
            />
            {formData.isRecurring && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Frequency</InputLabel>
                  <Select
                    value={formData.frequency}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                  >
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="biweekly">Bi-weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                    <MenuItem value="quarterly">Quarterly</MenuItem>
                    <MenuItem value="yearly">Yearly</MenuItem>
                  </Select>
                </FormControl>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="End Date (Optional)"
                    value={formData.recurringEndDate ? parseISO(formData.recurringEndDate) : null}
                    onChange={(date) => setFormData(prev => ({ ...prev, recurringEndDate: date ? format(date, 'yyyy-MM-dd') : '' }))}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </>
            )}
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.reminder.enabled}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    reminder: { ...prev.reminder, enabled: e.target.checked }
                  }))}
                />
              }
              label="Enable Reminder"
            />
            {formData.reminder.enabled && (
              <TextField
                label="Remind Days Before"
                type="number"
                value={formData.reminder.daysBefore}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  reminder: { ...prev.reminder, daysBefore: parseInt(e.target.value) || 0 }
                }))}
                fullWidth
                InputProps={{
                  inputProps: { min: 1, max: 30 }
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedPayment && !selectedPayment.fromWeeklyBudget && (
            <Button onClick={handleDelete} color="error">
              Delete
            </Button>
          )}
          <Box flex={1} />
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {selectedPayment ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentScheduleImproved;
