#!/bin/bash

echo "🚀 Deploying Frontend to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Build the client
echo "Building React app..."
cd client
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo "✅ Frontend deployed to Vercel!"
echo ""
echo "⚠️  Important: Remember to:"
echo "1. Deploy your backend to Railway, Render, or another service"
echo "2. Update REACT_APP_API_URL in Vercel environment variables"
echo "3. Update CORS settings in your backend to allow your Vercel domain"
