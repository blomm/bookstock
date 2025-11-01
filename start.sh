#!/bin/bash

# BookStock - Quick Start Script
# This script helps you get the project running quickly

set -e

echo "🚀 BookStock - Quick Start"
echo "=========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: You need to configure Clerk authentication keys in .env"
    echo "   1. Sign up at https://clerk.com"
    echo "   2. Get your API keys from the dashboard"
    echo "   3. Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env"
    echo ""
    read -p "Press Enter when you've updated the .env file..."
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Start databases
echo "📦 Starting PostgreSQL databases..."
docker-compose up -d

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 5

# Check if databases are running
if docker ps | grep -q "bookstock-dev-db"; then
    echo "✅ Development database is running"
else
    echo "❌ Development database failed to start"
    exit 1
fi

if docker ps | grep -q "bookstock-test-db"; then
    echo "✅ Test database is running"
else
    echo "❌ Test database failed to start"
    exit 1
fi

echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Run migrations
echo "🗄️  Running database migrations..."
npm run db:migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎉 You're ready to go!"
echo ""
echo "Next steps:"
echo "  1. Start the dev server: npm run dev"
echo "  2. Open http://localhost:3000 in your browser"
echo "  3. Sign up to create your first user"
echo "  4. Navigate to /titles to see the Title Management system"
echo ""
echo "Useful commands:"
echo "  - npm run dev          # Start development server"
echo "  - npm test             # Run tests"
echo "  - npx prisma studio    # Open database GUI"
echo "  - docker-compose down  # Stop databases"
echo ""
