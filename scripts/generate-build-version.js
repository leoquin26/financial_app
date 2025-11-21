const fs = require('fs');
const path = require('path');

// Generate build version based on timestamp
const buildVersion = new Date().toISOString();
const buildNumber = Date.now();

const versionInfo = {
  version: buildVersion,
  buildNumber: buildNumber,
  deploymentDate: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || 'local',
  environment: process.env.NODE_ENV || 'development'
};

// Write version info to client public folder
const clientVersionPath = path.join(__dirname, '../client/public/version.json');
fs.writeFileSync(clientVersionPath, JSON.stringify(versionInfo, null, 2));

// Update service worker with new version
const swPath = path.join(__dirname, '../client/public/service-worker.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace the version in service worker
swContent = swContent.replace(
  /const CACHE_VERSION = 'v\d+'/,
  `const CACHE_VERSION = 'v${buildNumber}'`
);

fs.writeFileSync(swPath, swContent);

console.log('✅ Build version generated:', versionInfo);
console.log('✅ Service worker updated with version:', `v${buildNumber}`);
