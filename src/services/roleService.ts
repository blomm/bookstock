import { prisma } from '@/lib/db'
import { Role, UserRole, Prisma } from '@prisma/client'

export interface CreateRoleInput {
  name: string
  description?: string
  permissions: string[]
  isSystem?: boolean
}

export interface UpdateRoleInput {
  name?: string
  description?: string
  permissions?: string[]
  isActive?: boolean
}

export interface RoleWithUsers extends Role {
  userRoles: Array<{
    id: string
    user: {
      id: string
      email: string
      firstName: string | null
      lastName: string | null
    }
    assignedAt: Date
    expiresAt: Date | null
    isActive: boolean
  }>
}

export interface AssignRoleInput {
  userId: string
  roleId: string
  assignedBy?: string
  expiresAt?: Date
}

export class RoleService {
  async createRole(data: CreateRoleInput): Promise<Role> {
    try {
      return await prisma.role.create({
        data: {
          name: data.name,
          description: data.description,
          permissions: data.permissions,
          isSystem: data.isSystem || false
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Role with this name already exists')
        }
      }
      throw error
    }
  }

  async getRoleById(id: string): Promise<Role | null> {
    return await prisma.role.findUnique({
      where: { id }
    })
  }

  async getRoleByName(name: string): Promise<Role | null> {
    return await prisma.role.findUnique({
      where: { name }
    })
  }

  async getRoleWithUsers(id: string): Promise<RoleWithUsers | null> {
    return await prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    }) as RoleWithUsers | null
  }

  async updateRole(id: string, data: UpdateRoleInput): Promise<Role> {
    try {
      const role = await this.getRoleById(id)
      if (!role) {
        throw new Error('Role not found')
      }

      if (role.isSystem && data.name) {
        throw new Error('Cannot modify system role name')
      }

      return await prisma.role.update({
        where: { id },
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Role name already exists')
        }
        if (error.code === 'P2025') {
          throw new Error('Role not found')
        }
      }
      throw error
    }
  }

  async deleteRole(id: string): Promise<Role> {
    try {
      const role = await this.getRoleById(id)
      if (!role) {
        throw new Error('Role not found')
      }

      if (role.isSystem) {
        throw new Error('Cannot delete system role')
      }

      return await prisma.role.delete({
        where: { id }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Role not found')
        }
      }
      throw error
    }
  }

  async listRoles(options: {
    page?: number
    limit?: number
    isActive?: boolean
    isSystem?: boolean
    search?: string
    includeUsers?: boolean
  } = {}): Promise<{
    roles: Role[] | RoleWithUsers[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const {
      page = 1,
      limit = 20,
      isActive,
      isSystem,
      search,
      includeUsers = false
    } = options

    const skip = (page - 1) * limit

    const where: Prisma.RoleWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(isSystem !== undefined && { isSystem }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const include = includeUsers ? {
      userRoles: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    } : undefined

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.role.count({ where })
    ])

    return {
      roles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  async assignRoleToUser(data: AssignRoleInput): Promise<UserRole> {
    try {
      // Check if role assignment already exists
      const existingAssignment = await prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId: data.userId,
            roleId: data.roleId
          }
        }
      })

      if (existingAssignment) {
        // Reactivate if it exists but is inactive
        if (!existingAssignment.isActive) {
          return await prisma.userRole.update({
            where: { id: existingAssignment.id },
            data: {
              isActive: true,
              assignedBy: data.assignedBy,
              assignedAt: new Date(),
              expiresAt: data.expiresAt
            }
          })
        } else {
          throw new Error('User already has this role assigned')
        }
      }

      return await prisma.userRole.create({
        data: {
          userId: data.userId,
          roleId: data.roleId,
          assignedBy: data.assignedBy,
          expiresAt: data.expiresAt
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new Error('User or role not found')
        }
      }
      throw error
    }
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<UserRole> {
    try {
      const userRole = await prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId
          }
        }
      })

      if (!userRole) {
        throw new Error('Role assignment not found')
      }

      return await prisma.userRole.update({
        where: { id: userRole.id },
        data: { isActive: false }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Role assignment not found')
        }
      }
      throw error
    }
  }

  async getUserRoles(userId: string): Promise<Array<{
    id: string
    role: Role
    assignedAt: Date
    expiresAt: Date | null
    isActive: boolean
  }>> {
    return await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { assignedAt: 'desc' }
    })
  }

  async getRoleUsers(roleId: string): Promise<Array<{
    id: string
    user: {
      id: string
      email: string
      firstName: string | null
      lastName: string | null
      isActive: boolean
    }
    assignedAt: Date
    expiresAt: Date | null
    isActive: boolean
  }>> {
    return await prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    })
  }

  async validatePermissions(permissions: string[]): Promise<boolean> {
    const validPermissionPatterns = [
      // User management
      'user:read',
      'user:create',
      'user:update',
      'user:delete',
      'user:*',

      // Role management
      'role:read',
      'role:create',
      'role:update',
      'role:delete',
      'role:*',

      // Title management
      'title:read',
      'title:create',
      'title:update',
      'title:delete',
      'title:*',

      // Inventory management
      'inventory:read',
      'inventory:update',
      'inventory:*',

      // Warehouse management
      'warehouse:read',
      'warehouse:update',
      'warehouse:*',

      // Stock movements
      'movement:read',
      'movement:create',
      'movement:approve',
      'movement:*',

      // Financial operations
      'financial:read',
      'financial:create',
      'financial:*',

      // Royalty management
      'royalty:read',
      'royalty:calculate',
      'royalty:*',

      // Reporting
      'report:read',
      'report:create',
      'report:export',
      'report:*',

      // System settings
      'settings:read',
      'settings:update',
      'settings:*',

      // Audit logs
      'audit:read',
      'audit:*'
    ]

    for (const permission of permissions) {
      if (!validPermissionPatterns.includes(permission)) {
        return false
      }
    }

    return true
  }

  async createSystemRoles(): Promise<Role[]> {
    const systemRoles = [
      {
        name: 'Admin',
        description: 'Full system access for system administrators',
        permissions: [
          'user:*',
          'role:*',
          'title:*',
          'inventory:*',
          'warehouse:*',
          'settings:*',
          'audit:read'
        ],
        isSystem: true
      },
      {
        name: 'Operations Manager',
        description: 'Publishing operations team lead with broad inventory management access',
        permissions: [
          'title:read',
          'title:create',
          'title:update',
          'inventory:read',
          'inventory:update',
          'warehouse:read',
          'warehouse:update',
          'movement:read',
          'movement:create',
          'movement:approve',
          'report:read',
          'report:create',
          'user:read'
        ],
        isSystem: true
      },
      {
        name: 'Inventory Clerk',
        description: 'Staff member responsible for day-to-day inventory operations',
        permissions: [
          'title:read',
          'inventory:read',
          'inventory:update',
          'movement:read',
          'movement:create',
          'warehouse:read',
          'report:read'
        ],
        isSystem: true
      },
      {
        name: 'Financial Controller',
        description: 'Finance team member with access to financial data and reports',
        permissions: [
          'title:read',
          'inventory:read',
          'financial:read',
          'financial:create',
          'report:read',
          'report:create',
          'report:export',
          'royalty:read',
          'royalty:calculate'
        ],
        isSystem: true
      },
      {
        name: 'Read-Only User',
        description: 'View-only access for stakeholders and junior team members',
        permissions: [
          'title:read',
          'inventory:read',
          'report:read'
        ],
        isSystem: true
      }
    ]

    const createdRoles: Role[] = []

    for (const roleData of systemRoles) {
      try {
        // Check if role already exists
        const existingRole = await this.getRoleByName(roleData.name)
        if (existingRole) {
          // Update existing system role permissions
          const updatedRole = await this.updateRole(existingRole.id, {
            description: roleData.description,
            permissions: roleData.permissions
          })
          createdRoles.push(updatedRole)
        } else {
          // Create new system role
          const newRole = await this.createRole(roleData)
          createdRoles.push(newRole)
        }
      } catch (error) {
        console.error(`Failed to create/update system role ${roleData.name}:`, error)
      }
    }

    return createdRoles
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    const role = await this.getRoleById(roleId)
    if (!role || !Array.isArray(role.permissions)) {
      return []
    }
    return role.permissions as string[]
  }

  async expandWildcardPermissions(permissions: string[]): Promise<string[]> {
    const expandedPermissions = new Set<string>()

    const allPermissions = [
      'user:read', 'user:create', 'user:update', 'user:delete',
      'role:read', 'role:create', 'role:update', 'role:delete',
      'title:read', 'title:create', 'title:update', 'title:delete',
      'inventory:read', 'inventory:update',
      'warehouse:read', 'warehouse:update',
      'movement:read', 'movement:create', 'movement:approve',
      'financial:read', 'financial:create',
      'royalty:read', 'royalty:calculate',
      'report:read', 'report:create', 'report:export',
      'settings:read', 'settings:update',
      'audit:read'
    ]

    for (const permission of permissions) {
      if (permission.endsWith(':*')) {
        const resource = permission.slice(0, -2)
        const resourcePermissions = allPermissions.filter(p => p.startsWith(resource + ':'))
        resourcePermissions.forEach(p => expandedPermissions.add(p))
      } else {
        expandedPermissions.add(permission)
      }
    }

    return Array.from(expandedPermissions)
  }

  async getRoleStats(): Promise<{
    total: number
    system: number
    custom: number
    active: number
    totalAssignments: number
  }> {
    const [total, system, active, totalAssignments] = await Promise.all([
      prisma.role.count(),
      prisma.role.count({ where: { isSystem: true } }),
      prisma.role.count({ where: { isActive: true } }),
      prisma.userRole.count({ where: { isActive: true } })
    ])

    return {
      total,
      system,
      custom: total - system,
      active,
      totalAssignments
    }
  }

  async getSystemRoles(): Promise<Role[]> {
    return await prisma.role.findMany({
      where: { isSystem: true, isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  async getCustomRoles(): Promise<Role[]> {
    return await prisma.role.findMany({
      where: { isSystem: false, isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  async bulkAssignRole(roleId: string, userIds: string[], assignedBy?: string): Promise<UserRole[]> {
    const assignments: UserRole[] = []

    for (const userId of userIds) {
      try {
        const assignment = await this.assignRoleToUser({
          userId,
          roleId,
          assignedBy
        })
        assignments.push(assignment)
      } catch (error) {
        console.error(`Failed to assign role to user ${userId}:`, error)
      }
    }

    return assignments
  }

  async bulkRemoveRole(roleId: string, userIds: string[]): Promise<UserRole[]> {
    const removals: UserRole[] = []

    for (const userId of userIds) {
      try {
        const removal = await this.removeRoleFromUser(userId, roleId)
        removals.push(removal)
      } catch (error) {
        console.error(`Failed to remove role from user ${userId}:`, error)
      }
    }

    return removals
  }
}

export const roleService = new RoleService()