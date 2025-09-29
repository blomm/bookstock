'use client'

import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { has_permission, type UserRole } from '@/lib/clerk'

interface ProtectedRouteProps {
  children: React.ReactNode
  required_role?: UserRole | UserRole[]
  required_permission?: string
  fallback?: React.ReactNode
}

/**
 * Protected Route Component
 *
 * This component wraps pages/components that require authentication
 * or specific permissions. It redirects unauthenticated users to
 * sign-in and unauthorized users to access-denied.
 */

export function ProtectedRoute({
  children,
  required_role,
  required_permission,
  fallback = <div>Loading...</div>
}: ProtectedRouteProps) {
  const { isSignedIn, isLoaded, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    // Redirect to sign-in if not authenticated
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

    // Check role requirements
    if (required_role && user) {
      const user_role = user.publicMetadata?.role as UserRole
      const required_roles = Array.isArray(required_role) ? required_role : [required_role]

      if (!user_role || !required_roles.includes(user_role)) {
        router.push('/access-denied')
        return
      }
    }

    // Check permission requirements
    if (required_permission && user) {
      const user_role = user.publicMetadata?.role as UserRole

      if (!has_permission(user_role, required_permission)) {
        router.push('/access-denied')
        return
      }
    }
  }, [isLoaded, isSignedIn, user, required_role, required_permission, router])

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return fallback
  }

  // Show loading state while redirecting
  if (!isSignedIn) {
    return fallback
  }

  // Check authorization
  if (required_role || required_permission) {
    if (!user) {
      return fallback
    }

    const user_role = user.publicMetadata?.role as UserRole

    // Check role
    if (required_role) {
      const required_roles = Array.isArray(required_role) ? required_role : [required_role]
      if (!user_role || !required_roles.includes(user_role)) {
        return fallback
      }
    }

    // Check permission
    if (required_permission && !has_permission(user_role, required_permission)) {
      return fallback
    }
  }

  // Render children if all checks pass
  return <>{children}</>
}

/**
 * Higher-order component for protecting pages
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    required_role?: UserRole | UserRole[]
    required_permission?: string
  }
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute
        required_role={options?.required_role}
        required_permission={options?.required_permission}
      >
        <Component {...props} />
      </ProtectedRoute>
    )
  }
}

/**
 * Hook for checking permissions in components
 */
export function usePermissions() {
  const { user } = useAuth()
  const user_role = user?.publicMetadata?.role as UserRole

  return {
    user_role,
    has_permission: (permission: string) => has_permission(user_role, permission),
    has_role: (role: UserRole | UserRole[]) => {
      if (!user_role) return false
      const roles = Array.isArray(role) ? role : [role]
      return roles.includes(user_role)
    }
  }
}