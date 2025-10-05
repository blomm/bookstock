'use client'

import { ReactNode } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { UserRole } from '@/lib/clerk'

interface ProtectedSectionProps {
  children: ReactNode
  title?: string
  requiredPermission?: string
  requiredPermissions?: string[]
  requiredRole?: UserRole
  requiredRoles?: UserRole[]
  requireAll?: boolean
  fallback?: ReactNode
  className?: string
}

export function ProtectedSection({
  children,
  title,
  requiredPermission,
  requiredPermissions,
  requiredRole,
  requiredRoles,
  requireAll = false,
  fallback,
  className = ''
}: ProtectedSectionProps) {
  const defaultFallback = (
    <div className={`bg-gray-50 border-2 border-gray-200 border-dashed rounded-lg p-8 text-center ${className}`}>
      <div className="text-gray-400">
        <svg
          className="mx-auto h-12 w-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          {title ? `Access Required for ${title}` : 'Access Required'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          You don&apos;t have permission to view this section.
        </p>
      </div>
    </div>
  )

  return (
    <PermissionGuard
      requiredPermission={requiredPermission}
      requiredPermissions={requiredPermissions}
      requiredRole={requiredRole}
      requiredRoles={requiredRoles}
      requireAll={requireAll}
      fallback={fallback || defaultFallback}
    >
      <div className={className}>
        {title && (
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </PermissionGuard>
  )
}

// Specific section variants for common resources
export function AdminSection({ children, title, className }: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <ProtectedSection
      requiredRole="admin"
      title={title}
      className={className}
    >
      {children}
    </ProtectedSection>
  )
}

export function ManagerSection({ children, title, className }: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <ProtectedSection
      requiredRoles={['admin', 'operations_manager']}
      title={title}
      className={className}
    >
      {children}
    </ProtectedSection>
  )
}

export function InventorySection({ children, title, className }: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <ProtectedSection
      requiredPermissions={['inventory:read', 'inventory:update']}
      title={title}
      className={className}
    >
      {children}
    </ProtectedSection>
  )
}

export function TitleManagementSection({ children, title, className }: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <ProtectedSection
      requiredPermissions={['title:read', 'title:create', 'title:update']}
      title={title}
      className={className}
    >
      {children}
    </ProtectedSection>
  )
}

export function ReportsSection({ children, title, className }: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <ProtectedSection
      requiredPermission="report:read"
      title={title}
      className={className}
    >
      {children}
    </ProtectedSection>
  )
}