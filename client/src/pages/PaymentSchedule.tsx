import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import Popper from '@mui/material/Popper';
import Fade from '@mui/material/Fade';
import {
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/api';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const localizer = momentLocalizer(moment);

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
  start: Date;
  end: Date;
  resource: PaymentSchedule;
}

const PaymentScheduleComponent: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSchedule | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [formData, setFormData] = useState<PaymentFormData>({
    name: '',
    amount: 0,
    categoryId: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    frequency: 'once',
    notes: '',
    reminder: {
      enabled: true,
      daysBefore: 1
    },
    isRecurring: false,
    recurringEndDate: ''
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data;
    }
  });

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', selectedWeek],
    queryFn: async () => {
      const weekStart = startOfWeek(selectedWeek);
      const weekEnd = endOfWeek(selectedWeek);
      const response = await axios.get('/api/payments', {
        params: {
          from: format(weekStart, 'yyyy-MM-dd'),
          to: format(weekEnd, 'yyyy-MM-dd')
        }
      });
      return response.data;
    }
  });

  // Fetch upcoming payments
  const { data: upcomingPayments = [] } = useQuery({
    queryKey: ['upcomingPayments'],
    queryFn: async () => {
      const response = await axios.get('/api/payments?upcoming=true');
      return response.data;
    }
  });

  // Fetch weekly budgets for the selected week
  const { data: weeklyBudgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['weeklyBudgets', selectedWeek],
    queryFn: async () => {
      const weekStart = startOfWeek(selectedWeek);
      const weekEnd = endOfWeek(selectedWeek);
      
      // Adjust for timezone - set to start and end of day
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);
      
      console.log('Fetching weekly budgets for:', {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
        weekStart,
        weekEnd
      });
      
      const response = await axios.get('/api/weekly-budget/range', {
        params: {
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString()
        }
      });
      console.log('Weekly budgets response:', response.data);
      return response.data || [];
    }
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const response = await axios.post('/api/payments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      toast.success('Payment scheduled successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to schedule payment');
    }
  });

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PaymentFormData }) => {
      const response = await axios.put(`/api/payments/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      toast.success('Payment updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update payment');
    }
  });

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async ({ id, paidDate }: { id: string; paidDate?: string }) => {
      const response = await axios.post(`/api/payments/${id}/pay`, { paidDate });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Payment marked as paid');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to mark payment as paid');
    }
  });

  // Delete payment mutation
  // const deletePaymentMutation = useMutation({
  //   mutationFn: async (id: string) => {
  //     await axios.delete(`/api/payments/${id}`);
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['payments'] });
  //     queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
  //     toast.success('Payment deleted successfully');
  //   },
  //   onError: (error: any) => {
  //     toast.error(error.response?.data?.error || 'Failed to delete payment');
  //   }
  // });

  const handleOpenDialog = (payment?: PaymentSchedule | any) => {
    if (payment) {
      // Check if this is a weekly budget item
      if (payment.fromWeeklyBudget) {
        // Navigate to weekly budget page
        navigate('/weekly-budget');
        return;
      }
      
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
        recurringEndDate: payment.recurringEndDate ? format(parseISO(payment.recurringEndDate), 'yyyy-MM-dd') : ''
      });
    } else {
      setSelectedPayment(null);
      setFormData({
        name: '',
        amount: 0,
        categoryId: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        frequency: 'once',
        notes: '',
        reminder: {
          enabled: true,
          daysBefore: 1
        },
        isRecurring: false,
        recurringEndDate: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPayment(null);
  };

  const handleSubmit = () => {
    if (selectedPayment) {
      updatePaymentMutation.mutate({ id: selectedPayment._id, data: formData });
    } else {
      createPaymentMutation.mutate(formData);
    }
  };

  // Convert payments to calendar events
  // Group payments by date first
  const paymentsByDate: { [key: string]: PaymentSchedule[] } = {};
  payments.forEach((payment: PaymentSchedule) => {
    const dateKey = payment.dueDate.split('T')[0];
    if (!paymentsByDate[dateKey]) {
      paymentsByDate[dateKey] = [];
    }
    paymentsByDate[dateKey].push(payment);
  });
  
  const paymentEvents: CalendarEvent[] = [];
  Object.entries(paymentsByDate).forEach(([dateKey, datePayments]) => {
    datePayments.forEach((payment: PaymentSchedule, index: number) => {
      // Parse the date and add hours to distribute events
      const eventDate = parseISO(payment.dueDate);
      // Distribute regular payments starting at 11 AM, with better spacing
      const hour = 11 + Math.floor(index / 2); // Increment hour every 2 items
      const minutes = (index % 2) * 30; // Alternate between :00 and :30
      eventDate.setHours(hour, minutes, 0, 0);
      
      paymentEvents.push({
        id: payment._id,
        title: `💰 ${payment.name} ($${payment.amount})`,
        start: eventDate,
        end: eventDate,
        resource: payment
      });
    });
  });

  // Convert weekly budget allocations to calendar events
  const budgetEvents: CalendarEvent[] = [];
  console.log('Processing weekly budgets:', weeklyBudgets);
  
  // Group allocations by date to handle time distribution better
  const allocationsByDate: { [key: string]: any[] } = {};
  
  weeklyBudgets.forEach((budget: any) => {
    console.log('Processing budget:', budget);
    // Handle both old structure (allocations) and new structure (categories with payments)
    if (budget.categories && budget.categories.length > 0) {
      // New structure: categories with embedded payments
      budget.categories.forEach((category: any) => {
        if (category.payments && category.payments.length > 0) {
          category.payments.forEach((payment: any) => {
            if (payment.scheduledDate) {
              const dateKey = payment.scheduledDate.split('T')[0];
              if (!allocationsByDate[dateKey]) {
                allocationsByDate[dateKey] = [];
              }
              allocationsByDate[dateKey].push({
                allocation: {
                  _id: payment._id || payment.paymentScheduleId,
                  name: payment.name,
                  amount: payment.amount,
                  scheduledDate: payment.scheduledDate,
                  categoryId: category.categoryId,
                  status: payment.status,
                  paidDate: payment.paidDate
                },
                budget
              });
            }
          });
        }
      });
    } else if (budget.allocations) {
      // Old structure: allocations array
      budget.allocations.forEach((allocation: any) => {
        if (allocation.scheduledDate) {
          const dateKey = allocation.scheduledDate.split('T')[0];
          if (!allocationsByDate[dateKey]) {
            allocationsByDate[dateKey] = [];
          }
          allocationsByDate[dateKey].push({ allocation, budget });
        }
      });
    }
  });
  
  // Now create events with proper time distribution per day
  Object.entries(allocationsByDate).forEach(([dateKey, items]) => {
    items.forEach(({ allocation, budget }, index) => {
      console.log('Processing allocation:', allocation);
      // Parse the date and add hours to distribute events throughout the day
      const eventDate = parseISO(allocation.scheduledDate);
      // Distribute events between 9 AM and 5 PM based on index within the same day
      const hour = 9 + (index % 8); // This will cycle through 9-16 (9 AM to 4 PM)
      const minutes = (index % 2) * 30; // Alternate between :00 and :30
      eventDate.setHours(hour, minutes, 0, 0);
      
      const event = {
        id: `budget-${budget._id}-${allocation._id}`,
        title: `📋 ${allocation.name || allocation.categoryId.name} ($${allocation.amount})`,
        start: eventDate,
        end: eventDate,
        resource: {
            _id: allocation._id,
            name: allocation.name || allocation.categoryId.name,
            amount: allocation.amount,
            categoryId: allocation.categoryId,
            dueDate: allocation.scheduledDate,
            frequency: 'once' as const,
            status: allocation.status || 'pending' as const,
            paidDate: allocation.paidDate,
            notes: `From weekly budget: ${format(parseISO(budget.weekStartDate), 'MMM d')} - ${format(parseISO(budget.weekEndDate), 'MMM d')}`,
            reminder: { enabled: false, daysBefore: 0 },
            isRecurring: false,
            fromWeeklyBudget: true,
            weeklyBudgetId: budget._id
          }
        };
      console.log('Created budget event:', event);
      budgetEvents.push(event);
    });
  });

  // Combine all events
  const calendarEvents: CalendarEvent[] = [...paymentEvents, ...budgetEvents];

  // Calculate weekly statistics including budget allocations
  const allPayments = [...payments];
  budgetEvents.forEach(event => {
    allPayments.push(event.resource as any);
  });

  const weeklyStats = {
    total: allPayments.reduce((sum: number, p: any) => sum + p.amount, 0),
    paid: allPayments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + p.amount, 0),
    pending: allPayments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + p.amount, 0),
    overdue: allPayments.filter((p: any) => p.status === 'overdue').reduce((sum: number, p: any) => sum + p.amount, 0),
    fromBudget: budgetEvents.length
  };

  // State for hover tooltip
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  const eventStyleGetter = (event: CalendarEvent) => {
    const payment = event.resource;
    let backgroundColor = payment.categoryId.color;
    let border = '0px';
    let opacity = 0.9;
    let fontSize = '11px';
    let fontWeight = '500';
    
    if (payment.status === 'paid') {
      backgroundColor = '#4caf50';
    } else if (payment.status === 'overdue') {
      backgroundColor = '#f44336';
    }
    
    // Special styling for weekly budget items
    if ((payment as any).fromWeeklyBudget) {
      border = '2px solid ' + payment.categoryId.color;
      backgroundColor = 'white';
      opacity = 1;
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity,
        color: (payment as any).fromWeeklyBudget ? payment.categoryId.color : 'white',
        border: border,
        display: 'block',
        padding: '3px 6px',
        margin: '1px 2px',
        fontSize,
        fontWeight,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }
    };
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Payment Schedule
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Schedule Payment
        </Button>
      </Box>

      {/* Weekly Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total Scheduled
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${weeklyStats.total.toFixed(2)}
                  </Typography>
                </Box>
                <CalendarIcon color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Paid
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    ${weeklyStats.paid.toFixed(2)}
                  </Typography>
                </Box>
                <CheckIcon color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    ${weeklyStats.pending.toFixed(2)}
                  </Typography>
                </Box>
                <TimeIcon color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Overdue
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    ${weeklyStats.overdue.toFixed(2)}
                  </Typography>
                </Box>
                <WarningIcon color="error" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Weekly Budget Items Indicator */}
      {weeklyStats.fromBudget > 0 && (
        <Box mb={2}>
          <Chip
            icon={<CalendarIcon />}
            label={`${weeklyStats.fromBudget} payments from Weekly Budget`}
            color="info"
            variant="outlined"
            onClick={() => navigate('/weekly-budget')}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Calendar View" />
          <Tab label="List View" />
          <Tab label="Upcoming" />
        </Tabs>
      </Box>

      {(isLoading || loadingBudgets) ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && (
            <Paper sx={{ height: 600, p: 2 }}>
              <Box mb={1}>
                <Typography variant="caption" color="textSecondary">
                  Showing {paymentEvents.length} payments and {budgetEvents.length} weekly budget items
                </Typography>
              </Box>
              <Box sx={{
                height: '90%',
                '& .rbc-calendar': {
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                },
                '& .rbc-event': {
                  backgroundColor: 'transparent !important',
                },
                '& .rbc-event-content': {
                  lineHeight: '1.3',
                },
                '& .rbc-time-slot': {
                  minHeight: '30px',
                },
                '& .rbc-day-slot .rbc-events-container': {
                  margin: '0 2px',
                },
                '& .rbc-row-segment': {
                  padding: '1px 0',
                },
                '& .rbc-show-more': {
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  margin: '1px 2px',
                },
                '& .rbc-month-view .rbc-event': {
                  padding: '0px',
                },
                '& .rbc-day-bg + .rbc-day-bg': {
                  borderLeft: '1px solid #ddd',
                },
                '& .rbc-header': {
                  padding: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#555',
                  borderBottom: '2px solid #e0e0e0',
                },
                '& .rbc-today': {
                  backgroundColor: '#f5f5f5',
                }
              }}>
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  eventPropGetter={eventStyleGetter}
                  onSelectEvent={(event: CalendarEvent) => handleOpenDialog(event.resource)}
                  views={['day', 'week', 'month']}
                  defaultView="week"
                  onNavigate={(date: Date) => setSelectedWeek(date)}
                  messages={{
                    showMore: (count: number) => `+${count} más`
                  }}
                  min={new Date(0, 0, 0, 8, 0, 0)} // Start at 8 AM
                  max={new Date(0, 0, 0, 19, 0, 0)} // End at 7 PM
                  components={{
                    event: ({ event }: any) => (
                      <Box
                        onMouseEnter={(e) => {
                          if (hoverTimeout) clearTimeout(hoverTimeout);
                          const timeout = setTimeout(() => {
                            setAnchorEl(e.currentTarget);
                            setHoveredEvent(event);
                          }, 300); // 300ms delay
                          setHoverTimeout(timeout);
                        }}
                        onMouseLeave={() => {
                          if (hoverTimeout) {
                            clearTimeout(hoverTimeout);
                            setHoverTimeout(null);
                          }
                          setAnchorEl(null);
                          setHoveredEvent(null);
                        }}
                        sx={{ height: '100%', cursor: 'pointer' }}
                      >
                        <span>{event.title}</span>
                      </Box>
                    )
                  }}
                />
              </Box>
            </Paper>
          )}

          {tabValue === 1 && (
            <Grid container spacing={3}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                const dayDate = addDays(startOfWeek(selectedWeek), index === 6 ? 0 : index + 1);
                const dayPayments = payments.filter((p: PaymentSchedule) => 
                  isSameDay(parseISO(p.dueDate), dayDate)
                );

                return (
                  <Grid item xs={12} md={6} lg={4} key={day}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {day}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          {format(dayDate, 'MMM d, yyyy')}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        {dayPayments.length === 0 ? (
                          <Typography variant="body2" color="textSecondary">
                            No payments scheduled
                          </Typography>
                        ) : (
                          <List dense>
                            {dayPayments.map((payment: PaymentSchedule) => (
                              <ListItem key={payment._id} disablePadding>
                                <ListItemText
                                  primary={payment.name}
                                  secondary={
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Chip
                                        label={payment.categoryId.name}
                                        size="small"
                                        style={{ backgroundColor: payment.categoryId.color, color: 'white' }}
                                      />
                                      <Typography variant="body2">
                                        ${payment.amount}
                                      </Typography>
                                    </Box>
                                  }
                                />
                                <ListItemSecondaryAction>
                                  <Tooltip title="Mark as paid">
                                    <IconButton
                                      size="small"
                                      onClick={() => markPaidMutation.mutate({ id: payment._id })}
                                      disabled={payment.status === 'paid'}
                                    >
                                      <CheckIcon color={payment.status === 'paid' ? 'success' : 'inherit'} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenDialog(payment)}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                </ListItemSecondaryAction>
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {tabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Upcoming Payments (Next 7 Days)
                    </Typography>
                    <List>
                      {upcomingPayments.length === 0 ? (
                        <ListItem>
                          <ListItemText primary="No upcoming payments" />
                        </ListItem>
                      ) : (
                        upcomingPayments.map((payment: PaymentSchedule) => (
                          <ListItem key={payment._id}>
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={2}>
                                  <Typography variant="body1">
                                    {payment.name}
                                  </Typography>
                                  <Chip
                                    label={payment.categoryId.name}
                                    size="small"
                                    style={{ backgroundColor: payment.categoryId.color, color: 'white' }}
                                  />
                                  {payment.status === 'overdue' && (
                                    <Chip label="Overdue" color="error" size="small" />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="textSecondary">
                                    Due: {format(parseISO(payment.dueDate), 'MMM d, yyyy')}
                                  </Typography>
                                  {payment.notes && (
                                    <Typography variant="body2" color="textSecondary">
                                      Note: {payment.notes}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Typography variant="h6" color="primary">
                                ${payment.amount}
                              </Typography>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}

      {/* Add/Edit Payment Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedPayment ? 'Edit Payment' : 'Schedule New Payment'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Payment Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="Amount"
              type="number"
              fullWidth
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            />
            <TextField
              select
              label="Category"
              fullWidth
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            >
              {categories.map((cat: any) => (
                <MenuItem key={cat._id} value={cat._id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      width={20}
                      height={20}
                      borderRadius="50%"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                />
              }
              label="Recurring Payment"
            />
            {formData.isRecurring && (
              <>
                <TextField
                  select
                  label="Frequency"
                  fullWidth
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                >
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="biweekly">Bi-weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </TextField>
                <TextField
                  label="End Date (Optional)"
                  type="date"
                  fullWidth
                  value={formData.recurringEndDate}
                  onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}
            <TextField
              label="Notes (Optional)"
              multiline
              rows={2}
              fullWidth
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.reminder.enabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    reminder: { ...formData.reminder, enabled: e.target.checked }
                  })}
                />
              }
              label="Enable Reminder"
            />
            {formData.reminder.enabled && (
              <TextField
                label="Remind Days Before"
                type="number"
                fullWidth
                value={formData.reminder.daysBefore}
                onChange={(e) => setFormData({
                  ...formData,
                  reminder: { ...formData.reminder, daysBefore: parseInt(e.target.value) || 1 }
                })}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.name || !formData.amount || !formData.categoryId}
          >
            {selectedPayment ? 'Update' : 'Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Hover Tooltip */}
      <Popper
        open={Boolean(anchorEl && hoveredEvent)}
        anchorEl={anchorEl}
        placement="top"
        transition
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, -10],
            },
          },
          {
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
            },
          },
        ]}
        sx={{ zIndex: 2000 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={8}
              sx={{
                p: 2.5,
                minWidth: 280,
                maxWidth: 350,
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: 2,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid #f8f9fa',
                  filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
                },
              }}
            >
              {hoveredEvent && (
                <>
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    mb={2}
                    sx={{
                      pb: 1.5,
                      borderBottom: '2px solid',
                      borderColor: hoveredEvent.resource.categoryId.color,
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '12px',
                        backgroundColor: hoveredEvent.resource.categoryId.color + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 1.5,
                      }}
                    >
                      {hoveredEvent.resource.fromWeeklyBudget ? '📋' : '💰'}
                    </Box>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.1rem', mb: 0.5 }}>
                        {hoveredEvent.resource.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {hoveredEvent.resource.fromWeeklyBudget ? 'Weekly Budget Allocation' : 'Scheduled Payment'}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          p: 1.5,
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          borderRadius: 1,
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="caption" color="textSecondary" display="block">
                          Amount
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          ${hoveredEvent.resource.amount}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          p: 1.5,
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          borderRadius: 1,
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" color="textSecondary" display="block" mb={0.5}>
                          Status
                        </Typography>
                        <Chip
                          label={hoveredEvent.resource.status}
                          size="small"
                          color={
                            hoveredEvent.resource.status === 'paid'
                              ? 'success'
                              : hoveredEvent.resource.status === 'overdue'
                              ? 'error'
                              : 'warning'
                          }
                          sx={{ 
                            height: 24,
                            fontWeight: 'bold',
                            fontSize: '0.75rem'
                          }}
                        />
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: hoveredEvent.resource.categoryId.color,
                          }}
                        />
                        <Box>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Category
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {hoveredEvent.resource.categoryId.name}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Box>
                        <Typography variant="caption" color="textSecondary" display="block">
                          Due Date
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {format(parseISO(hoveredEvent.resource.dueDate), 'MMM d, yyyy')}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {hoveredEvent.resource.frequency !== 'once' && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="textSecondary">
                          Frequency:
                        </Typography>
                        <Typography variant="body2">
                          {hoveredEvent.resource.frequency}
                        </Typography>
                      </Grid>
                    )}
                    
                    {hoveredEvent.resource.notes && (
                      <Grid item xs={12}>
                        <Box
                          sx={{
                            mt: 1,
                            p: 1.5,
                            backgroundColor: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: 1,
                            borderLeft: '3px solid',
                            borderLeftColor: hoveredEvent.resource.categoryId.color,
                          }}
                        >
                          <Typography variant="caption" color="textSecondary" display="block" mb={0.5}>
                            Notes
                          </Typography>
                          <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem' }}>
                            {hoveredEvent.resource.notes}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}
            </Paper>
          </Fade>
        )}
      </Popper>
    </Container>
  );
};

export default PaymentScheduleComponent;
