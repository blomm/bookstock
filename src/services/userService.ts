import { prisma } from '@/lib/database'
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

// UserWithRoles interface removed - roles are now in Clerk publicMetadata

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

  // getUserWithRoles and getUserWithActiveRoles removed
  // Use clerkAuthService to get roles from Clerk publicMetadata instead

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
    includeRoles?: boolean // Kept for backward compatibility but ignored
  } = {}): Promise<{
    users: User[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const {
      page = 1,
      limit = 20,
      isActive,
      search
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

    // No longer including roles - use clerkAuthService for role data
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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

  // Permission methods removed - use clerkAuthService instead:
  // - clerkAuthService.getUserPermissions(clerkId)
  // - clerkAuthService.hasPermission(clerkId, permission)
  // - clerkAuthService.hasAnyPermission(clerkId, permissions)
  // - clerkAuthService.hasAllPermissions(clerkId, permissions)

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
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined,
        lastLoginAt: new Date()
      })
    } else {
      return await this.createUser({
        clerkId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined
      })
    }
  }

  // getUserRoles removed - use clerkAuthService.getUserRole(clerkId) instead

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