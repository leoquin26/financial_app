const fs = require('fs');
const path = require('path');

// Generate build version based on timestamp
const buildVersion = new Date().toISOString();
const buildNumber = Date.now();

// Vercel environment variables
const versionInfo = {
  version: buildVersion,
  buildNumber: buildNumber,
  deploymentDate: new Date().toISOString(),
  gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'local',
  gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'local',
  vercelUrl: process.env.VERCEL_URL || null
};

// Write version info to public folder
const versionPath = path.join(__dirname, '../public/version.json');
fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));

// Update service worker with new version
const swPath = path.join(__dirname, '../public/service-worker.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the version in service worker
  swContent = swContent.replace(
    /const CACHE_VERSION = 'v\d+'/,
    `const CACHE_VERSION = 'v${buildNumber}'`
  );
  
  fs.writeFileSync(swPath, swContent);
}

console.log('✅ Build version generated:', versionInfo);
console.log('✅ Service worker updated with version:', `v${buildNumber}`);
