# 🚀 Deploying to Vercel

## Important Notes

**SQLite Limitation**: Vercel's serverless functions don't support SQLite persistent storage. You have two options:

## Option 1: Deploy Frontend Only (Recommended for Quick Demo)

This deploys only the React frontend to Vercel while keeping the backend local or on another service.

### Steps:

1. **Build the React app:**
```bash
cd client
npm run build
```

2. **Install Vercel CLI:**
```bash
npm install -g vercel
```

3. **Deploy frontend only:**
```bash
cd client
vercel --prod
```

4. **Update the API URL in your frontend:**
Create a `.env` file in the `client` folder:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SERVER_URL=http://localhost:5000
```

For production, update these to your backend URL.

## Option 2: Full Stack Deployment (Requires Database Migration)

To deploy the full stack on Vercel, you need to migrate from SQLite to a cloud database.

### Recommended Cloud Databases:

1. **PostgreSQL (Recommended)**
   - **Vercel Postgres** (Built-in integration)
   - **Supabase** (Free tier available)
   - **Neon** (Serverless Postgres)
   - **Railway** (Simple deployment)

2. **MySQL**
   - **PlanetScale** (Serverless MySQL)
   - **Railway MySQL**

### Migration Steps for PostgreSQL:

1. **Install PostgreSQL adapter:**
```bash
npm install pg
npm uninstall sqlite3
```

2. **Create a new database configuration file:**
```javascript
// server/database/postgres-db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Your database initialization code here
```

3. **Set up Vercel Postgres:**
   - Go to your Vercel dashboard
   - Add Vercel Postgres to your project
   - Copy the connection string

4. **Update environment variables in Vercel:**
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure random string
   - `NODE_ENV`: production

## Option 3: Alternative Deployment Platforms

For easier deployment with SQLite support:

### 1. **Railway.app** (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy
railway up
```

### 2. **Render.com**
- Supports SQLite with persistent disk
- Free tier available
- WebSocket support

### 3. **Fly.io**
- Full Docker support
- Persistent volumes for SQLite
- Global deployment

### 4. **Heroku** (Paid only now)
- Traditional PaaS
- Requires PostgreSQL addon

## Quick Deployment to Railway (Easiest with SQLite)

1. **Create account at [Railway.app](https://railway.app)**

2. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

3. **Deploy:**
```bash
railway login
railway init
railway up
```

4. **Add environment variables in Railway dashboard:**
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `CLIENT_URL=your-frontend-url`

5. **Get your app URL from Railway dashboard**

## Frontend-Only Vercel Deployment (Quickest)

If you just want to deploy the frontend to Vercel and run the backend locally:

1. **Create `client/.env.production`:**
```env
REACT_APP_API_URL=http://localhost:5000
```

2. **Deploy frontend:**
```bash
cd client
npm run build
vercel --prod
```

3. **Run backend locally:**
```bash
npm run server
```

4. **Access your app:**
   - Frontend: `https://your-app.vercel.app`
   - Backend: `http://localhost:5000`

## Recommended Approach

For a full production deployment with all features:

1. **Frontend**: Deploy to Vercel
2. **Backend + Database**: Deploy to Railway.app or Render.com
3. **Update CORS and environment variables** to connect them

This gives you:
- ✅ Fast frontend on Vercel's CDN
- ✅ Persistent SQLite database
- ✅ WebSocket support
- ✅ All features working
- ✅ Free tier available

## Environment Variables Needed

### For Backend:
- `JWT_SECRET`: Random secure string
- `DATABASE_URL`: (If using PostgreSQL)
- `NODE_ENV`: production
- `CLIENT_URL`: Your frontend URL

### For Frontend:
- `REACT_APP_API_URL`: Your backend URL
- `REACT_APP_SERVER_URL`: Your backend URL (for WebSocket)

## Testing Locally Before Deployment

1. **Build frontend:**
```bash
cd client
npm run build
```

2. **Serve built frontend:**
```bash
npx serve -s build
```

3. **Run backend:**
```bash
npm start
```

4. **Test at `http://localhost:3000`**
