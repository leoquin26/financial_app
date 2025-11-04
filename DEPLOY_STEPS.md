# 📋 Step-by-Step Deployment Guide

## 🎯 Recommended: Deploy Frontend to Vercel + Backend to Railway

This is the easiest and most reliable way to deploy your app with all features working.

---

## Part 1: Deploy Backend to Railway (10 minutes)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended) or email

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo" 
3. Connect your GitHub account if needed
4. Select your `financial_app` repository

### Step 3: Configure Environment Variables
In Railway dashboard, go to "Variables" and add:
```
JWT_SECRET=your-super-secret-key-here-change-this-2024
NODE_ENV=production
CLIENT_URL=https://your-app.vercel.app
PORT=5000
```

### Step 4: Deploy
1. Railway will automatically detect Node.js and start deployment
2. Wait for deployment to complete (2-3 minutes)
3. Click "Settings" → Generate Domain
4. Copy your backend URL (e.g., `https://financial-app-production.up.railway.app`)

---

## Part 2: Deploy Frontend to Vercel (5 minutes)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Prepare Frontend
1. Update `client/src/config/api.ts`:
```typescript
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-backend.railway.app';
export const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'https://your-backend.railway.app';
```

### Step 3: Deploy to Vercel
```bash
cd client
vercel
```

Follow the prompts:
- Setup and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- Project name? **financial-tracker** (or your choice)
- Directory? **./** (current directory)
- Override settings? **No**

### Step 4: Set Environment Variables
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add:
```
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_SERVER_URL=https://your-backend.railway.app
```

### Step 5: Redeploy with Environment Variables
```bash
vercel --prod
```

---

## Part 3: Update CORS Settings

### In your Railway backend:
1. Go to your Railway dashboard
2. Update the `CLIENT_URL` environment variable:
```
CLIENT_URL=https://your-app.vercel.app
```
3. Railway will automatically redeploy

---

## 🎉 Done! Your App is Live!

- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.railway.app`

---

## Alternative: Quick Local Backend + Vercel Frontend

If you want to test quickly with local backend:

### 1. Deploy Frontend Only
```bash
cd client
vercel --prod
```

### 2. Run Backend Locally
```bash
# In root directory
npm start
```

### 3. Use ngrok for HTTPS tunnel (optional)
```bash
# Install ngrok
npm install -g ngrok

# Create tunnel
ngrok http 5000
```

Use the ngrok URL as your API_URL in Vercel.

---

## 🔧 Troubleshooting

### CORS Issues
If you see CORS errors:
1. Check `CLIENT_URL` in backend environment variables
2. Make sure it matches your Vercel URL exactly
3. Restart the Railway deployment

### Database Issues
The SQLite database works perfectly on Railway. It persists between deployments.

### WebSocket Issues
Railway supports WebSockets. Make sure:
1. Your `SOCKET_URL` points to the Railway backend
2. The backend URL uses `https://` not `http://`

### Build Failures
If Vercel build fails:
1. Make sure all dependencies are in `package.json`
2. Use `--legacy-peer-deps` flag if needed
3. Check build logs in Vercel dashboard

---

## 📊 Monitoring

### Railway
- View logs: Railway Dashboard → Deployments → View Logs
- Monitor usage: Railway Dashboard → Usage
- Database: Persists automatically

### Vercel
- View logs: Vercel Dashboard → Functions → Logs
- Analytics: Vercel Dashboard → Analytics
- Performance: Automatic CDN optimization

---

## 🚀 Production Checklist

- [ ] Change `JWT_SECRET` to a secure random string
- [ ] Set `NODE_ENV=production`
- [ ] Update CORS with your Vercel domain
- [ ] Test all features after deployment
- [ ] Set up monitoring (optional)
- [ ] Configure custom domain (optional)

---

## 💡 Tips

1. **Free Tier Limits:**
   - Railway: $5/month free credit
   - Vercel: Unlimited for personal use

2. **Performance:**
   - Frontend on Vercel = Global CDN
   - Backend on Railway = Fast and reliable
   - Database persists between deployments

3. **Scaling:**
   - Vercel automatically scales frontend
   - Railway can scale backend as needed

---

## Need Help?

1. Check deployment logs in Railway/Vercel dashboards
2. Verify environment variables are set correctly
3. Ensure URLs don't have trailing slashes
4. Test API endpoints directly in browser
