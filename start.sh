#!/bin/bash

echo '🚀 Starting Builder.io Ultimate...'

# Install dependencies if not already installed
if [ ! -d 'node_modules' ]; then
    echo '📦 Installing dependencies...'
    pnpm install
fi

# Create uploads directory
mkdir -p uploads

# Start with PM2
echo '🔥 Starting with PM2...'
pm2 start ecosystem.config.js

echo '✅ Builder.io Ultimate is running!'
echo '🌐 Access at: http://ec2-3-84-32-196.compute-1.amazonaws.com:3004'
echo '📊 PM2 Status: pm2 status'
echo '📝 PM2 Logs: pm2 logs builder-io-ultimate'
