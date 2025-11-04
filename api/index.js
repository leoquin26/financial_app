// Vercel Serverless Function Entry Point
require('dotenv').config();

// Import and configure the Express app
const app = require('../server/index');

// Export the app for Vercel to handle
module.exports = app;