# Main Budget System - Test Guide

## Overview
This guide provides step-by-step instructions for manually testing the Main Budget system to ensure all features work correctly.

## Prerequisites
1. Backend server running (`npm run dev` in server directory)
2. Frontend running (`npm start` in client directory)
3. User account created and logged in
4. Some categories created

## Test Scenarios

### 1. Create Main Budget (Monthly)
**Steps:**
1. Navigate to "Presupuestos" in the menu
2. Click "Create Budget" button
3. Fill in the form:
   - Name: "November 2024 Budget"
   - Description: "Test monthly budget"
   - Period: Monthly
4. Click "Next"
5. Enter total budget: $3000
6. Add categories:
   - Food: $400
   - Transport: $300
   - Entertainment: $200
7. Click "Next"
8. Configure settings:
   - Auto-create weekly budgets: ON
   - Roll over unspent: OFF
9. Click "Next"
10. Review and click "Create Budget"

**Expected Results:**
- ✅ Budget created successfully
- ✅ Shows in active budgets section
- ✅ 4-5 weekly budget cards displayed
- ✅ Progress bar shows 0%
- ✅ Categories show correct allocations

### 2. Navigate to Weekly Budget
**Steps:**
1. From the main budget view, click on "Week 1" card
2. Observe the weekly budget page loads

**Expected Results:**
- ✅ Weekly budget page opens
- ✅ Shows parent budget name in header
- ✅ Total budget is ~$750 (3000/4)
- ✅ Categories inherited from main budget
- ✅ Can add payments as normal

### 3. Update Payment Status
**Steps:**
1. In weekly budget, add a payment:
   - Name: "Grocery shopping"
   - Amount: $100
   - Category: Food
2. Mark payment as "Paid"
3. Return to main budgets page

**Expected Results:**
- ✅ Payment status updates
- ✅ Main budget progress updates
- ✅ Analytics reflect the spending

### 4. Create Quarterly Budget
**Steps:**
1. Click "Create Budget"
2. Select "Quarterly" period
3. Enter $9000 total budget
4. Complete the wizard

**Expected Results:**
- ✅ 13 weekly budget cards created
- ✅ Correct date ranges shown
- ✅ Budget appears in list

### 5. Budget Filtering
**Steps:**
1. Use period filter: "Monthly"
2. Use status filter: "Active"
3. Clear filters

**Expected Results:**
- ✅ Filters work correctly
- ✅ Budget list updates
- ✅ Can see all budgets when cleared

### 6. Household Sharing
**Steps:**
1. Create a budget with household sharing enabled
2. Select a household from dropdown
3. Complete creation
4. Check household budget view

**Expected Results:**
- ✅ Budget shows "Shared" chip
- ✅ Appears in household budgets
- ✅ Members can view/edit based on permissions

### 7. Budget Analytics
**Steps:**
1. After some spending, click analytics icon
2. Review the summary data

**Expected Results:**
- ✅ Overview shows correct totals
- ✅ Category breakdown accurate
- ✅ Weekly progress displayed
- ✅ Trends calculated correctly

### 8. Migration Test (If applicable)
**Steps:**
1. Run migration script: `node server/scripts/migrateWeeklyBudgets.js`
2. Check the console output
3. Verify in UI

**Expected Results:**
- ✅ Existing weekly budgets grouped by month
- ✅ Main budgets created for past months
- ✅ Weekly budgets linked to parents
- ✅ Historical data preserved

## Error Scenarios to Test

### 1. Invalid Budget Amount
- Try creating budget with $0
- Expected: Validation error

### 2. Overlapping Periods
- Try creating two monthly budgets for same month
- Expected: Should be allowed (different use cases)

### 3. Permission Checks
- Try accessing another user's budget
- Expected: 404 or 403 error

### 4. Network Errors
- Create budget with network disconnected
- Expected: Error message, form data preserved

## Performance Tests

### 1. Large Budget History
- Create 10+ budgets
- Expected: List loads quickly, pagination if needed

### 2. Many Categories
- Create budget with 20+ categories
- Expected: UI remains responsive

### 3. Concurrent Updates
- Update weekly budget while someone updates main
- Expected: Both updates succeed, data syncs

## API Testing with Postman/curl

### Create Main Budget
```bash
curl -X POST http://localhost:5000/api/main-budgets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Budget",
    "periodType": "monthly",
    "totalBudget": 3000,
    "categories": [],
    "settings": {
      "autoCreateWeekly": true
    }
  }'
```

### Get Budget Summary
```bash
curl -X GET http://localhost:5000/api/main-budgets/BUDGET_ID/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Weekly Budget for Week 2
```bash
curl -X POST http://localhost:5000/api/main-budgets/BUDGET_ID/weekly/2 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Automated Testing
Run the test suite:
```bash
cd server
npm test -- mainBudget.test.js
```

## Checklist Summary
- [ ] Can create monthly budget
- [ ] Can create quarterly budget
- [ ] Can create yearly budget
- [ ] Can navigate to weekly budgets
- [ ] Weekly budgets inherit from main
- [ ] Spending updates reflect in main
- [ ] Analytics work correctly
- [ ] Filtering works
- [ ] Household sharing works
- [ ] Migration script works
- [ ] Error handling works
- [ ] Performance is acceptable

## Known Issues / Limitations
1. Custom period budgets need start/end dates
2. First weekly budget auto-creates, others on-demand
3. Deleting only works for draft budgets

## Support
If you encounter issues:
1. Check browser console for errors
2. Check server logs
3. Verify data in database
4. Report with reproduction steps
