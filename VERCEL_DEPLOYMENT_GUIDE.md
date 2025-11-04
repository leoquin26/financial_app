# 🚀 Deploy Everything on Vercel (Frontend + Backend)

This guide shows you how to deploy your entire financial app on Vercel, including both frontend and backend.

## ⚠️ Important Limitations

While Vercel CAN host your backend, there are some limitations:
- **Serverless Functions**: Backend runs as serverless functions (10-second timeout on free plan)
- **WebSockets**: Limited WebSocket support (may need polling fallback)
- **File Storage**: No persistent file storage
- **Cold Starts**: Functions may have cold start delays

**For production use with real-time features, consider using Railway/Render for the backend.**

## 📋 Option 1: Monorepo Deployment (Recommended)

### Step 1: Restructure for Vercel

Create a new structure in your repository:

```
your-app/
├── api/                    # Backend API routes
│   ├── auth/
│   │   ├── login.js
│   │   ├── register.js
│   │   └── me.js
│   ├── transactions.js
│   ├── categories.js
│   ├── budgets.js
│   └── _lib/
│       ├── db.js
│       └── auth.js
├── public/                 # Static files
├── src/                    # React frontend
├── package.json
└── vercel.json
```

### Step 2: Convert Express Routes to Serverless Functions

Each API endpoint becomes a separate serverless function. Example:

**api/auth/login.js**:
```javascript
import connectDB from '../_lib/db';
import User from '../_lib/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}
```

## 📋 Option 2: Separate Deployments (Easier)

Deploy frontend and backend as separate Vercel projects:

### Frontend Deployment

1. **Create `client/vercel.json`**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

2. **Deploy Frontend**:
   - Go to Vercel Dashboard
   - Import repository
   - Set root directory to `client`
   - Add environment variable:
     - `REACT_APP_API_URL` = `https://your-backend.vercel.app`

### Backend Deployment (Serverless)

1. **Create `server/vercel.json`**:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

2. **Update `server/index.js`** for serverless:
```javascript
// At the top of server/index.js
if (!process.env.VERCEL) {
  // Normal server mode
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// At the bottom
module.exports = app; // Export for Vercel
```

3. **Deploy Backend**:
   - Create new Vercel project
   - Import same repository
   - Set root directory to `server`
   - Add environment variables:
     - `MONGODB_URI`
     - `JWT_SECRET`
     - `CLIENT_URL` = `https://your-frontend.vercel.app`

## 📋 Option 3: Full Monorepo with API Routes (Most Vercel-Native)

This is the most "Vercel way" but requires more refactoring.

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Create Project Structure
```
financial-app/
├── pages/              # Next.js pages (if converting to Next.js)
├── api/                # API routes
├── components/         # React components
├── lib/               # Shared utilities
├── public/            # Static files
└── vercel.json
```

### Step 3: Create `vercel.json`
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "MONGODB_URI": "@mongodb_uri",
    "JWT_SECRET": "@jwt_secret"
  }
}
```

### Step 4: Deploy
```bash
vercel --prod
```

## 🔧 Handling WebSocket Limitations

Since Vercel has limited WebSocket support, update your Socket.io configuration:

**Client side**:
```javascript
const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'], // Polling fallback
  upgrade: true,
  reconnection: true,
});
```

**Server side**:
```javascript
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  allowUpgrades: true
});
```

## 🚀 Deployment Steps Summary

### For Quickest Deployment:

1. **Set up MongoDB Atlas** (5 minutes)
   - Create free cluster
   - Get connection string

2. **Deploy Frontend to Vercel** (5 minutes)
   ```bash
   cd client
   vercel --prod
   ```

3. **Deploy Backend to Vercel** (5 minutes)
   ```bash
   cd server
   vercel --prod
   ```

4. **Update Environment Variables**
   - Add backend URL to frontend env
   - Add frontend URL to backend env
   - Redeploy both

## ⚡ Performance Optimization for Vercel

1. **Use Edge Functions** for auth checks:
```javascript
export const config = {
  runtime: 'edge',
};
```

2. **Implement Caching**:
```javascript
res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
```

3. **Optimize Database Queries**:
   - Add proper indexes
   - Use connection pooling
   - Implement query caching

## 🎯 Environment Variables in Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

**Frontend**:
- `REACT_APP_API_URL` - Your backend URL

**Backend**:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Random secure string
- `CLIENT_URL` - Your frontend URL
- `NODE_ENV` - production

## ✅ Pros of Vercel-Only Deployment

- Single platform to manage
- Automatic HTTPS
- Global CDN
- Easy rollbacks
- Preview deployments
- Free tier generous

## ❌ Cons of Vercel-Only Deployment

- 10-second function timeout (free plan)
- Limited WebSocket support
- No persistent connections
- Cold starts can be slow
- Not ideal for long-running processes

## 🎉 Final Notes

For a financial app with real-time features, the recommended approach is:
- **Frontend**: Vercel (perfect for React apps)
- **Backend**: Railway/Render (better for persistent connections)

However, if you want everything on Vercel:
- Use Option 2 (separate deployments) for easiest setup
- Implement polling fallback for real-time features
- Consider upgrading to Vercel Pro for longer timeouts

Your app will be live at:
- Frontend: `https://your-app.vercel.app`
- Backend API: `https://your-app-api.vercel.app/api`

Good luck! 🚀
