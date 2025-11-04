# 🍃 MongoDB Setup Guide

## Prerequisites

### Option 1: Local MongoDB Installation

1. **Download MongoDB Community Server**
   - Go to: https://www.mongodb.com/try/download/community
   - Download for Windows
   - Install with default settings

2. **Start MongoDB Service**
   ```bash
   # MongoDB should start automatically after installation
   # To manually start:
   net start MongoDB
   ```

3. **Verify MongoDB is Running**
   ```bash
   mongosh
   # You should see the MongoDB shell
   ```

### Option 2: MongoDB Atlas (Cloud - Recommended)

1. **Create Free Account**
   - Go to: https://www.mongodb.com/cloud/atlas
   - Sign up for free account
   - Create a free M0 cluster

2. **Configure Cluster**
   - Choose closest region
   - Create database user
   - Add your IP to whitelist (or allow all: 0.0.0.0/0)

3. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

## Configuration

### 1. Create Environment File

Create a `.env` file in the project root:

```env
# For Local MongoDB
MONGODB_URI=mongodb://localhost:27017/financial_app

# For MongoDB Atlas (replace with your connection string)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/financial_app?retryWrites=true&w=majority

JWT_SECRET=your-secret-key-change-this-in-production
PORT=5000
NODE_ENV=development
```

### 2. Install Dependencies

```bash
npm install
```

## Running the Application

### Start MongoDB (if using local installation)
```bash
# Windows
net start MongoDB

# Or use MongoDB Compass GUI
```

### Start the Application
```bash
# Development mode
npm run dev

# Or use the batch file
start-app.bat
```

## Database Structure

The application will automatically:
- Create the database if it doesn't exist
- Create all necessary collections
- Insert default categories
- Create a demo user (username: `demo`, password: `demo123`)

### Collections Created:
- `users` - User accounts
- `categories` - Transaction categories
- `transactions` - Financial transactions
- `budgets` - Budget tracking
- `notifications` - User notifications

## Troubleshooting

### Connection Issues

1. **Local MongoDB not connecting:**
   ```bash
   # Check if MongoDB is running
   sc query MongoDB
   
   # Start MongoDB if not running
   net start MongoDB
   ```

2. **Atlas connection issues:**
   - Verify IP is whitelisted
   - Check username/password
   - Ensure cluster is active

### Port Already in Use

If port 27017 is in use:
```bash
# Find process using port
netstat -ano | findstr :27017

# Kill process (replace PID)
taskkill /PID <PID> /F
```

## MongoDB GUI Tools

### MongoDB Compass (Recommended)
- Download: https://www.mongodb.com/products/compass
- Connect using: `mongodb://localhost:27017`
- View and manage your data visually

## Data Migration from SQLite

If you have existing data in SQLite, run:
```bash
npm run migrate-data
```

This will:
- Export data from SQLite
- Transform to MongoDB format
- Import into MongoDB

## Backup and Restore

### Backup
```bash
# Local backup
mongodump --db financial_app --out ./backup

# Atlas backup - use Atlas UI or:
mongodump --uri "your-atlas-uri" --out ./backup
```

### Restore
```bash
# Local restore
mongorestore --db financial_app ./backup/financial_app

# Atlas restore
mongorestore --uri "your-atlas-uri" ./backup/financial_app
```

## Performance Tips

1. **Indexes are automatically created for:**
   - User lookups
   - Transaction queries by date
   - Category searches
   - Budget filters

2. **Connection Pooling:**
   - Mongoose handles connection pooling automatically
   - Default pool size is 10 connections

3. **Query Optimization:**
   - Use pagination for large datasets
   - Indexes are created on frequently queried fields

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to version control
- Use strong JWT secret in production
- Enable MongoDB authentication in production
- Restrict IP access in MongoDB Atlas
- Use SSL/TLS connections in production
