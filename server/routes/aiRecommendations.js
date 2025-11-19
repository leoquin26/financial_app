const express = require('express');
const router = express.Router();
const { authMiddleware: auth } = require('../middleware/auth');
const BudgetOptimizer = require('../services/budgetOptimizer');
const WeeklyBudget = require('../models/WeeklyBudget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

// Get AI-powered budget recommendations
router.get('/budget-optimization', auth, async (req, res) => {
  try {
    const currentBudget = await WeeklyBudget.getCurrentWeek(req.user._id);
    
    if (!currentBudget || currentBudget.totalBudget === 0) {
      return res.status(400).json({ 
        error: 'No active weekly budget found. Please create a budget first.' 
      });
    }

    const optimizer = new BudgetOptimizer(req.user._id);
    const recommendations = await optimizer.generateRecommendations(currentBudget);

    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Get spending insights
router.get('/spending-insights', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get spending by time of day
    const hourlySpending = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'expense',
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $hour: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get spending velocity (rate of spending over time)
    const dailySpending = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'expense',
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Calculate spending velocity
    let velocity = 0;
    if (dailySpending.length > 1) {
      const recentAvg = dailySpending.slice(0, 7).reduce((sum, d) => sum + d.total, 0) / 7;
      const olderAvg = dailySpending.slice(7, 14).reduce((sum, d) => sum + d.total, 0) / 7;
      velocity = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    }

    // Get category correlations
    const categoryPairs = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'expense',
          date: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            category: '$category.name'
          },
          amount: { $sum: '$amount' }
        }
      }
    ]);

    // Find categories that are often used together
    const correlations = [];
    const dateCategories = {};
    
    categoryPairs.forEach(pair => {
      const date = pair._id.date;
      const category = pair._id.category;
      
      if (!dateCategories[date]) {
        dateCategories[date] = [];
      }
      dateCategories[date].push(category);
    });

    // Count co-occurrences
    const coOccurrences = {};
    Object.values(dateCategories).forEach(categories => {
      for (let i = 0; i < categories.length; i++) {
        for (let j = i + 1; j < categories.length; j++) {
          const pair = [categories[i], categories[j]].sort().join(' & ');
          coOccurrences[pair] = (coOccurrences[pair] || 0) + 1;
        }
      }
    });

    // Get top correlations
    const topCorrelations = Object.entries(coOccurrences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pair, count]) => ({ categories: pair.split(' & '), occurrences: count }));

    res.json({
      hourlySpending,
      spendingVelocity: {
        percentage: velocity,
        trend: velocity > 10 ? 'increasing' : velocity < -10 ? 'decreasing' : 'stable'
      },
      categoryCorrelations: topCorrelations,
      dailyAverage: dailySpending.reduce((sum, d) => sum + d.total, 0) / dailySpending.length
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Get anomaly detection
router.get('/anomalies', auth, async (req, res) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // Get all transactions
    const transactions = await Transaction.find({
      userId: req.user._id,
      type: 'expense',
      date: { $gte: startDate }
    }).populate('categoryId');

    // Group by category
    const categoryData = {};
    transactions.forEach(trans => {
      const category = trans.categoryId.name;
      if (!categoryData[category]) {
        categoryData[category] = [];
      }
      categoryData[category].push({
        amount: trans.amount,
        date: trans.date,
        description: trans.description
      });
    });

    const anomalies = [];

    // Detect anomalies for each category
    for (const [category, data] of Object.entries(categoryData)) {
      if (data.length < 5) continue; // Need enough data

      const amounts = data.map(d => d.amount).sort((a, b) => a - b);
      const q1 = amounts[Math.floor(amounts.length * 0.25)];
      const q3 = amounts[Math.floor(amounts.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      // Find outliers
      data.forEach(trans => {
        if (trans.amount < lowerBound || trans.amount > upperBound) {
          anomalies.push({
            category,
            amount: trans.amount,
            date: trans.date,
            description: trans.description,
            type: trans.amount > upperBound ? 'unusually_high' : 'unusually_low',
            typical_range: { min: q1, max: q3 }
          });
        }
      });
    }

    // Sort by date
    anomalies.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      anomalies: anomalies.slice(0, 10), // Top 10 most recent
      summary: {
        total: anomalies.length,
        high: anomalies.filter(a => a.type === 'unusually_high').length,
        low: anomalies.filter(a => a.type === 'unusually_low').length
      }
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// Get predictive budget forecast
router.get('/forecast', auth, async (req, res) => {
  try {
    const { weeks = 4 } = req.query;
    const optimizer = new BudgetOptimizer(req.user._id);
    const analysis = await optimizer.analyzeSpendingPatterns(90);

    // Generate forecast for each category
    const forecasts = [];
    const categories = await Category.find({ 
      $or: [
        { userId: req.user._id },
        { userId: null }
      ]
    });

    for (const category of categories) {
      const pattern = analysis.categoryPatterns[category.name];
      if (!pattern || pattern.count < 5) continue;

      // Simple forecast based on trend and seasonality
      const weeklyForecast = [];
      for (let w = 0; w < weeks; w++) {
        const baseAmount = pattern.median;
        const trendAdjustment = pattern.trend * baseAmount * (w + 1);
        const variance = pattern.standardDeviation * 0.5 * (Math.random() - 0.5);
        
        weeklyForecast.push({
          week: w + 1,
          amount: Math.max(0, baseAmount + trendAdjustment + variance),
          confidence: Math.max(0.5, 1 - (w * 0.1)) // Confidence decreases with time
        });
      }

      forecasts.push({
        category: category.name,
        categoryId: category._id,
        forecast: weeklyForecast,
        trend: pattern.trend > 0.05 ? 'increasing' : pattern.trend < -0.05 ? 'decreasing' : 'stable'
      });
    }

    // Calculate total forecast
    const totalForecast = [];
    for (let w = 0; w < weeks; w++) {
      const weekTotal = forecasts.reduce((sum, cat) => 
        sum + (cat.forecast[w]?.amount || 0), 0
      );
      totalForecast.push({
        week: w + 1,
        amount: weekTotal,
        confidence: 1 - (w * 0.1)
      });
    }

    res.json({
      categoryForecasts: forecasts,
      totalForecast,
      baselineWeekly: analysis.weeklyAverage
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

module.exports = router;
