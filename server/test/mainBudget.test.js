const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index');
const MainBudget = require('../models/MainBudget');
const WeeklyBudget = require('../models/WeeklyBudget');
const User = require('../models/User');
const Category = require('../models/Category');
const jwt = require('jsonwebtoken');

let mongoServer;
let authToken;
let testUser;
let testCategories = [];

// Test data
const testMainBudget = {
  name: 'Test November 2024 Budget',
  description: 'Test budget for main budget system',
  periodType: 'monthly',
  totalBudget: 3000,
  categories: [],
  settings: {
    autoCreateWeekly: true,
    weeklyBudgetAmount: 750,
    rolloverUnspent: false,
    shareWithHousehold: false,
    notifyOnWeekStart: true,
    notifyOnOverspend: true,
    allowFlexibleAllocations: true
  }
};

describe('Main Budget System Tests', () => {
  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    
    // Generate auth token
    authToken = jwt.sign(
      { _id: testUser._id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    // Create test categories
    const categoryData = [
      { name: 'Food', color: '#FF5722', icon: '🍔', userId: testUser._id },
      { name: 'Transport', color: '#4A90E2', icon: '🚗', userId: testUser._id },
      { name: 'Entertainment', color: '#9C27B0', icon: '🎮', userId: testUser._id }
    ];
    
    testCategories = await Category.insertMany(categoryData);
    
    // Update test budget with categories
    testMainBudget.categories = testCategories.slice(0, 2).map(cat => ({
      categoryId: cat._id.toString(),
      defaultAllocation: 500,
      percentage: 16.67
    }));
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    // Clean up before each test
    await MainBudget.deleteMany({});
    await WeeklyBudget.deleteMany({});
  });
  
  describe('POST /api/main-budgets', () => {
    it('should create a new main budget', async () => {
      const response = await request(app)
        .post('/api/main-budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testMainBudget);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(testMainBudget.name);
      expect(response.body.totalBudget).toBe(testMainBudget.totalBudget);
      expect(response.body.period.type).toBe('monthly');
      expect(response.body.weeklyBudgets).toHaveLength(4); // Monthly should have 4 weeks
      expect(response.body.status).toBe('active');
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/main-budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
    
    it('should create weekly budget automatically if enabled', async () => {
      const response = await request(app)
        .post('/api/main-budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testMainBudget);
      
      expect(response.status).toBe(201);
      
      // Check if first weekly budget was created
      const firstWeek = response.body.weeklyBudgets[0];
      expect(firstWeek.budgetId).toBeDefined();
      expect(firstWeek.status).toBe('active');
      
      // Verify weekly budget in database
      const weeklyBudget = await WeeklyBudget.findById(firstWeek.budgetId);
      expect(weeklyBudget).toBeTruthy();
      expect(weeklyBudget.parentBudgetId.toString()).toBe(response.body._id);
      expect(weeklyBudget.weekNumber).toBe(1);
    });
    
    it('should handle custom period dates', async () => {
      const customBudget = {
        ...testMainBudget,
        periodType: 'custom',
        customStartDate: new Date('2024-11-01'),
        customEndDate: new Date('2024-11-15')
      };
      
      const response = await request(app)
        .post('/api/main-budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(customBudget);
      
      expect(response.status).toBe(201);
      expect(response.body.period.type).toBe('custom');
      expect(response.body.weeklyBudgets).toHaveLength(2); // 15 days = 2 weeks
    });
  });
  
  describe('GET /api/main-budgets', () => {
    beforeEach(async () => {
      // Create test budgets
      await MainBudget.create([
        {
          ...testMainBudget,
          userId: testUser._id,
          period: {
            type: 'monthly',
            startDate: new Date('2024-11-01'),
            endDate: new Date('2024-11-30')
          },
          status: 'active'
        },
        {
          ...testMainBudget,
          name: 'Q4 2024 Budget',
          userId: testUser._id,
          period: {
            type: 'quarterly',
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-12-31')
          },
          status: 'draft'
        }
      ]);
    });
    
    it('should list all user budgets', async () => {
      const response = await request(app)
        .get('/api/main-budgets')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
    
    it('should filter by period type', async () => {
      const response = await request(app)
        .get('/api/main-budgets?period=monthly')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].period.type).toBe('monthly');
    });
    
    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/main-budgets?status=active')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('active');
    });
  });
  
  describe('POST /api/main-budgets/:id/weekly/:weekNumber', () => {
    let mainBudget;
    
    beforeEach(async () => {
      mainBudget = await MainBudget.create({
        ...testMainBudget,
        userId: testUser._id,
        period: {
          type: 'monthly',
          startDate: new Date('2024-11-01'),
          endDate: new Date('2024-11-30')
        },
        weeklyBudgets: [
          {
            weekNumber: 1,
            startDate: new Date('2024-11-01'),
            endDate: new Date('2024-11-07'),
            allocatedAmount: 750,
            status: 'pending'
          },
          {
            weekNumber: 2,
            startDate: new Date('2024-11-08'),
            endDate: new Date('2024-11-14'),
            allocatedAmount: 750,
            status: 'pending'
          }
        ]
      });
    });
    
    it('should create weekly budget for specific week', async () => {
      const response = await request(app)
        .post(`/api/main-budgets/${mainBudget._id}/weekly/1`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(201);
      expect(response.body.parentBudgetId).toBe(mainBudget._id.toString());
      expect(response.body.weekNumber).toBe(1);
      expect(response.body.totalBudget).toBe(750);
      
      // Verify main budget was updated
      const updatedMain = await MainBudget.findById(mainBudget._id);
      expect(updatedMain.weeklyBudgets[0].budgetId).toBeDefined();
      expect(updatedMain.weeklyBudgets[0].status).toBe('active');
    });
    
    it('should return existing weekly budget if already created', async () => {
      // Create first
      const createResponse = await request(app)
        .post(`/api/main-budgets/${mainBudget._id}/weekly/1`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const weeklyBudgetId = createResponse.body._id;
      
      // Try to create again
      const response = await request(app)
        .post(`/api/main-budgets/${mainBudget._id}/weekly/1`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body._id).toBe(weeklyBudgetId);
    });
    
    it('should inherit categories from main budget', async () => {
      const response = await request(app)
        .post(`/api/main-budgets/${mainBudget._id}/weekly/1`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(201);
      expect(response.body.categories).toHaveLength(2);
      expect(response.body.categories[0].allocation).toBe(125); // 500/4 weeks
    });
  });
  
  describe('GET /api/main-budgets/:id/summary', () => {
    let mainBudget;
    let weeklyBudgets = [];
    
    beforeEach(async () => {
      mainBudget = await MainBudget.create({
        ...testMainBudget,
        userId: testUser._id,
        period: {
          type: 'monthly',
          startDate: new Date('2024-11-01'),
          endDate: new Date('2024-11-30')
        }
      });
      
      // Create weekly budgets with spending data
      for (let i = 0; i < 2; i++) {
        const weeklyBudget = await WeeklyBudget.create({
          userId: testUser._id,
          parentBudgetId: mainBudget._id,
          weekNumber: i + 1,
          weekStartDate: new Date(`2024-11-${(i * 7) + 1}`),
          weekEndDate: new Date(`2024-11-${(i * 7) + 7}`),
          totalBudget: 750,
          categories: testCategories.slice(0, 2).map(cat => ({
            categoryId: cat._id,
            allocation: 125,
            payments: [
              {
                name: `Payment ${i + 1}`,
                amount: 50,
                scheduledDate: new Date(`2024-11-${(i * 7) + 3}`),
                status: i === 0 ? 'paid' : 'pending'
              }
            ]
          }))
        });
        
        weeklyBudgets.push(weeklyBudget);
        
        // Update main budget reference
        mainBudget.weeklyBudgets.push({
          weekNumber: i + 1,
          budgetId: weeklyBudget._id,
          startDate: weeklyBudget.weekStartDate,
          endDate: weeklyBudget.weekEndDate,
          allocatedAmount: 750,
          status: i === 0 ? 'completed' : 'active'
        });
      }
      
      await mainBudget.save();
    });
    
    it('should return comprehensive budget summary', async () => {
      const response = await request(app)
        .get(`/api/main-budgets/${mainBudget._id}/summary`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      
      const summary = response.body;
      
      // Overview checks
      expect(summary.overview.totalBudget).toBe(3000);
      expect(summary.overview.totalSpent).toBe(100); // 2 categories * 50 paid
      expect(summary.overview.totalRemaining).toBe(2900);
      expect(summary.overview.progressPercentage).toBe(3); // 100/3000
      expect(summary.overview.weeksCompleted).toBe(1);
      expect(summary.overview.weeksTotal).toBeGreaterThan(0);
      
      // Category breakdown
      expect(summary.categoryBreakdown).toHaveLength(2);
      expect(summary.categoryBreakdown[0].spent).toBe(50);
      
      // Weekly progress
      expect(summary.weeklyProgress).toHaveLength(2);
      expect(summary.weeklyProgress[0].spent).toBe(100);
      expect(summary.weeklyProgress[0].status).toBe('completed');
      
      // Trends
      expect(summary.trends.averageWeeklySpend).toBe(100);
      expect(summary.trends.onTrack).toBe(true);
    });
  });
  
  describe('Integration Tests', () => {
    it('should handle full budget lifecycle', async () => {
      // 1. Create main budget
      const createResponse = await request(app)
        .post('/api/main-budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testMainBudget);
      
      expect(createResponse.status).toBe(201);
      const mainBudgetId = createResponse.body._id;
      
      // 2. Verify weekly budget was auto-created
      expect(createResponse.body.weeklyBudgets[0].budgetId).toBeDefined();
      
      // 3. Get the weekly budget
      const weeklyResponse = await request(app)
        .get(`/api/weekly-budget/${createResponse.body.weeklyBudgets[0].budgetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(weeklyResponse.status).toBe(200);
      expect(weeklyResponse.body.parentBudgetId).toBe(mainBudgetId);
      
      // 4. Update main budget status
      const statusResponse = await request(app)
        .patch(`/api/main-budgets/${mainBudgetId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' });
      
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.budget.status).toBe('completed');
      
      // 5. Get summary
      const summaryResponse = await request(app)
        .get(`/api/main-budgets/${mainBudgetId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(summaryResponse.status).toBe(200);
      expect(summaryResponse.body.overview).toBeDefined();
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  // Set up test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  
  // Run Jest programmatically
  const jest = require('jest');
  jest.run(['--testPathPattern=mainBudget.test.js']);
}
