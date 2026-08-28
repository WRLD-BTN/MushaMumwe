#!/bin/bash
set -e

echo "🚀 MushaMumwe Setup — One Command"
echo ""

if ! command -v psql &> /dev/null; then
  echo "📦 Installing PostgreSQL..."
  sudo apt update
  sudo apt install -y postgresql postgresql-contrib
fi

echo "🗄️  Starting PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

echo "🔐 Creating database and user..."
sudo -u postgres psql <<SQL
  DROP DATABASE IF EXISTS mushamumwe_test;
  DROP USER IF EXISTS dashboard_user;
  CREATE DATABASE mushamumwe_test;
  CREATE USER dashboard_user WITH PASSWORD 'testpass123';
  ALTER ROLE dashboard_user WITH CREATEDB;
  GRANT ALL PRIVILEGES ON DATABASE mushamumwe_test TO dashboard_user;
SQL

echo "⚙️  Creating .env..."
cat > .env <<ENV
DATABASE_URL="postgresql://dashboard_user:testpass123@localhost:5432/mushamumwe_test?schema=public"
PORT=4000
JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
ENV

echo "📊 Creating database tables..."
npx prisma migrate dev --name init --skip-generate

echo "🔧 Generating Prisma client..."
npm run prisma:generate

echo "🌱 Seeding test data..."
npm run seed

echo ""
echo "✅ Setup complete! Test credentials:"
echo ""
echo "  Nurses:   nurse1 / nurse123"
echo "  Records:  records1 / records123"
echo "  Accounts: accounts1 / accounts123"
echo "  IT/Admin: it1 / it123"
echo ""
echo "🌐 Starting server on http://localhost:4000..."
npm run dev
