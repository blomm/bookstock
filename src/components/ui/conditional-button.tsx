'use client'

import { ReactNode } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { UserRole } from '@/lib/clerk'

interface ConditionalButtonProps {
  children: ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requiredRole?: UserRole
  requiredRoles?: UserRole[]
  requireAll?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function ConditionalButton({
  children,
  requiredPermission,
  requiredPermissions,
  requiredRole,
  requiredRoles,
  requireAll = false,
  disabled = false,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md'
}: ConditionalButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center rounded-md font-medium transition-colors
    focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
  `

  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const buttonClasses = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${className}
  `

  return (
    <PermissionGuard
      requiredPermission={requiredPermission}
      requiredPermissions={requiredPermissions}
      requiredRole={requiredRole}
      requiredRoles={requiredRoles}
      requireAll={requireAll}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={buttonClasses}
      >
        {children}
      </button>
    </PermissionGuard>
  )
}

// Specific button variants for common actions
export function CreateButton({ children, onClick, disabled, className, requiredPermission }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  requiredPermission: string
}) {
  return (
    <ConditionalButton
      requiredPermission={requiredPermission}
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant="primary"
    >
      {children}
    </ConditionalButton>
  )
}

export function EditButton({ children, onClick, disabled, className, requiredPermission }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  requiredPermission: string
}) {
  return (
    <ConditionalButton
      requiredPermission={requiredPermission}
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant="secondary"
      size="sm"
    >
      {children}
    </ConditionalButton>
  )
}

export function DeleteButton({ children, onClick, disabled, className, requiredPermission }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  requiredPermission: string
}) {
  return (
    <ConditionalButton
      requiredPermission={requiredPermission}
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant="danger"
      size="sm"
    >
      {children}
    </ConditionalButton>
  )
}

export function AdminButton({ children, onClick, disabled, className }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <ConditionalButton
      requiredRole="admin"
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant="primary"
    >
      {children}
    </ConditionalButton>
  )
}