# 🚀 Deploy Financial App: Frontend on Vercel + Backend on Railway

This guide will help you deploy your financial app with the frontend on Vercel and backend on Railway for optimal performance.

## 📋 Prerequisites

1. **GitHub Account** - Your code must be on GitHub
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
3. **Railway Account** - Sign up at [railway.app](https://railway.app)
4. **MongoDB Atlas Account** - Sign up at [mongodb.com/atlas](https://mongodb.com/atlas)

## 🗄️ Step 1: Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://mongodb.com/atlas)
2. Create a free M0 cluster
3. Create database user:
   - Username: `financial_app_user`
   - Password: Generate a secure password
4. Network Access:
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0)
5. Get connection string:
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password

## 🚂 Step 2: Deploy Backend on Railway

### 2.1 Prepare Backend
Your backend is already configured with:
- `server/package.json` - Dependencies and scripts
- `server/railway.json` - Railway configuration
- `server/env.example.txt` - Environment variables template

### 2.2 Deploy to Railway

1. **Go to [Railway](https://railway.app)**

2. **Click "New Project"**

3. **Select "Deploy from GitHub repo"**

4. **Choose your repository** (`financial_app`)

5. **Configure deployment:**
   - Root Directory: `server`
   - Branch: `main` (or `master`)

6. **Add Environment Variables:**
   Click on your service → Variables → Add the following:

   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/financial_app
   JWT_SECRET=your-very-secure-random-string-here
   CLIENT_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```

   **Note:** Railway automatically provides the `PORT` variable

7. **Deploy:**
   - Click "Deploy"
   - Wait for the build to complete (3-5 minutes)

8. **Get your Backend URL:**
   - Go to Settings → Domains
   - Generate a domain (e.g., `financial-app-backend.railway.app`)
   - Copy this URL - you'll need it for Vercel

## 🔺 Step 3: Deploy Frontend on Vercel

### 3.1 Prepare Frontend
Your frontend is already configured with:
- `client/vercel.json` - Vercel configuration
- `client/env.example.txt` - Environment variables template

### 3.2 Deploy to Vercel

1. **Go to [Vercel](https://vercel.com)**

2. **Click "Add New" → "Project"**

3. **Import your GitHub repository**

4. **Configure Project:**
   - Framework Preset: `Create React App`
   - Root Directory: `client`
   - Build Command: `npm install --legacy-peer-deps && npm run build`
   - Output Directory: `build`

5. **Add Environment Variables:**
   Add the following variable:

   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   ```

   Replace with your actual Railway backend URL from Step 2.8

6. **Click "Deploy"**
   - Wait for deployment (2-3 minutes)
   - Your frontend will be available at `https://your-app.vercel.app`

## 🔄 Step 4: Update CORS Settings

After both deployments are complete:

1. **Go back to Railway**
2. **Update the `CLIENT_URL` environment variable:**
   ```
   CLIENT_URL=https://your-actual-app.vercel.app
   ```
3. **Railway will automatically redeploy**

## ✅ Step 5: Verify Deployment

1. **Test Frontend:**
   - Visit your Vercel URL
   - Should see the login page

2. **Test Backend:**
   - Visit `https://your-backend.railway.app/api/health`
   - Should see: `{"status":"ok","timestamp":"...","environment":"production"}`

3. **Test Full App:**
   - Try registering a new user
   - Login with demo account (username: `demo`, password: `demo123`)
   - Create transactions, budgets, etc.

## 🔧 Troubleshooting

### Frontend not connecting to backend?
- Check `REACT_APP_API_URL` in Vercel dashboard
- Ensure it starts with `https://` and has no trailing slash

### CORS errors?
- Verify `CLIENT_URL` in Railway matches your Vercel URL exactly
- Check Railway logs for specific error messages

### Database connection issues?
- Verify MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Check `MONGODB_URI` format in Railway variables

### WebSocket not connecting?
- This is normal - Railway supports WebSockets fully
- Check browser console for connection status

## 📝 Environment Variables Summary

### Railway (Backend)
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
CLIENT_URL=https://your-app.vercel.app
NODE_ENV=production
```

### Vercel (Frontend)
```env
REACT_APP_API_URL=https://your-backend.railway.app
```

## 🚀 Deployment Commands

### Update Frontend (Vercel)
```bash
git add .
git commit -m "Update frontend"
git push origin main
# Vercel auto-deploys on push
```

### Update Backend (Railway)
```bash
git add .
git commit -m "Update backend"
git push origin main
# Railway auto-deploys on push
```

## 🎯 URLs After Deployment

- **Frontend:** `https://[your-app-name].vercel.app`
- **Backend API:** `https://[your-backend].railway.app`
- **Health Check:** `https://[your-backend].railway.app/api/health`

## 💡 Pro Tips

1. **Use Railway's Logs** to debug backend issues
2. **Use Vercel's Functions tab** to see build logs
3. **Enable Vercel Analytics** for frontend performance monitoring
4. **Set up Railway alerts** for backend monitoring
5. **Use custom domains** for professional appearance

## 🎉 Congratulations!

Your financial app is now deployed with:
- ✅ Frontend on Vercel (Global CDN, Fast loading)
- ✅ Backend on Railway (WebSocket support, Persistent connections)
- ✅ Database on MongoDB Atlas (Cloud database, Auto-backups)

## 📚 Next Steps

1. **Add custom domain** (optional)
2. **Set up monitoring** (Railway metrics, Vercel Analytics)
3. **Configure backups** in MongoDB Atlas
4. **Add SSL certificate** (automatic with custom domains)

## 🆘 Need Help?

- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Vercel Discord: [discord.gg/vercel](https://discord.gg/vercel)
- MongoDB Forums: [mongodb.com/community/forums](https://mongodb.com/community/forums)

---

Happy Deploying! 🚀
