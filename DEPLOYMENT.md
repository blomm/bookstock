# Deployment Guide

This guide walks you through deploying the BookStock application to production using Vercel (hosting) and Neon (database).

## Prerequisites

- GitHub account with this repository
- Clerk account (for authentication)
- Credit card (for Neon and Vercel - both have generous free tiers)

## Step 1: Set Up Neon Database (5 minutes)

1. **Sign up for Neon**: https://neon.tech
   - Use GitHub to sign in (easiest)
   - Select the free tier

2. **Create a new project**:
   - Name: `bookstock-production`
   - Region: Choose **EU (Frankfurt)** or **EU (London)** (closest to UK users)
   - Postgres version: 17

3. **Get your connection string**:
   - After creation, click "Connection Details"
   - Copy the connection string that looks like:
     ```
     postgresql://[user]:[password]@[host]/[database]?sslmode=require
     ```
   - Save this for later (you'll need it for Vercel environment variables)

4. **Enable Point-in-Time Recovery** (optional but recommended):
   - Go to Project Settings → Backups
   - Enable PITR (included in free tier)

## Step 2: Configure Clerk for Production (5 minutes)

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com

2. **Update your application settings**:
   - Go to your application → Paths
   - Add your production domain when you get it from Vercel (you'll update this later)

3. **Get your production keys**:
   - Go to API Keys
   - Copy:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`
   - Save these for Vercel environment variables

4. **Set up webhook** (needed for user sync):
   - Go to Webhooks → Add Endpoint
   - Endpoint URL: `https://[your-vercel-domain]/api/webhooks/clerk` (you'll update this after Vercel deployment)
   - Subscribe to events: `user.created`, `user.updated`, `user.deleted`
   - Copy the webhook signing secret
   - Save as `CLERK_WEBHOOK_SECRET`

## Step 3: Deploy to Vercel (10 minutes)

1. **Sign up for Vercel**: https://vercel.com
   - Use GitHub to sign in
   - Import your repository

2. **Configure the project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

3. **Add Environment Variables**:
   Click "Environment Variables" and add these:

   ```bash
   # Database
   DATABASE_URL="[your-neon-connection-string-from-step-1]"

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="[from-clerk-dashboard]"
   CLERK_SECRET_KEY="[from-clerk-dashboard]"
   CLERK_WEBHOOK_SECRET="[from-clerk-webhook-setup]"

   # Clerk URLs (update domain after deployment)
   NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
   NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

   # Application
   NEXT_PUBLIC_APP_URL="https://[your-vercel-domain]"

   # Security (generate a random string)
   SESSION_SECRET="[generate-a-random-32-char-string]"
   AUTH_TOKEN_EXPIRY="7d"
   ```

   **Generate SESSION_SECRET**: Run in terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - You'll get a URL like `https://bookstock-abc123.vercel.app`

## Step 4: Run Database Migrations (5 minutes)

After your first deployment, you need to set up the database schema:

1. **Install Vercel CLI** (if you haven't already):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Link to your project**:
   ```bash
   vercel link
   ```

4. **Run migrations on production database**:
   ```bash
   vercel env pull .env.production
   DATABASE_URL="[your-neon-connection-string]" npx prisma migrate deploy
   ```

5. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

6. **(Optional) Seed initial data**:
   ```bash
   DATABASE_URL="[your-neon-connection-string]" npm run db:seed
   ```

## Step 5: Final Configuration (5 minutes)

1. **Update Clerk with Vercel domain**:
   - Go back to Clerk Dashboard
   - Update allowed origins to include your Vercel URL
   - Update webhook endpoint URL to: `https://[your-vercel-domain]/api/webhooks/clerk`

2. **Update environment variable**:
   - In Vercel dashboard, update `NEXT_PUBLIC_APP_URL` to your actual domain

3. **Test the deployment**:
   - Visit your Vercel URL
   - Try signing up/in
   - Create a test warehouse, title, and stock movement

## Step 6: Set Up Custom Domain (Optional)

1. **In Vercel dashboard**:
   - Go to Settings → Domains
   - Add your custom domain (e.g., `bookstock.yourdomain.com`)
   - Follow DNS setup instructions

2. **Update environment variables**:
   - Update `NEXT_PUBLIC_APP_URL` to your custom domain
   - Update Clerk URLs to use custom domain

## Ongoing Deployments

After initial setup, deployments are automatic:

- **Push to `main`** → Deploys to production automatically
- **Pull Requests** → Creates preview deployments automatically
- **Push to `staging`** → Can set up staging environment (optional)

## Monitoring

1. **Vercel Dashboard**: Monitor deployments, logs, and performance
2. **Neon Dashboard**: Monitor database usage, queries, and connection pooling
3. **Clerk Dashboard**: Monitor authentication events and user activity

## Troubleshooting

### Build fails on Vercel
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Try running `npm run build` locally first

### Database connection errors
- Verify `DATABASE_URL` is correct with `?sslmode=require`
- Check Neon project is not suspended (free tier requires occasional activity)
- Verify connection pooling settings in Neon

### Clerk authentication not working
- Verify webhook is set up correctly
- Check all Clerk environment variables are present
- Ensure domain is added to Clerk's allowed origins

## Cost Estimates

**Free tier limits (sufficient for demo/MVP):**
- **Vercel**: 100GB bandwidth, unlimited deployments
- **Neon**: 0.5GB storage, 191 compute hours/month
- **Clerk**: 10,000 monthly active users

**When you need to scale:**
- Vercel Pro: $20/month
- Neon Pro: $19/month (autoscaling compute)
- Clerk Pro: $25/month

## Security Checklist

Before going live:
- [ ] All environment variables are set in Vercel
- [ ] `SESSION_SECRET` is a strong random string
- [ ] Clerk webhook secret is configured
- [ ] Database uses SSL connections (`?sslmode=require`)
- [ ] CORS settings are properly configured
- [ ] Rate limiting is enabled (consider adding Vercel Edge Config)

## Next Steps

After successful deployment:
1. Set up monitoring with Sentry (see tech-stack.md)
2. Configure Redis with Upstash for caching (see tech-stack.md)
3. Set up S3 + CloudFront for file uploads (see tech-stack.md)
4. Enable Vercel Cron for automated tasks (see tech-stack.md)
5. Set up staging environment for testing before production

## Support

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- Clerk Docs: https://clerk.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
