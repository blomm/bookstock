# Technical Stack

## Application Framework
Next.js 15+ (App Router)

## Language
TypeScript (strict mode)

## Database System
PostgreSQL 17+

## ORM
Prisma 5+

## JavaScript Framework
React (latest stable)

## Import Strategy
ES Modules

## Package Manager
pnpm

## Node Version
22 LTS

## Build Tool
Next.js compiler (SWC with Turbopack in development)

## API Style
Next.js Route Handlers (REST) with Zod validation

## Authentication
Clerk (JWT sessions)

## Authorization
Role-based access control (RBAC) via Prisma (User, Role, UserRole) + Clerk custom claims

## CSS Framework
Tailwind CSS 4.0+

## UI Component Library
shadcn/ui (built on Radix UI primitives)

## Admin Dashboard
refine.dev (for inventory management interface)

## Font Provider
Google Fonts (self-hosted via next/font for performance)

## Icon Library
Lucide React components

## Caching
Redis (Upstash) for sessions and data caching

## Background Jobs
Vercel Cron for automated tasks (stock alerts, report generation)

## Application Hosting
Vercel

## Hosting Region
EU (closest to primary UK user base)

## Database Hosting
Neon Serverless PostgreSQL

## Database Backups
Point-in-time recovery enabled with daily logical backups

## Asset Storage
Amazon S3 (for document uploads, reports)

## CDN
Vercel Edge Network for application; CloudFront for S3 assets

## Asset Access
Private with signed URLs (S3 presigned URLs)

## Environment Management
.env.local for development; Vercel Environments for production/staging

## CI/CD Platform
GitHub Actions (lint, typecheck, tests) + Vercel Git integration

## CI/CD Triggers
Pull requests → Preview deployments; Push to main → Production; Push to staging → Staging environment

## Testing Framework
- Vitest (unit tests)
- React Testing Library (integration tests)
- Playwright (end-to-end tests)

## Code Quality
ESLint + Prettier with Next.js recommended configurations

## Observability
Sentry for error tracking and performance monitoring

## Production Environment
main branch

## Staging Environment
staging branch

## Code Repository URL
https://github.com/[username]/bookstock