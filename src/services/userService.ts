import { prisma } from '@/lib/db'
import { User, Prisma } from '@prisma/client'

export interface CreateUserInput {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
}

export interface UpdateUserInput {
  email?: string
  firstName?: string
  lastName?: string
  isActive?: boolean
  lastLoginAt?: Date
}

export interface UserWithRoles extends User {
  userRoles: Array<{
    id: string
    role: {
      id: string
      name: string
      permissions: string[]
    }
    isActive: boolean
    expiresAt: Date | null
  }>
}

export class UserService {
  async createUser(data: CreateUserInput): Promise<User> {
    try {
      return await prisma.user.create({
        data: {
          clerkId: data.clerkId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('User with this email or Clerk ID already exists')
        }
      }
      throw error
    }
  }

  async getUserById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id }
    })
  }

  async getUserByClerkId(clerkId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { clerkId }
    })
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email }
    })
  }

  async getUserWithRoles(id: string): Promise<UserWithRoles | null> {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          where: { isActive: true },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: true
              }
            }
          }
        }
      }
    }) as UserWithRoles | null
  }

  async getUserWithActiveRoles(clerkId: string): Promise<UserWithRoles | null> {
    return await prisma.user.findUnique({
      where: { clerkId },
      include: {
        userRoles: {
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: true
              }
            }
          }
        }
      }
    }) as UserWithRoles | null
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id },
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Email already exists')
        }
        if (error.code === 'P2025') {
          throw new Error('User not found')
        }
      }
      throw error
    }
  }

  async updateLastLogin(clerkId: string): Promise<User> {
    return await prisma.user.update({
      where: { clerkId },
      data: {
        lastLoginAt: new Date()
      }
    })
  }

  async deactivateUser(id: string): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: {
        isActive: false
      }
    })
  }

  async reactivateUser(id: string): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: {
        isActive: true
      }
    })
  }

  async deleteUser(id: string): Promise<User> {
    try {
      return await prisma.user.delete({
        where: { id }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found')
        }
      }
      throw error
    }
  }

  async listUsers(options: {
    page?: number
    limit?: number
    isActive?: boolean
    search?: string
    includeRoles?: boolean
  } = {}): Promise<{
    users: User[] | UserWithRoles[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const {
      page = 1,
      limit = 20,
      isActive,
      search,
      includeRoles = false
    } = options

    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const include = includeRoles ? {
      userRoles: {
        where: { isActive: true },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              permissions: true
            }
          }
        }
      }
    } : undefined

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.user.count({ where })
    ])

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  async getUserPermissions(clerkId: string): Promise<string[]> {
    const user = await this.getUserWithActiveRoles(clerkId)
    if (!user) {
      return []
    }

    const permissions = new Set<string>()

    user.userRoles.forEach(userRole => {
      if (Array.isArray(userRole.role.permissions)) {
        userRole.role.permissions.forEach(permission => {
          permissions.add(permission as string)
        })
      }
    })

    return Array.from(permissions)
  }

  async hasPermission(clerkId: string, requiredPermission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(clerkId)

    // Check for wildcard permissions (e.g., "user:*" covers "user:read", "user:create", etc.)
    for (const permission of permissions) {
      if (permission === requiredPermission) {
        return true
      }

      if (permission.endsWith(':*')) {
        const resource = permission.slice(0, -2)
        if (requiredPermission.startsWith(resource + ':')) {
          return true
        }
      }
    }

    return false
  }

  async hasAnyPermission(clerkId: string, requiredPermissions: string[]): Promise<boolean> {
    for (const permission of requiredPermissions) {
      if (await this.hasPermission(clerkId, permission)) {
        return true
      }
    }
    return false
  }

  async hasAllPermissions(clerkId: string, requiredPermissions: string[]): Promise<boolean> {
    for (const permission of requiredPermissions) {
      if (!(await this.hasPermission(clerkId, permission))) {
        return false
      }
    }
    return true
  }

  async syncUserFromClerk(clerkUser: {
    id: string
    emailAddresses: Array<{ emailAddress: string }>
    firstName?: string | null
    lastName?: string | null
  }): Promise<User> {
    const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress
    if (!primaryEmail) {
      throw new Error('User must have a primary email address')
    }

    const existingUser = await this.getUserByClerkId(clerkUser.id)

    if (existingUser) {
      return await this.updateUser(existingUser.id, {
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        lastLoginAt: new Date()
      })
    } else {
      return await this.createUser({
        clerkId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName
      })
    }
  }

  async getUserRoles(userId: string): Promise<Array<{
    id: string
    role: {
      id: string
      name: string
      description: string | null
      permissions: string[]
    }
    assignedAt: Date
    expiresAt: Date | null
    isActive: boolean
  }>> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    })

    return userRoles
  }

  async getActiveUsers(): Promise<User[]> {
    return await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    recentLogins: number
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [total, active, recentLogins] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({
        where: {
          lastLoginAt: { gte: sevenDaysAgo }
        }
      })
    ])

    return {
      total,
      active,
      inactive: total - active,
      recentLogins
    }
  }
}

export const userService = new UserService()