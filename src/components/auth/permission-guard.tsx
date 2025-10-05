'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { ReactNode, useEffect, useState } from 'react'
import { has_permission, type UserRole } from '@/lib/clerk'

interface PermissionGuardProps {
  children: ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requiredRole?: UserRole
  requiredRoles?: UserRole[]
  requireAll?: boolean
  fallback?: ReactNode
  loading?: ReactNode
}

export function PermissionGuard({
  children,
  requiredPermission,
  requiredPermissions,
  requiredRole,
  requiredRoles,
  requireAll = false,
  fallback = null,
  loading = null
}: PermissionGuardProps) {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [hasAccess, setHasAccess] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!isLoaded) {
      setIsChecking(true)
      return
    }

    if (!isSignedIn || !user) {
      setHasAccess(false)
      setIsChecking(false)
      return
    }

    const userRole = user.publicMetadata?.role as UserRole

    // Check role-based access
    if (requiredRole || requiredRoles) {
      const rolesToCheck = requiredRoles || (requiredRole ? [requiredRole] : [])
      const hasRole = rolesToCheck.includes(userRole)

      if (!hasRole) {
        setHasAccess(false)
        setIsChecking(false)
        return
      }
    }

    // Check permission-based access
    if (requiredPermission || requiredPermissions) {
      const permissionsToCheck = requiredPermissions || (requiredPermission ? [requiredPermission] : [])

      if (requireAll) {
        // User must have ALL permissions
        const hasAllPermissions = permissionsToCheck.every(permission =>
          has_permission(userRole, permission)
        )
        setHasAccess(hasAllPermissions)
      } else {
        // User must have AT LEAST ONE permission
        const hasAnyPermission = permissionsToCheck.some(permission =>
          has_permission(userRole, permission)
        )
        setHasAccess(hasAnyPermission)
      }
    } else {
      // If no specific permissions required but role check passed
      setHasAccess(true)
    }

    setIsChecking(false)
  }, [
    isLoaded,
    isSignedIn,
    user,
    requiredPermission,
    requiredPermissions,
    requiredRole,
    requiredRoles,
    requireAll
  ])

  if (isChecking) {
    return loading || null
  }

  if (!hasAccess) {
    return fallback || null
  }

  return <>{children}</>
}

// Convenience components for common use cases
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard requiredRole="admin" fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}

export function ManagerOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard
      requiredRoles={['admin', 'operations_manager']}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  )
}

export function AuthenticatedOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return null
  }

  if (!isSignedIn) {
    return fallback || null
  }

  return <>{children}</>
}