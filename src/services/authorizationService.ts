import { prisma } from '@/lib/database'
import { has_permission, type UserRole } from '@/lib/clerk'

export class AuthorizationService {
  hasPermission(role: UserRole | undefined, permission: string): boolean {
    if (!role || !permission || typeof permission !== 'string') {
      return false
    }

    const trimmedPermission = permission.trim()
    if (!trimmedPermission || !trimmedPermission.includes(':')) {
      return false
    }

    return has_permission(role, trimmedPermission)
  }

  hasAnyPermission(role: UserRole | undefined, permissions: string[]): boolean {
    if (!role || !permissions || permissions.length === 0) {
      return false
    }

    return permissions.some(permission => this.hasPermission(role, permission))
  }

  hasAllPermissions(role: UserRole | undefined, permissions: string[]): boolean {
    if (!role || !permissions || permissions.length === 0) {
      return false
    }

    return permissions.every(permission => this.hasPermission(role, permission))
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const userWithRoles = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            where: {
              is_active: true,
              OR: [
                { expires_at: null },
                { expires_at: { gt: new Date() } }
              ]
            },
            include: {
              role: {
                where: { is_active: true }
              }
            }
          }
        }
      })

      if (!userWithRoles) {
        return []
      }

      const allPermissions = new Set<string>()

      userWithRoles.userRoles.forEach(userRole => {
        if (userRole.role && Array.isArray(userRole.role.permissions)) {
          userRole.role.permissions.forEach(permission => {
            if (typeof permission === 'string') {
              allPermissions.add(permission)
            }
          })
        }
      })

      return Array.from(allPermissions)
    } catch (error) {
      console.error('Error getting user permissions:', error)
      return []
    }
  }

  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId)

      // Check exact permission match
      if (userPermissions.includes(permission)) {
        return true
      }

      // Check wildcard permissions
      const [resource, action] = permission.split(':')
      if (!resource || !action) {
        return false
      }

      const wildcardPermission = `${resource}:*`
      if (userPermissions.includes(wildcardPermission)) {
        return true
      }

      return false
    } catch (error) {
      console.error('Error checking user permission:', error)
      return false
    }
  }

  canAccessResource(role: UserRole | undefined, resource: string, action: string): boolean {
    if (!role || !resource || !action) {
      return false
    }

    const permission = `${resource}:${action}`
    return this.hasPermission(role, permission)
  }

  getAccessibleResources(role: UserRole | undefined): Record<string, string[]> {
    if (!role) {
      return {}
    }

    const resources: Record<string, string[]> = {}

    // Get role permissions from the ROLE_PERMISSIONS mapping
    const { ROLE_PERMISSIONS } = require('@/lib/clerk')
    const rolePermissions = ROLE_PERMISSIONS[role] || []

    rolePermissions.forEach((permission: string) => {
      if (permission.includes(':')) {
        const [resource, actions] = permission.split(':')

        if (!resources[resource]) {
          resources[resource] = []
        }

        if (actions === '*') {
          // For wildcard permissions, add all CRUD actions
          resources[resource] = ['create', 'read', 'update', 'delete']
        } else {
          // Split comma-separated actions
          const actionList = actions.split(',').map(a => a.trim())
          actionList.forEach(action => {
            if (!resources[resource].includes(action)) {
              resources[resource].push(action)
            }
          })
        }
      }
    })

    return resources
  }

  async checkResourceOwnership(
    userId: string,
    resource: string,
    resourceId: string,
    ownershipField: string = 'user_id'
  ): Promise<boolean> {
    try {
      const resourceModel = (prisma as any)[resource]
      if (!resourceModel) {
        return false
      }

      const record = await resourceModel.findUnique({
        where: { id: resourceId },
        select: { [ownershipField]: true }
      })

      return record && record[ownershipField] === userId
    } catch (error) {
      console.error('Error checking resource ownership:', error)
      return false
    }
  }

  async getUserRoles(userId: string): Promise<Array<{ role: any; userRole: any }>> {
    try {
      const userWithRoles = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            where: {
              is_active: true,
              OR: [
                { expires_at: null },
                { expires_at: { gt: new Date() } }
              ]
            },
            include: {
              role: {
                where: { is_active: true }
              }
            }
          }
        }
      })

      if (!userWithRoles) {
        return []
      }

      return userWithRoles.userRoles
        .filter(userRole => userRole.role)
        .map(userRole => ({
          role: userRole.role,
          userRole: {
            id: userRole.id,
            assigned_at: userRole.assigned_at,
            assigned_by: userRole.assigned_by,
            expires_at: userRole.expires_at
          }
        }))
    } catch (error) {
      console.error('Error getting user roles:', error)
      return []
    }
  }

  isRoleHigher(role1: UserRole, role2: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      admin: 5,
      operations_manager: 4,
      financial_controller: 3,
      inventory_clerk: 2,
      read_only_user: 1
    }

    return (roleHierarchy[role1] || 0) > (roleHierarchy[role2] || 0)
  }

  async canUserAssignRole(assignerId: string, targetRole: UserRole): Promise<boolean> {
    try {
      const assignerRoles = await this.getUserRoles(assignerId)

      // Check if assigner has user management permissions
      const hasUserManagementPermission = await this.userHasPermission(assignerId, 'user:update')
      if (!hasUserManagementPermission) {
        return false
      }

      // Admins can assign any role
      const isAdmin = assignerRoles.some(({ role }) => role.name === 'admin')
      if (isAdmin) {
        return true
      }

      // Non-admins can only assign roles lower than their highest role
      const assignerHighestRole = assignerRoles.reduce((highest, { role }) => {
        if (!highest || this.isRoleHigher(role.name as UserRole, highest)) {
          return role.name as UserRole
        }
        return highest
      }, null as UserRole | null)

      if (!assignerHighestRole) {
        return false
      }

      return this.isRoleHigher(assignerHighestRole, targetRole)
    } catch (error) {
      console.error('Error checking role assignment permission:', error)
      return false
    }
  }

  validatePermissionString(permission: string): boolean {
    if (!permission || typeof permission !== 'string') {
      return false
    }

    const trimmed = permission.trim()
    if (!trimmed) {
      return false
    }

    // Check basic format: resource:action
    const parts = trimmed.split(':')
    if (parts.length !== 2) {
      return false
    }

    const [resource, action] = parts
    if (!resource || !action) {
      return false
    }

    // Valid resource names (alphanumeric and underscore)
    const resourcePattern = /^[a-z][a-z0-9_]*$/
    if (!resourcePattern.test(resource)) {
      return false
    }

    // Valid action patterns
    const actionPattern = /^(\*|[a-z][a-z0-9_]*(?:,[a-z][a-z0-9_]*)*)$/
    if (!actionPattern.test(action)) {
      return false
    }

    return true
  }

  async getEffectivePermissions(userId: string): Promise<{
    permissions: string[]
    roles: Array<{
      name: string
      description: string
      assigned_at: Date
      assigned_by: string | null
      expires_at: Date | null
    }>
  }> {
    try {
      const userRoles = await this.getUserRoles(userId)
      const permissions = await this.getUserPermissions(userId)

      const roles = userRoles.map(({ role, userRole }) => ({
        name: role.name,
        description: role.description || '',
        assigned_at: userRole.assigned_at,
        assigned_by: userRole.assigned_by,
        expires_at: userRole.expires_at
      }))

      return {
        permissions: permissions.sort(),
        roles
      }
    } catch (error) {
      console.error('Error getting effective permissions:', error)
      return {
        permissions: [],
        roles: []
      }
    }
  }
}

export const authorizationService = new AuthorizationService()