# Tech Stack

## Context


App Framework: Next.js (App Router) 15+
Language: TypeScript (strict)
Primary Database: PostgreSQL 17+
ORM: Prisma 5+

API Style: Next.js Route Handlers (REST) with Zod validation (tRPC optional)

Authentication: Clerk (JWT sessions; Auth0 as fallback)

Authorization: Role-based (RBAC) via Prisma (User, Role, UserRole) + Clerk custom claims

JavaScript Framework: React latest stable

Build Tool/Bundler: Next.js compiler (SWC; Turbopack in dev)

Import Strategy: ES Modules

Package Manager: pnpm

Node Version: 22 LTS

CSS Framework: Tailwind CSS 4.0+

UI Components: shadcn/ui (Radix UI primitives)

Font Provider: Google Fonts

Font Loading: Next.js self-hosted (next/font) for performance

Icons: Lucide React components

Admin Dashboard: refine.dev (default) or React Admin powered by Next.js API routes

Caching (optional): Redis (Upstash or self-hosted) for sessions/cache/invalidation

Background Jobs / Cron: Vercel Cron (or Inngest/Trigger.dev if workflows needed)

Application Hosting: Vercel

Hosting Region: Closest to primary user base

Database Hosting: Neon Serverless PostgreSQL

Database Backups: PITR enabled; daily logical backups retained

Asset Storage: Amazon S3 (or Cloudflare R2)

CDN: CloudFront for S3 assets; Vercel Edge Network for app

Asset Access: Private with signed URLs (S3 presigned or UploadThing)

Env & Secrets: .env.local in dev; Vercel Environments for prod/stage; optional Doppler/1Password

CI/CD Platform: GitHub Actions (lint, typecheck, tests) + Vercel Git integration

CI/CD Trigger: PR → Preview; push to main/staging → deploy to Prod/Staging

Tests: Vitest (unit), React Testing Library (integration), Playwright (e2e) run before deployment

Linting & Format: ESLint + Prettier (Next.js/recommended configs)

Observability: Sentry (errors) + OpenTelemetry (traces) optional

Production Environment: main branch

Staging Environment: staging branch
