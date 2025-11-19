import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Paper,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  Lightbulb as InsightIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from '../config/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BudgetOptimization {
  recommendations: Array<{
    type: string;
    category: string;
    message: string;
    savingsPotential?: number;
    suggestedAmount?: number;
  }>;
  totalSavingsPotential: number;
  optimizedAllocations: {
    allocations: Array<{
      categoryId: string;
      categoryName: string;
      amount: number;
      type: string;
      confidence: number;
    }>;
    utilizationRate: number;
  };
  weeklyInsights: Array<{
    type: string;
    message: string;
    data?: any;
  }>;
}

interface SpendingInsights {
  spendingVelocity: {
    percentage: number;
    trend: string;
  };
  hourlySpending: Array<{
    _id: number;
    total: number;
    count: number;
  }>;
  categoryCorrelations: Array<{
    categories: string[];
    occurrences: number;
  }>;
}

interface Anomaly {
  category: string;
  amount: number;
  date: string;
  description: string;
  type: string;
  typical_range: {
    min: number;
    max: number;
  };
}

const AIInsights: React.FC = () => {

  // Fetch budget optimization
  const { data: optimization, isLoading: optimizationLoading } = useQuery({
    queryKey: ['ai', 'budget-optimization'],
    queryFn: async () => {
      const response = await axios.get('/api/ai/budget-optimization');
      return response.data as BudgetOptimization;
    },
    retry: false
  });

  // Fetch spending insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['ai', 'spending-insights'],
    queryFn: async () => {
      const response = await axios.get('/api/ai/spending-insights');
      return response.data as SpendingInsights;
    }
  });

  // Fetch anomalies
  const { data: anomalies, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['ai', 'anomalies'],
    queryFn: async () => {
      const response = await axios.get('/api/ai/anomalies');
      return response.data;
    }
  });

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'overallocation':
        return <TrendingDownIcon color="warning" />;
      case 'underallocation':
        return <TrendingUpIcon color="info" />;
      case 'high_variance':
        return <WarningIcon color="error" />;
      case 'missing_category':
        return <InsightIcon color="primary" />;
      default:
        return <InsightIcon />;
    }
  };

  const getVelocityColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'error.main';
      case 'decreasing':
        return 'success.main';
      default:
        return 'text.secondary';
    }
  };

  if (optimizationLoading || insightsLoading || anomaliesLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <PsychologyIcon color="primary" />
        <Typography variant="h6">AI-Powered Insights</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Quick Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Potential Savings
                </Typography>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  ${optimization?.totalSavingsPotential?.toFixed(2) || '0.00'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Spending Velocity
                </Typography>
                <Typography 
                  variant="h5" 
                  color={getVelocityColor(insights?.spendingVelocity?.trend || 'stable')}
                  fontWeight="bold"
                >
                  {insights?.spendingVelocity?.percentage?.toFixed(0) || '0'}%
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Anomalies Detected
                </Typography>
                <Typography variant="h5" color="warning.main" fontWeight="bold">
                  {anomalies?.summary?.total || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Budget Efficiency
                </Typography>
                <Typography variant="h5" color="primary" fontWeight="bold">
                  {optimization?.optimizedAllocations?.utilizationRate?.toFixed(0) || '0'}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Budget Recommendations */}
        {optimization?.recommendations && optimization.recommendations.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Budget Optimization Recommendations
                </Typography>
                <List>
                  {optimization.recommendations.map((rec, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        {getRecommendationIcon(rec.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={rec.message}
                        secondary={
                          rec.savingsPotential && (
                            <Chip
                              label={`Save $${rec.savingsPotential.toFixed(2)}`}
                              size="small"
                              color="success"
                              sx={{ mt: 1 }}
                            />
                          )
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Spending Patterns */}
        {insights?.hourlySpending && insights.hourlySpending.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Spending by Hour of Day
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={insights.hourlySpending}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Category Correlations */}
        {insights?.categoryCorrelations && insights.categoryCorrelations.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Categories Often Used Together
                </Typography>
                <List dense>
                  {insights.categoryCorrelations.map((corr, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={corr.categories.join(' + ')}
                        secondary={`${corr.occurrences} times`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Weekly Insights */}
        {optimization?.weeklyInsights && optimization.weeklyInsights.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weekly Spending Patterns
                </Typography>
                {optimization.weeklyInsights.map((insight, index) => (
                  <Alert key={index} severity="info" sx={{ mb: 1 }}>
                    {insight.message}
                  </Alert>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Anomalies */}
        {anomalies?.anomalies && anomalies.anomalies.length > 0 && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <WarningIcon color="warning" />
                  <Typography variant="h6">
                    Recent Anomalies ({anomalies.summary.total})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {anomalies.anomalies.slice(0, 5).map((anomaly: Anomaly, index: number) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1">
                              {anomaly.category}
                            </Typography>
                            <Chip
                              label={anomaly.type === 'unusually_high' ? 'High' : 'Low'}
                              size="small"
                              color={anomaly.type === 'unusually_high' ? 'error' : 'warning'}
                            />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2">
                              ${anomaly.amount.toFixed(2)} - {anomaly.description}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Typical range: ${anomaly.typical_range.min.toFixed(2)} - ${anomaly.typical_range.max.toFixed(2)}
                            </Typography>
                          </>
                        }
                      />
                      <Typography variant="caption" color="textSecondary">
                        {new Date(anomaly.date).toLocaleDateString()}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Optimized Allocations */}
        {optimization?.optimizedAllocations && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI-Optimized Budget Allocation
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Based on your spending patterns and scheduled payments
                </Typography>
                <List>
                  {optimization.optimizedAllocations.allocations.map((alloc, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={alloc.categoryName}
                        secondary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip
                              label={alloc.type}
                              size="small"
                              color={alloc.type === 'scheduled' ? 'primary' : 'default'}
                            />
                            <LinearProgress
                              variant="determinate"
                              value={alloc.confidence * 100}
                              sx={{ width: 100, height: 6 }}
                            />
                            <Typography variant="caption">
                              {(alloc.confidence * 100).toFixed(0)}% confidence
                            </Typography>
                          </Box>
                        }
                      />
                      <Typography variant="h6" color="primary">
                        ${alloc.amount.toFixed(2)}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AIInsights;
