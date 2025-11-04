# 🚀 Complete Deployment Guide for Financial App

This guide will help you deploy your financial app with:
- **Frontend**: Vercel (free tier)
- **Backend**: Railway or Render (free tier available)
- **Database**: MongoDB Atlas (free tier)

## 📋 Prerequisites

1. GitHub account with your code repository
2. Vercel account (sign up at vercel.com)
3. MongoDB Atlas account (sign up at mongodb.com/atlas)
4. Railway account (railway.app) OR Render account (render.com)

## 🗄️ Step 1: Set Up MongoDB Atlas

### Create a Free MongoDB Cluster:

1. **Sign up/Login** to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. **Create a New Project**:
   - Click "New Project"
   - Name it "financial-app"
   - Click "Create Project"

3. **Create a Free Cluster**:
   - Click "Build a Database"
   - Choose "FREE Shared" option
   - Select your preferred region (closest to you)
   - Choose "M0 Sandbox" (free tier)
   - Name your cluster "financial-cluster"
   - Click "Create"

4. **Set Up Database Access**:
   - Go to "Database Access" in sidebar
   - Click "Add New Database User"
   - Username: `financial_user`
   - Password: Generate a secure password (save it!)
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

5. **Set Up Network Access**:
   - Go to "Network Access" in sidebar
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

6. **Get Your Connection String**:
   - Go to "Database" in sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - It looks like: `mongodb+srv://financial_user:<password>@cluster.xxxxx.mongodb.net/`
   - Replace `<password>` with your actual password
   - Add database name: `mongodb+srv://financial_user:yourpassword@cluster.xxxxx.mongodb.net/financial_app`

## 📦 Step 2: Prepare Your GitHub Repository

### Update Your Code:

1. **Update `client/src/config/api.ts`**:
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

2. **Update `client/src/contexts/SocketContext.tsx`**:
```typescript
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const newSocket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
```

3. **Create `.env.example` in root**:
```env
# Backend Environment Variables
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your-secret-key-change-this-in-production
CLIENT_URL=https://your-app.vercel.app

# Frontend Environment Variables (in client/.env.production)
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_SOCKET_URL=https://your-backend.railway.app
```

4. **Commit and Push to GitHub**:
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

## 🎨 Step 3: Deploy Frontend to Vercel

1. **Go to [Vercel](https://vercel.com)**
2. **Sign in with GitHub**
3. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select your financial app repository

4. **Configure Project**:
   - **Framework Preset**: Create React App
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

5. **Add Environment Variables**:
   - Click "Environment Variables"
   - Add:
     - `REACT_APP_API_URL` = `https://your-backend.railway.app` (we'll update this later)
     - `REACT_APP_SOCKET_URL` = `https://your-backend.railway.app` (we'll update this later)

6. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your frontend URL (e.g., `https://financial-app.vercel.app`)

## 🚂 Step 4: Deploy Backend to Railway

### Option A: Railway (Recommended)

1. **Go to [Railway](https://railway.app)**
2. **Sign in with GitHub**
3. **New Project**:
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository

4. **Configure Service**:
   - **Root Directory**: `server`
   - **Start Command**: `node index.js`

5. **Add Environment Variables**:
   - Click on your service
   - Go to "Variables" tab
   - Add:
     ```
     NODE_ENV=production
     PORT=5000
     MONGODB_URI=mongodb+srv://financial_user:password@cluster.xxxxx.mongodb.net/financial_app
     JWT_SECRET=your-very-secure-random-string-change-this
     CLIENT_URL=https://your-app.vercel.app
     ```

6. **Generate Domain**:
   - Go to "Settings" tab
   - Under "Domains", click "Generate Domain"
   - Copy your backend URL (e.g., `https://financial-app-backend.railway.app`)

### Option B: Render (Alternative)

1. **Go to [Render](https://render.com)**
2. **Sign in with GitHub**
3. **New Web Service**:
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

4. **Configure Service**:
   - **Name**: financial-app-backend
   - **Root Directory**: `server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`

5. **Add Environment Variables**:
   - Same as Railway above

6. **Deploy**:
   - Click "Create Web Service"
   - Copy your backend URL

## 🔄 Step 5: Update Frontend with Backend URL

1. **Go back to Vercel Dashboard**
2. **Settings → Environment Variables**
3. **Update**:
   - `REACT_APP_API_URL` = Your actual backend URL
   - `REACT_APP_SOCKET_URL` = Your actual backend URL

4. **Redeploy**:
   - Go to "Deployments" tab
   - Click "..." on latest deployment
   - Click "Redeploy"

## 🔧 Step 6: Update Backend CORS

Update `server/index.js` to allow your Vercel frontend:

```javascript
const corsOptions = {
    origin: [
        process.env.CLIENT_URL,
        'http://localhost:3000',
        'https://your-app.vercel.app' // Add your actual Vercel URL
    ],
    credentials: true,
    optionsSuccessStatus: 200
};
```

Push this change and Railway/Render will auto-deploy.

## ✅ Step 7: Verify Deployment

1. **Test Frontend**:
   - Visit your Vercel URL
   - Should see the login page
   - Check browser console for errors

2. **Test Backend**:
   - Visit `https://your-backend-url.railway.app/api/health`
   - Should see a success message

3. **Test Full Flow**:
   - Register a new account
   - Login
   - Create transactions
   - Test real-time features

## 🛠️ Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Ensure CLIENT_URL in backend matches your Vercel URL
   - Check corsOptions in server/index.js

2. **MongoDB Connection Failed**:
   - Verify MongoDB URI is correct
   - Check IP whitelist in MongoDB Atlas (should be 0.0.0.0/0)

3. **Socket.io Not Connecting**:
   - Ensure REACT_APP_SOCKET_URL is set correctly
   - Check WebSocket support on your backend platform

4. **Environment Variables Not Working**:
   - Vercel: Redeploy after changing env vars
   - Railway/Render: Changes apply automatically

## 📱 Optional: Custom Domain

### For Vercel (Frontend):
1. Go to Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### For Railway/Render (Backend):
1. Go to Settings → Custom Domains
2. Add your domain (e.g., api.yourdomain.com)
3. Update frontend environment variables

## 🔐 Security Checklist

Before going live:

- [ ] Change JWT_SECRET to a strong, random string
- [ ] Use strong MongoDB password
- [ ] Enable MongoDB Atlas backup
- [ ] Set up monitoring (Railway/Render provides basic monitoring)
- [ ] Review and update rate limiting settings
- [ ] Test all authentication flows
- [ ] Verify HTTPS is working on all domains

## 🎉 Deployment Complete!

Your financial app is now live with:
- ✅ Frontend on Vercel
- ✅ Backend on Railway/Render
- ✅ Database on MongoDB Atlas
- ✅ Real-time features with Socket.io
- ✅ Secure authentication
- ✅ Automatic deployments from GitHub

### Automatic Deployments:
- Push to `main` branch → Auto-deploy to production
- Create pull requests for testing changes

## 📞 Support Resources

- **Vercel**: [docs.vercel.com](https://docs.vercel.com)
- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Render**: [render.com/docs](https://render.com/docs)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)

## 💰 Cost Breakdown (Free Tier)

- **Vercel**: Free for personal projects
- **MongoDB Atlas**: 512MB free forever
- **Railway**: $5 free credits/month
- **Render**: 750 hours free/month

Total: **$0/month** for small-scale usage!

---

Need help? Check the logs in your deployment platforms:
- Vercel: Functions tab → View logs
- Railway/Render: Logs tab in your service
- MongoDB Atlas: Database → Metrics

Good luck with your deployment! 🚀
