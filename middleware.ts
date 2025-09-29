import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const is_public_route = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth/webhook',
  '/api/health'
])

// Define admin-only routes
const is_admin_route = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)'
])

// Define protected API routes
const is_protected_api_route = createRouteMatcher([
  '/api/titles(.*)',
  '/api/inventory(.*)',
  '/api/warehouses(.*)',
  '/api/reports(.*)',
  '/api/users(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to pass through
  if (is_public_route(req)) {
    return NextResponse.next()
  }

  // Get authentication info
  const { userId, user } = await auth()

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const sign_in_url = new URL('/sign-in', req.url)
    sign_in_url.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(sign_in_url)
  }

  // Check admin routes
  if (is_admin_route(req)) {
    const user_role = user?.publicMetadata?.role as string
    if (user_role !== 'admin') {
      return NextResponse.redirect(new URL('/access-denied', req.url))
    }
  }

  // Check protected API routes
  if (is_protected_api_route(req)) {
    // All authenticated users can access basic API routes
    // More granular permissions will be checked in individual route handlers
    return NextResponse.next()
  }

  // Allow authenticated users to access other protected routes
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}