#!/bin/bash
set -e

echo "🚀 EMG Prosthesis Control System - Setup"
echo "========================================="

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js >= 18"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js >= 18 required (found v$NODE_VER)"
  exit 1
fi

echo "✓ Node.js $(node -v)"

# Check MySQL
if ! command -v mysql &> /dev/null; then
  echo "⚠️  MySQL CLI not found. Make sure MySQL is running locally or via Docker."
  echo "   Docker: run 'npm run docker:up' first"
fi

# Copy .env if needed
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
  echo "⚠️  Edit .env with your database credentials before continuing"
  read -p "Press Enter when ready..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init 2>/dev/null || npx prisma db push

# Seed database
echo "🌱 Seeding database..."
npx tsx prisma/seed.ts

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Login credentials:"
echo "   Admin:      admin@emg.system       / Admin@2024!"
echo "   Researcher: investigador@emg.system / User@2024!"
echo "   Technician: tecnico@emg.system      / User@2024!"
echo ""
echo "🚀 Start the application:"
echo "   npm run dev"
echo ""
echo "   Frontend:      http://localhost:3000"
echo "   Prisma Studio: http://localhost:5555"
