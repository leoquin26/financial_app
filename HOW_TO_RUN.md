# 🚀 How to Run the Financial App

## Prerequisites

### 1. Node.js & npm
- Node.js v14+ installed
- npm or yarn package manager

### 2. MongoDB Database
Choose one option:

#### Option A: Local MongoDB
- Install MongoDB Community Server from: https://www.mongodb.com/try/download/community
- Start MongoDB service: `net start MongoDB`

#### Option B: MongoDB Atlas (Cloud - Recommended)
- Create free account at: https://www.mongodb.com/cloud/atlas
- Create a free M0 cluster
- Get your connection string

## Installation

### 1. Clone or Download the Project
```bash
cd C:\Users\leona\OneDrive\Documentos\Projects\financial_app
```

### 2. Install Dependencies
```bash
# Install all dependencies (backend + frontend)
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory:

```env
# For Local MongoDB
MONGODB_URI=mongodb://localhost:27017/financial_app

# OR for MongoDB Atlas (replace with your connection string)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/financial_app?retryWrites=true&w=majority

JWT_SECRET=your-secret-key-change-this-in-production
PORT=5000
NODE_ENV=development
```

## Running the Application

### Option 1: Using Batch Files (Windows - Easiest!)

#### For MongoDB:
```bash
# Double-click or run:
start-app-mongodb.bat
```

#### To Stop:
```bash
# Double-click or run:
stop-app.bat
```

### Option 2: Using npm Scripts

#### Development Mode (Both servers):
```bash
npm run dev
```

#### Run Separately:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd client
npm start
```

### Option 3: Manual Commands

#### Backend Only:
```bash
cd C:\Users\leona\OneDrive\Documentos\Projects\financial_app
npm run server
```

#### Frontend Only:
```bash
cd C:\Users\leona\OneDrive\Documentos\Projects\financial_app\client
npm start
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Login Credentials**:
  - Username: `demo`
  - Password: `demo123`

## Database Management

### Test MongoDB Connection:
```bash
node test-mongodb.js
```

### Migrate from SQLite to MongoDB:
```bash
npm run migrate-data
```

### View Database:
- Use MongoDB Compass: https://www.mongodb.com/products/compass
- Connect to: `mongodb://localhost:27017/financial_app`

## Features Available

✅ **Financial Management**
- Income and expense tracking
- Transaction categorization
- Budget management with alerts
- Financial analytics dashboard

✅ **Real-time Features**
- Live notifications
- Instant updates across sessions
- Budget threshold alerts
- Transaction notifications

✅ **User Features**
- Secure authentication
- Personal categories
- Custom budgets
- Notification preferences

## Troubleshooting

### MongoDB Connection Issues

1. **Local MongoDB not connecting:**
```bash
# Check if MongoDB is running
sc query MongoDB

# Start MongoDB if needed
net start MongoDB
```

2. **Port 5000 already in use:**
```bash
# Run the stop script
stop-app.bat

# Or manually kill the process
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

3. **Port 3000 already in use:**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

4. **MongoDB Atlas connection fails:**
- Check IP whitelist (add current IP or 0.0.0.0/0 for all)
- Verify username/password in connection string
- Ensure cluster is active

### Frontend Compilation Issues

If you see React compilation errors:
```bash
cd client
npm install --legacy-peer-deps
```

### Clear All Data

To reset the database:
1. Open MongoDB Compass
2. Connect to your database
3. Drop the `financial_app` database
4. Restart the server (it will recreate everything)

## Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload in development
2. **API Testing**: Use Postman or Thunder Client to test API endpoints
3. **Database GUI**: MongoDB Compass for visual database management
4. **Logs**: Check terminal output for server logs and errors

## Production Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Import to Vercel
3. Set environment variables

### Backend (Railway/Render)
1. Push to GitHub
2. Deploy to Railway/Render
3. Set MongoDB Atlas connection string
4. Configure environment variables

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the MONGODB_SETUP.md file
3. Ensure all dependencies are installed
4. Verify MongoDB is running

---
**Note**: This application now uses MongoDB instead of SQLite for better scalability and cloud deployment options.