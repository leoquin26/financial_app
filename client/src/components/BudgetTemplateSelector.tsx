import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  AutoFixHigh as SmartIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Info as InfoIcon,
  Category as CategoryIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface BudgetTemplateSelectorProps {
  currentWeekStart: Date;
  onSelectMode: (mode: 'template' | 'smart' | 'manual', templateId?: string) => void;
}

interface PreviousBudget {
  _id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalBudget: number;
  categories: Array<{
    categoryId: any;
    allocation: number;
    payments: Array<{
      name: string;
      amount: number;
      status: string;
    }>;
  }>;
}

interface BudgetInsights {
  averageWeeklySpending: number;
  topCategories: Array<{
    categoryId: string;
    name: string;
    average: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  savingsRate: number;
  recommendations: string[];
}

const BudgetTemplateSelector: React.FC<BudgetTemplateSelectorProps> = ({
  currentWeekStart,
  onSelectMode,
}) => {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  // Fetch previous budgets
  const { data: previousBudgets, isLoading: loadingBudgets } = useQuery({
    queryKey: ['previousBudgets'],
    queryFn: async () => {
      const response = await axios.get('/api/weekly-budget/history', {
        params: { limit: 4 },
      });
      return response.data as PreviousBudget[];
    },
  });

  // Fetch AI insights
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['budgetInsights'],
    queryFn: async () => {
      const response = await axios.get('/api/weekly-budget/insights');
      return response.data as BudgetInsights;
    },
  });

  const lastWeekBudget = previousBudgets?.[0];
  const hasHistory = previousBudgets && previousBudgets.length > 0;

  const handleSelectTemplate = (budgetId: string) => {
    setSelectedMode('template');
    onSelectMode('template', budgetId);
  };

  const handleSelectSmart = () => {
    setSelectedMode('smart');
    onSelectMode('smart');
  };

  const handleSelectManual = () => {
    setSelectedMode('manual');
    onSelectMode('manual');
  };

  if (loadingBudgets || loadingInsights) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        How would you like to create your budget?
      </Typography>
      <Typography variant="body2" color="textSecondary" mb={3}>
        Week of {format(currentWeekStart, 'MMM d')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
      </Typography>

      <Grid container spacing={3}>
        {/* Copy Last Week Option */}
        {hasHistory && (
          <Grid item xs={12} md={4}>
            <Card 
              sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: selectedMode === 'template' ? '2px solid primary.main' : '1px solid',
                borderColor: selectedMode === 'template' ? 'primary.main' : 'divider',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 3,
                },
              }}
              onClick={() => handleSelectTemplate(lastWeekBudget!._id)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CopyIcon color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    Copy Last Week
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Start with your previous week's budget and make adjustments
                </Typography>

                {lastWeekBudget && (
                  <Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="caption" color="textSecondary">
                        Total Budget
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        ${lastWeekBudget.totalBudget}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" mb={2}>
                      <Typography variant="caption" color="textSecondary">
                        Categories
                      </Typography>
                      <Typography variant="body2">
                        {lastWeekBudget.categories.length}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 1 }} />
                    
                    <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                      {lastWeekBudget.categories.slice(0, 3).map((cat, index) => (
                        <ListItem key={index} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 30 }}>
                            <CategoryIcon sx={{ fontSize: 16, color: cat.categoryId.color }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={cat.categoryId.name}
                            secondary={`$${cat.allocation}`}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Smart Suggestions Option */}
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              cursor: hasHistory ? 'pointer' : 'default',
              opacity: hasHistory ? 1 : 0.5,
              transition: 'all 0.3s ease',
              border: selectedMode === 'smart' ? '2px solid primary.main' : '1px solid',
              borderColor: selectedMode === 'smart' ? 'primary.main' : 'divider',
              '&:hover': hasHistory ? {
                transform: 'translateY(-4px)',
                boxShadow: 3,
              } : {},
            }}
            onClick={hasHistory ? handleSelectSmart : undefined}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <SmartIcon color="secondary" />
                <Typography variant="h6" fontWeight="bold">
                  Smart Setup
                </Typography>
                {!hasHistory && (
                  <Chip label="Needs History" size="small" color="warning" />
                )}
              </Box>
              
              <Typography variant="body2" color="textSecondary" mb={2}>
                AI-powered recommendations based on your spending patterns
              </Typography>

              {insights && hasHistory && (
                <Box>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="caption">
                      Average: ${insights.averageWeeklySpending}/week
                    </Typography>
                  </Box>

                  <Typography variant="subtitle2" mb={1}>
                    Top Categories:
                  </Typography>
                  
                  {insights.topCategories.slice(0, 3).map((cat, index) => (
                    <Box key={index} mb={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">{cat.name}</Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography variant="body2">${cat.average}</Typography>
                          {cat.trend === 'up' && <TrendingUpIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                          {cat.trend === 'down' && <TrendingDownIcon sx={{ fontSize: 14, color: 'success.main' }} />}
                        </Box>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={(cat.average / insights.averageWeeklySpending) * 100}
                        sx={{ height: 4, mt: 0.5 }}
                      />
                    </Box>
                  ))}

                  {insights.recommendations.length > 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="caption">
                        {insights.recommendations[0]}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}

              {!hasHistory && (
                <Alert severity="info">
                  Create a few weekly budgets to unlock AI-powered suggestions
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Manual Setup Option */}
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: selectedMode === 'manual' ? '2px solid primary.main' : '1px solid',
              borderColor: selectedMode === 'manual' ? 'primary.main' : 'divider',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 3,
              },
            }}
            onClick={handleSelectManual}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <EditIcon color="action" />
                <Typography variant="h6" fontWeight="bold">
                  Start Fresh
                </Typography>
              </Box>
              
              <Typography variant="body2" color="textSecondary" mb={3}>
                Create a custom budget from scratch
              </Typography>

              <Box>
                <Typography variant="subtitle2" mb={2}>
                  Perfect for:
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 30 }}>
                      <MoneyIcon sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Unusual weeks"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 30 }}>
                      <CalendarIcon sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Special occasions"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 30 }}>
                      <InfoIcon sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="First-time setup"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Previous Budgets Browser */}
      {hasHistory && selectedMode === 'template' && previousBudgets.length > 1 && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>
            Or choose from previous budgets:
          </Typography>
          <Grid container spacing={2}>
            {previousBudgets.slice(1).map((budget) => (
              <Grid item xs={12} sm={6} md={4} key={budget._id}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 },
                  }}
                  onClick={() => handleSelectTemplate(budget._id)}
                >
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {format(new Date(budget.weekStartDate), 'MMM d')} - 
                      {format(new Date(budget.weekEndDate), 'MMM d')}
                    </Typography>
                    <Typography variant="h6">${budget.totalBudget}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {budget.categories.length} categories
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default BudgetTemplateSelector;
