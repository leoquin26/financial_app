const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const WeeklyBudget = require('../models/WeeklyBudget');
const PaymentSchedule = require('../models/PaymentSchedule');

class BudgetOptimizer {
  constructor(userId) {
    this.userId = userId;
  }

  // Analyze spending patterns
  async analyzeSpendingPatterns(days = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await Transaction.find({
      userId: this.userId,
      type: 'expense',
      date: { $gte: startDate }
    }).populate('categoryId');

    // Group by category
    const categoryPatterns = {};
    const dailySpending = {};

    transactions.forEach(trans => {
      const category = trans.categoryId.name;
      const dateKey = trans.date.toISOString().split('T')[0];
      
      // Category patterns
      if (!categoryPatterns[category]) {
        categoryPatterns[category] = {
          total: 0,
          count: 0,
          amounts: [],
          dates: [],
          weekday: Array(7).fill(0),
          monthly: Array(12).fill(0)
        };
      }
      
      categoryPatterns[category].total += trans.amount;
      categoryPatterns[category].count += 1;
      categoryPatterns[category].amounts.push(trans.amount);
      categoryPatterns[category].dates.push(trans.date);
      categoryPatterns[category].weekday[trans.date.getDay()] += trans.amount;
      categoryPatterns[category].monthly[trans.date.getMonth()] += trans.amount;
      
      // Daily spending
      if (!dailySpending[dateKey]) {
        dailySpending[dateKey] = 0;
      }
      dailySpending[dateKey] += trans.amount;
    });

    // Calculate statistics for each category
    const patterns = {};
    for (const [category, data] of Object.entries(categoryPatterns)) {
      const amounts = data.amounts.sort((a, b) => a - b);
      const avg = data.total / data.count;
      const median = amounts[Math.floor(amounts.length / 2)] || 0;
      const q1 = amounts[Math.floor(amounts.length * 0.25)] || 0;
      const q3 = amounts[Math.floor(amounts.length * 0.75)] || 0;
      
      // Find peak spending days
      const peakDays = data.weekday
        .map((amount, day) => ({ day, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 2)
        .map(d => d.day);
      
      // Find peak spending months
      const peakMonths = data.monthly
        .map((amount, month) => ({ month, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map(d => d.month);

      patterns[category] = {
        average: avg,
        median: median,
        total: data.total,
        count: data.count,
        q1: q1,
        q3: q3,
        iqr: q3 - q1,
        standardDeviation: this.calculateStdDev(amounts, avg),
        peakDays: peakDays,
        peakMonths: peakMonths,
        trend: this.calculateTrend(data.dates, data.amounts)
      };
    }

    return {
      categoryPatterns: patterns,
      dailyAverage: Object.values(dailySpending).reduce((a, b) => a + b, 0) / Object.keys(dailySpending).length,
      weeklyAverage: (Object.values(dailySpending).reduce((a, b) => a + b, 0) / Object.keys(dailySpending).length) * 7
    };
  }

  // Generate optimization recommendations
  async generateRecommendations(currentBudget) {
    const analysis = await this.analyzeSpendingPatterns();
    const recommendations = [];
    const optimizations = [];
    let totalSavingsPotential = 0;

    // Analyze each category
    for (const allocation of currentBudget.allocations) {
      const category = await Category.findById(allocation.categoryId);
      const pattern = analysis.categoryPatterns[category.name];
      
      if (!pattern) continue;

      // Check for overallocation
      if (allocation.amount > pattern.q3 * 1.2) {
        const savings = allocation.amount - pattern.q3;
        totalSavingsPotential += savings;
        
        recommendations.push({
          type: 'overallocation',
          category: category.name,
          message: `You've allocated $${allocation.amount} to ${category.name}, but typically spend only $${pattern.q3.toFixed(2)}. Consider reducing by $${savings.toFixed(2)}.`,
          savingsPotential: savings,
          suggestedAmount: pattern.q3
        });
      }

      // Check for underallocation
      if (allocation.amount < pattern.median * 0.9) {
        recommendations.push({
          type: 'underallocation',
          category: category.name,
          message: `You've allocated $${allocation.amount} to ${category.name}, but typically spend $${pattern.median.toFixed(2)}. Consider increasing allocation.`,
          suggestedAmount: pattern.median
        });
      }

      // Check for high variance spending
      if (pattern.standardDeviation > pattern.average * 0.5) {
        recommendations.push({
          type: 'high_variance',
          category: category.name,
          message: `Your ${category.name} spending varies significantly. Consider setting aside an emergency buffer of $${(pattern.standardDeviation).toFixed(2)}.`,
          bufferAmount: pattern.standardDeviation
        });
      }

      // Check spending trends
      if (pattern.trend > 0.1) {
        recommendations.push({
          type: 'increasing_trend',
          category: category.name,
          message: `Your ${category.name} spending has been increasing. Current trend suggests ${(pattern.trend * 100).toFixed(0)}% monthly growth.`,
          trend: pattern.trend
        });
      }
    }

    // Check for missing categories
    const allocatedCategories = new Set(
      currentBudget.allocations.map(a => a.categoryId.toString())
    );
    
    const allCategories = await Category.find({ userId: this.userId });
    for (const category of allCategories) {
      if (!allocatedCategories.has(category._id.toString())) {
        const pattern = analysis.categoryPatterns[category.name];
        if (pattern && pattern.count > 5) {
          recommendations.push({
            type: 'missing_category',
            category: category.name,
            message: `You regularly spend on ${category.name} (avg: $${pattern.average.toFixed(2)}) but haven't allocated budget for it.`,
            suggestedAmount: pattern.median
          });
        }
      }
    }

    // Generate optimized budget
    const optimizedAllocations = await this.generateOptimizedAllocations(
      currentBudget.totalBudget,
      analysis
    );

    // Weekly pattern insights
    const weeklyInsights = this.generateWeeklyInsights(analysis);

    return {
      recommendations,
      totalSavingsPotential,
      optimizedAllocations,
      weeklyInsights,
      analysis: {
        weeklyAverage: analysis.weeklyAverage,
        dailyAverage: analysis.dailyAverage
      }
    };
  }

  // Generate optimized budget allocations
  async generateOptimizedAllocations(totalBudget, analysis) {
    const categories = await Category.find({ userId: this.userId });
    const allocations = [];
    let remainingBudget = totalBudget;

    // First, allocate for scheduled payments
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const scheduledPayments = await PaymentSchedule.find({
      userId: this.userId,
      dueDate: { $gte: weekStart, $lte: weekEnd },
      status: { $in: ['pending'] }
    });

    const scheduledByCategory = {};
    scheduledPayments.forEach(payment => {
      const catId = payment.categoryId.toString();
      if (!scheduledByCategory[catId]) {
        scheduledByCategory[catId] = 0;
      }
      scheduledByCategory[catId] += payment.amount;
    });

    // Allocate for scheduled payments first
    for (const [categoryId, amount] of Object.entries(scheduledByCategory)) {
      const category = categories.find(c => c._id.toString() === categoryId);
      if (category) {
        allocations.push({
          categoryId: categoryId,
          categoryName: category.name,
          amount: amount,
          type: 'scheduled',
          confidence: 1.0
        });
        remainingBudget -= amount;
      }
    }

    // Then allocate based on historical patterns
    const sortedCategories = [];
    for (const category of categories) {
      const pattern = analysis.categoryPatterns[category.name];
      if (pattern && !scheduledByCategory[category._id.toString()]) {
        sortedCategories.push({
          category,
          pattern,
          priority: pattern.count / 30 // Frequency score
        });
      }
    }

    // Sort by priority (frequency)
    sortedCategories.sort((a, b) => b.priority - a.priority);

    // Allocate remaining budget
    for (const { category, pattern } of sortedCategories) {
      if (remainingBudget <= 0) break;

      // Use median as base, adjusted by confidence
      const confidence = Math.min(pattern.count / 10, 1); // Higher confidence with more data
      const suggestedAmount = pattern.median * confidence + pattern.q1 * (1 - confidence);
      const allocation = Math.min(suggestedAmount, remainingBudget);

      if (allocation > 0) {
        allocations.push({
          categoryId: category._id.toString(),
          categoryName: category.name,
          amount: allocation,
          type: 'historical',
          confidence: confidence
        });
        remainingBudget -= allocation;
      }
    }

    return {
      allocations,
      remainingBudget,
      utilizationRate: ((totalBudget - remainingBudget) / totalBudget) * 100
    };
  }

  // Generate weekly spending insights
  generateWeeklyInsights(analysis) {
    const insights = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Find peak spending days across all categories
    const weeklyTotals = Array(7).fill(0);
    for (const pattern of Object.values(analysis.categoryPatterns)) {
      pattern.weekday.forEach((amount, day) => {
        weeklyTotals[day] += amount;
      });
    }

    const avgDailySpending = weeklyTotals.reduce((a, b) => a + b, 0) / 7;
    const peakDays = weeklyTotals
      .map((amount, day) => ({ day, amount, name: dayNames[day] }))
      .filter(d => d.amount > avgDailySpending * 1.2)
      .sort((a, b) => b.amount - a.amount);

    if (peakDays.length > 0) {
      insights.push({
        type: 'peak_days',
        message: `Your highest spending days are ${peakDays.map(d => d.name).join(' and ')}.`,
        data: peakDays
      });
    }

    // Find low spending days
    const lowDays = weeklyTotals
      .map((amount, day) => ({ day, amount, name: dayNames[day] }))
      .filter(d => d.amount < avgDailySpending * 0.8)
      .sort((a, b) => a.amount - b.amount);

    if (lowDays.length > 0) {
      insights.push({
        type: 'low_days',
        message: `You tend to spend less on ${lowDays.map(d => d.name).join(' and ')}.`,
        data: lowDays
      });
    }

    // Weekend vs weekday spending
    const weekdayTotal = weeklyTotals.slice(1, 6).reduce((a, b) => a + b, 0);
    const weekendTotal = weeklyTotals[0] + weeklyTotals[6];
    const weekdayAvg = weekdayTotal / 5;
    const weekendAvg = weekendTotal / 2;

    if (weekendAvg > weekdayAvg * 1.3) {
      insights.push({
        type: 'weekend_spending',
        message: `Your weekend spending is ${((weekendAvg / weekdayAvg - 1) * 100).toFixed(0)}% higher than weekdays.`,
        weekdayAvg,
        weekendAvg
      });
    }

    return insights;
  }

  // Helper functions
  calculateStdDev(values, mean) {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  calculateTrend(dates, amounts) {
    if (dates.length < 3) return 0;

    // Simple linear regression
    const n = dates.length;
    const x = dates.map((d, i) => i);
    const y = amounts;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;

    // Return trend as percentage of average
    return avgY > 0 ? slope / avgY : 0;
  }
}

module.exports = BudgetOptimizer;
