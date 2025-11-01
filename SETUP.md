# BookStock - Local Development Setup

## Quick Start Guide

Follow these steps to get BookStock running locally.

## Prerequisites

- **Node.js** 18+ and npm
- **Docker Desktop** (for PostgreSQL databases)
- **Clerk Account** (for authentication) - Sign up at [clerk.com](https://clerk.com)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL Databases

You have two options:

#### Option A: Using Docker (Recommended)

Create a `docker-compose.yml` file in the project root:

```yaml
version: '3.8'

services:
  # Development Database
  postgres-dev:
    image: postgres:15
    container_name: bookstock-dev-db
    environment:
      POSTGRES_USER: bookstock
      POSTGRES_PASSWORD: bookstock_dev_password
      POSTGRES_DB: bookstock_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-dev-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bookstock"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Test Database
  postgres-test:
    image: postgres:15
    container_name: bookstock-test-db
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: bookstock_test
    ports:
      - "5433:5432"
    volumes:
      - postgres-test-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-dev-data:
  postgres-test-data:
```

Start the databases:

```bash
docker-compose up -d
```

Verify databases are running:

```bash
docker ps
```

You should see both `bookstock-dev-db` and `bookstock-test-db` containers running.

#### Option B: Local PostgreSQL Installation

If you prefer to use a local PostgreSQL installation:

1. Install PostgreSQL 15+
2. Create two databases:
   ```sql
   CREATE DATABASE bookstock_dev;
   CREATE DATABASE bookstock_test;
   ```
3. Create users and grant permissions as needed
4. Update `.env` with your connection strings

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

#### Database URLs (already configured for Docker)
```env
DATABASE_URL="postgresql://bookstock:bookstock_dev_password@localhost:5432/bookstock_dev"
TEST_DATABASE_URL="postgresql://test:test@localhost:5433/bookstock_test"
```

#### Clerk Authentication

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application (or use existing)
3. Copy your keys from the API Keys page:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."
```

#### Application URLs (for local development)
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

### 4. Set Up Database Schema

Generate Prisma client:

```bash
npm run db:generate
```

Run database migrations:

```bash
npm run db:migrate
```

(Optional) Seed the database with sample data:

```bash
npm run db:seed
```

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### 6. Create Your First User

1. Open http://localhost:3000 in your browser
2. Click "Sign Up" to create an account via Clerk
3. After signing up, you'll be redirected to the dashboard

## Verification Checklist

✅ **Dependencies Installed**: Run `npm list` to verify
✅ **Docker Running**: `docker ps` shows both database containers
✅ **Environment Variables**: `.env` file exists with Clerk keys
✅ **Database Migrated**: `npm run db:migrate` completed successfully
✅ **Dev Server Running**: http://localhost:3000 loads
✅ **Authentication Working**: Can sign up and sign in

## Exploring the Title Management System

Once you're logged in, you can:

1. **View Titles**: Navigate to http://localhost:3000/titles
2. **Create a Title**: Click "Create Title" button
3. **Search & Filter**: Use the search box and filter dropdowns
4. **View Details**: Click on any title to see full details
5. **Edit Title**: Click "Edit" on the detail page
6. **Bulk Import**: Click "Import" to upload CSV files

### Sample Title Data

Create a test title with these values:

- **ISBN**: 9780306406157
- **Title**: React Programming Guide
- **Author**: John Smith
- **Format**: PAPERBACK
- **RRP**: 29.99
- **Unit Cost**: 8.50
- **Publisher**: Tech Books Inc

## Running Tests

### Unit and Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### E2E Tests

E2E tests require the test database to be running:

```bash
# Make sure test database is up
docker ps | grep bookstock-test-db

# Run E2E tests
TEST_DATABASE_URL="postgresql://test:test@localhost:5433/bookstock_test" npx vitest run src/test/e2e/
```

## Troubleshooting

### Database Connection Issues

**Problem**: "Can't reach database server"

**Solutions**:
1. Check Docker containers are running: `docker ps`
2. Restart containers: `docker-compose restart`
3. Check `.env` has correct DATABASE_URL
4. Verify ports 5432 and 5433 are not in use: `lsof -i :5432`

### Clerk Authentication Issues

**Problem**: Authentication redirects or errors

**Solutions**:
1. Verify Clerk keys in `.env` are correct
2. Check Clerk dashboard for domain allowlist (add `localhost:3000`)
3. Clear browser cookies and try again
4. Check Clerk webhook is configured correctly

### Migration Failures

**Problem**: Prisma migration fails

**Solutions**:
1. Drop and recreate database:
   ```bash
   docker-compose down -v
   docker-compose up -d
   npm run db:migrate
   ```
2. Check database connection string in `.env`
3. Ensure Prisma schema is valid: `npx prisma validate`

### Port Already in Use

**Problem**: "Port 3000 is already in use"

**Solutions**:
1. Kill the process using port 3000:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```
2. Or use a different port:
   ```bash
   PORT=3001 npm run dev
   ```

## Useful Commands

### Database Management

```bash
# View database with Prisma Studio
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name your_migration_name

# Generate Prisma client after schema changes
npm run db:generate
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build production
npm run build
```

### Docker Management

```bash
# Start databases
docker-compose up -d

# Stop databases
docker-compose down

# View logs
docker-compose logs -f

# Delete all data (fresh start)
docker-compose down -v
```

## Project Structure

```
bookstock/
├── src/
│   ├── app/              # Next.js app directory (pages)
│   │   └── titles/       # Title management pages
│   ├── components/       # React components
│   │   └── titles/       # Title-related components
│   ├── lib/              # Utilities and helpers
│   │   └── validators/   # Zod schemas and ISBN validation
│   ├── services/         # Business logic layer
│   │   └── titleService.ts
│   └── test/             # Test files
│       ├── e2e/          # End-to-end tests
│       ├── api/          # API integration tests
│       ├── components/   # Component tests
│       └── services/     # Service unit tests
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── docs/                 # User documentation
│   └── user-guides/      # User guides
└── .agent-os/            # Agent OS project files
    └── specs/            # Feature specifications
```

## Next Steps

1. **Explore the UI**: Browse to http://localhost:3000/titles
2. **Create Some Titles**: Add a few test books
3. **Try Bulk Import**: Upload a CSV file (see [docs/user-guides/bulk-import-instructions.md](docs/user-guides/bulk-import-instructions.md))
4. **Review Documentation**: Check out the user guides in `docs/user-guides/`
5. **Run Tests**: Verify everything works with `npm test`

## Getting Help

- **Documentation**: See `docs/user-guides/` for detailed guides
- **API Reference**: See `docs/user-guides/api-endpoints.md`
- **Issues**: Check existing issues or create a new one
- **Logs**: Check browser console and terminal for errors

## What's Been Built

The Title Management System includes:

- ✅ Complete CRUD operations for book titles
- ✅ ISBN-13 validation and duplicate detection
- ✅ Price history tracking
- ✅ Search, filter, and pagination
- ✅ Bulk CSV import/export
- ✅ Full API with authentication
- ✅ 380+ tests across all layers
- ✅ Comprehensive user documentation

Enjoy exploring BookStock! 📚
