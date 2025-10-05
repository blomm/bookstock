'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { has_permission, type UserRole } from '@/lib/clerk'

export interface PermissionHookResult {
  isLoaded: boolean
  isSignedIn: boolean
  userRole: UserRole | undefined
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  canAccess: (resource: string, action: string) => boolean
  isAdmin: boolean
  isManager: boolean
  isClerk: boolean
  isReadOnly: boolean
}

export function usePermissions(): PermissionHookResult {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [userRole, setUserRole] = useState<UserRole | undefined>(undefined)

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      setUserRole(user.publicMetadata?.role as UserRole)
    } else {
      setUserRole(undefined)
    }
  }, [isLoaded, isSignedIn, user])

  const hasPermission = (permission: string): boolean => {
    if (!userRole) return false
    return has_permission(userRole, permission)
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!userRole) return false
    return permissions.some(permission => has_permission(userRole, permission))
  }

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!userRole) return false
    return permissions.every(permission => has_permission(userRole, permission))
  }

  const hasRole = (role: UserRole): boolean => {
    return userRole === role
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!userRole) return false
    return roles.includes(userRole)
  }

  const canAccess = (resource: string, action: string): boolean => {
    const permission = `${resource}:${action}`
    return hasPermission(permission)
  }

  return {
    isLoaded,
    isSignedIn: isSignedIn || false,
    userRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    canAccess,
    isAdmin: hasRole('admin'),
    isManager: hasAnyRole(['admin', 'operations_manager']),
    isClerk: hasRole('inventory_clerk'),
    isReadOnly: hasRole('read_only_user')
  }
}

export function useIsAuthorized(
  requiredPermission?: string,
  requiredPermissions?: string[],
  requiredRole?: UserRole,
  requiredRoles?: UserRole[],
  requireAll = false
): boolean {
  const {
    isLoaded,
    isSignedIn,
    userRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole
  } = usePermissions()

  if (!isLoaded || !isSignedIn || !userRole) {
    return false
  }

  // Check role-based access
  if (requiredRole || requiredRoles) {
    const roleCheck = requiredRole
      ? hasRole(requiredRole)
      : requiredRoles
      ? hasAnyRole(requiredRoles)
      : true

    if (!roleCheck) {
      return false
    }
  }

  // Check permission-based access
  if (requiredPermission || requiredPermissions) {
    const permissionsToCheck = requiredPermissions || (requiredPermission ? [requiredPermission] : [])

    if (requireAll) {
      return hasAllPermissions(permissionsToCheck)
    } else {
      return hasAnyPermission(permissionsToCheck)
    }
  }

  return true
}

export function useResourceAccess(resource: string) {
  const { canAccess } = usePermissions()

  return {
    canRead: canAccess(resource, 'read'),
    canCreate: canAccess(resource, 'create'),
    canUpdate: canAccess(resource, 'update'),
    canDelete: canAccess(resource, 'delete'),
    hasAnyAccess: canAccess(resource, 'read') ||
                   canAccess(resource, 'create') ||
                   canAccess(resource, 'update') ||
                   canAccess(resource, 'delete')
  }
}