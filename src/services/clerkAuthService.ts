import { createClerkClient } from '@clerk/backend'
import { ROLE_PERMISSIONS, type UserRole } from '@/lib/clerk'

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
})

/**
 * Clerk-based Authorization Service
 *
 * This service handles all role and permission management using Clerk's publicMetadata.
 * Role definitions and permissions are stored in code (ROLE_PERMISSIONS in /lib/clerk.ts).
 */
export class ClerkAuthService {
  /**
   * Get a user's role from Clerk publicMetadata
   */
  async getUserRole(clerkId: string): Promise<UserRole | null> {
    try {
      const user = await clerkClient.users.getUser(clerkId)
      const role = user.publicMetadata?.role as UserRole | undefined
      return role || null
    } catch (error) {
      console.error(`Error fetching user role for ${clerkId}:`, error)
      return null
    }
  }

  /**
   * Get all permissions for a user based on their role
   */
  async getUserPermissions(clerkId: string): Promise<string[]> {
    const role = await this.getUserRole(clerkId)
    if (!role) {
      return []
    }
    return [...(ROLE_PERMISSIONS[role] || [])]
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(clerkId: string, requiredPermission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(clerkId)

    // Check for exact match
    if (permissions.includes(requiredPermission)) {
      return true
    }

    // Check for wildcard permissions (e.g., "user:*" covers "user:read", "user:create", etc.)
    for (const permission of permissions) {
      if (permission.endsWith(':*')) {
        const resource = permission.slice(0, -2)
        if (requiredPermission.startsWith(resource + ':')) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if user has ANY of the required permissions
   */
  async hasAnyPermission(clerkId: string, requiredPermissions: string[]): Promise<boolean> {
    for (const permission of requiredPermissions) {
      if (await this.hasPermission(clerkId, permission)) {
        return true
      }
    }
    return false
  }

  /**
   * Check if user has ALL of the required permissions
   */
  async hasAllPermissions(clerkId: string, requiredPermissions: string[]): Promise<boolean> {
    for (const permission of requiredPermissions) {
      if (!(await this.hasPermission(clerkId, permission))) {
        return false
      }
    }
    return true
  }

  /**
   * Update a user's role in Clerk publicMetadata
   */
  async updateUserRole(clerkId: string, newRole: UserRole): Promise<void> {
    // Validate that the role exists in our role definitions
    if (!ROLE_PERMISSIONS[newRole]) {
      throw new Error(`Invalid role: ${newRole}. Valid roles are: ${Object.keys(ROLE_PERMISSIONS).join(', ')}`)
    }

    try {
      const user = await clerkClient.users.getUser(clerkId)

      await clerkClient.users.updateUser(clerkId, {
        publicMetadata: {
          ...user.publicMetadata,
          role: newRole
        }
      })
    } catch (error) {
      console.error(`Error updating user role for ${clerkId}:`, error)
      throw new Error('Failed to update user role')
    }
  }

  /**
   * Remove a user's role (set to null)
   */
  async removeUserRole(clerkId: string): Promise<void> {
    try {
      const user = await clerkClient.users.getUser(clerkId)

      await clerkClient.users.updateUser(clerkId, {
        publicMetadata: {
          ...user.publicMetadata,
          role: null
        }
      })
    } catch (error) {
      console.error(`Error removing user role for ${clerkId}:`, error)
      throw new Error('Failed to remove user role')
    }
  }

  /**
   * Get all available roles with their permissions
   */
  getAvailableRoles(): Array<{
    name: UserRole
    permissions: string[]
  }> {
    return Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) => ({
      name: name as UserRole,
      permissions: [...permissions]
    }))
  }

  /**
   * Get role details including permissions
   */
  getRoleDetails(role: UserRole): {
    name: UserRole
    permissions: string[]
  } | null {
    const permissions = ROLE_PERMISSIONS[role]
    if (!permissions) {
      return null
    }
    return {
      name: role,
      permissions: [...permissions]
    }
  }

  /**
   * List all users with their roles from Clerk
   */
  async listUsersWithRoles(options?: {
    limit?: number
    offset?: number
  }): Promise<Array<{
    clerkId: string
    email: string
    firstName: string | null
    lastName: string | null
    role: UserRole | null
    permissions: string[]
  }>> {
    try {
      const { data: users } = await clerkClient.users.getUserList({
        limit: options?.limit || 100,
        offset: options?.offset || 0
      })

      return users.map(user => {
        const role = user.publicMetadata?.role as UserRole | null
        const permissions = role ? [...(ROLE_PERMISSIONS[role] || [])] : []
        const primaryEmail = user.emailAddresses.find(
          email => email.id === user.primaryEmailAddressId
        )?.emailAddress || user.emailAddresses[0]?.emailAddress || ''

        return {
          clerkId: user.id,
          email: primaryEmail,
          firstName: user.firstName,
          lastName: user.lastName,
          role,
          permissions
        }
      })
    } catch (error) {
      console.error('Error listing users with roles:', error)
      throw new Error('Failed to list users')
    }
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(clerkId: string, requiredRole: UserRole): Promise<boolean> {
    const userRole = await this.getUserRole(clerkId)
    return userRole === requiredRole
  }

  /**
   * Check if a user has ANY of the required roles
   */
  async hasAnyRole(clerkId: string, requiredRoles: UserRole[]): Promise<boolean> {
    const userRole = await this.getUserRole(clerkId)
    return userRole !== null && requiredRoles.includes(userRole)
  }

  /**
   * Get effective permissions for a user (for display purposes)
   */
  async getEffectivePermissions(clerkId: string): Promise<{
    role: UserRole | null
    permissions: string[]
  }> {
    const role = await this.getUserRole(clerkId)
    const permissions = await this.getUserPermissions(clerkId)

    return {
      role,
      permissions
    }
  }
}

export const clerkAuthService = new ClerkAuthService()
