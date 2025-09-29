/**
 * Clerk Authentication Configuration
 *
 * This file contains configuration and utilities for Clerk authentication
 * including environment variable validation and helper functions.
 */

// Validate required Clerk environment variables
const required_clerk_env_vars = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
}

// Validate that all required environment variables are present
export const validate_clerk_config = (): void => {
  const missing_vars: string[] = []

  for (const [key, value] of Object.entries(required_clerk_env_vars)) {
    if (!value || value === 'placeholder' || value.includes('placeholder')) {
      missing_vars.push(key)
    }
  }

  if (missing_vars.length > 0) {
    console.warn(`⚠️  Clerk configuration incomplete. Missing or placeholder values for: ${missing_vars.join(', ')}`)
    console.warn('📝 Please update your .env.local file with real Clerk values from https://clerk.com/')
  }
}

// Clerk configuration object
export const clerk_config = {
  publishable_key: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  secret_key: process.env.CLERK_SECRET_KEY!,
  webhook_secret: process.env.CLERK_WEBHOOK_SECRET!,
  sign_in_url: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
  sign_up_url: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
  after_sign_in_url: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/dashboard',
  after_sign_up_url: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/dashboard',
}

// User role types based on the authentication spec
export type UserRole = 'admin' | 'operations_manager' | 'inventory_clerk' | 'financial_controller' | 'read_only_user'

// Default role for new users
export const DEFAULT_USER_ROLE: UserRole = 'read_only_user'

// Role permissions mapping
export const ROLE_PERMISSIONS = {
  admin: [
    'title:read', 'title:create', 'title:update', 'title:delete',
    'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
    'warehouse:read', 'warehouse:create', 'warehouse:update', 'warehouse:delete',
    'report:read', 'report:create', 'report:export',
    'user:read', 'user:create', 'user:update', 'user:delete',
    'role:read', 'role:create', 'role:update', 'role:delete',
    'audit:read'
  ],
  operations_manager: [
    'title:read', 'title:create', 'title:update',
    'inventory:read', 'inventory:create', 'inventory:update',
    'warehouse:read', 'warehouse:create', 'warehouse:update',
    'report:read', 'report:create', 'report:export',
    'user:read'
  ],
  inventory_clerk: [
    'title:read',
    'inventory:read', 'inventory:update',
    'warehouse:read',
    'report:read'
  ],
  financial_controller: [
    'title:read',
    'inventory:read',
    'warehouse:read',
    'report:read', 'report:create', 'report:export',
    'user:read'
  ],
  read_only_user: [
    'title:read',
    'inventory:read',
    'warehouse:read',
    'report:read'
  ]
} as const

// Helper function to check if a role has a specific permission
export const has_permission = (role: UserRole | undefined, permission: string): boolean => {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission as any) || false
}

// Helper function to get user role from Clerk user metadata
export const get_user_role = (user: any): UserRole | undefined => {
  return user?.publicMetadata?.role as UserRole
}

// Initialize configuration validation on module load
if (typeof window === 'undefined') {
  validate_clerk_config()
}