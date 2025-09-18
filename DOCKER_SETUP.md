# Docker Setup for BookStock

This document describes how to set up and use Docker for local development of the BookStock application.

## Prerequisites

- Docker and Docker Compose installed on your machine
- Node.js 22 LTS
- pnpm package manager

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd stockly2
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start development environment:**
   ```bash
   npm run dev:full
   ```
   This command will:
   - Start PostgreSQL containers
   - Run database migrations
   - Seed the database
   - Start the Next.js development server

## Docker Services

### PostgreSQL Development Database
- **Container**: `bookstock-postgres-dev`
- **Port**: `5432`
- **Database**: `bookstock_dev`
- **User**: `bookstock`
- **Password**: `bookstock_dev_password`

### PostgreSQL Test Database
- **Container**: `bookstock-postgres-test`
- **Port**: `5433`
- **Database**: `bookstock_test`
- **User**: `test`
- **Password**: `test`

### Redis Cache (Optional)
- **Container**: `bookstock-redis`
- **Port**: `6379`
- **Profile**: `cache` (not started by default)

## Available Commands

### Database Management
```bash
# Start all services
npm run docker:up

# Start only test database
npm run docker:test

# Stop all services
npm run docker:down

# Stop test database
npm run docker:test-down

# Clean up (removes volumes)
npm run docker:clean

# View logs
npm run docker:logs
```

### Development Workflow
```bash
# Full setup (database + app)
npm run dev:full

# Setup database only
npm run db:setup

# Setup test database
npm run test:setup

# Regular development (assumes DB running)
npm run dev
```

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

## Environment Configuration

Create `.env.local` from `.env.example`:

```bash
# Required for development
DATABASE_URL="postgresql://bookstock:bookstock_dev_password@localhost:5432/bookstock_dev"
TEST_DATABASE_URL="postgresql://test:test@localhost:5433/bookstock_test"

# Add your Clerk authentication keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your_key_here"
CLERK_SECRET_KEY="your_secret_here"
```

## Testing with Docker

1. **Start test database:**
   ```bash
   npm run test:setup
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Clean up after testing:**
   ```bash
   npm run docker:test-down
   ```

## Troubleshooting

### Database Connection Issues
- Ensure Docker is running
- Check if ports 5432/5433 are available
- Verify environment variables in `.env.local`

### Container Health
```bash
# Check container status
docker ps

# Check specific container logs
docker logs bookstock-postgres-dev
docker logs bookstock-postgres-test
```

### Reset Everything
```bash
# Nuclear option - removes all containers and volumes
npm run docker:clean
npm run db:setup
```

## Production Considerations

- This Docker setup is for **local development only**
- Production uses Neon Serverless PostgreSQL
- Redis cache can be enabled with `--profile cache` when needed
- Container images can be customized for production deployment

## File Structure

```
stockly2/
├── docker-compose.yml          # Docker services configuration
├── .dockerignore              # Files to exclude from Docker context
├── .env.example              # Environment variables template
├── .env.local               # Your local environment (not in git)
└── DOCKER_SETUP.md         # This documentation
```