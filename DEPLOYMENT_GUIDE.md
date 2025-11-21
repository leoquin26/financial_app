# Deployment Guide - Vercel & Railway

## Frontend (Vercel)

### Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:
```
REACT_APP_API_URL=https://your-app.railway.app
```

### Automatic Cache Busting
The build process automatically:
1. Generates a unique version on each deployment
2. Updates service worker cache version
3. Clears old caches when users visit

### Deployment Steps
1. Push to GitHub
2. Vercel automatically builds and deploys
3. Users get update notifications

## Backend (Railway)

### Environment Variables
Set these in Railway Dashboard:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
PORT=8080
NODE_ENV=production

# CORS - Add your Vercel domains
CLIENT_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

### Deployment Steps
1. Push to GitHub
2. Railway automatically deploys
3. Backend restarts with new code

## Cache Management

### How It Works
1. **Build Time**: Version file is generated with deployment info
2. **First Visit**: Service worker caches assets with version
3. **Updates**: New deployments get new version numbers
4. **User Experience**: Notification appears when update is available

### Version File
Located at: `https://your-app.vercel.app/version.json`

Example content:
```json
{
  "version": "2024-11-21T10:30:00.000Z",
  "buildNumber": 1732183800000,
  "deploymentDate": "2024-11-21T10:30:00.000Z",
  "gitCommit": "abc123...",
  "gitBranch": "main",
  "environment": "production",
  "deploymentId": "dpl_xyz...",
  "vercelUrl": "your-app-xyz.vercel.app"
}
```

### Testing Updates
1. Deploy a new version
2. Visit the site in an incognito window
3. Close and reopen (or wait 1 hour)
4. You should see the update notification

### Force Cache Clear
Users can force clear cache by:
1. Click "Update Now" in the notification
2. Or manually: DevTools → Application → Clear Storage

## Troubleshooting

### Service Worker Not Updating
- Check `/service-worker.js` has no-cache headers
- Verify version.json is being generated
- Check browser DevTools → Application → Service Workers

### CORS Issues
- Ensure Railway backend has correct CLIENT_URL
- Check allowed origins include all your domains
- Verify API calls use the correct URL