import { prisma } from '@/lib/db'
import { AuditLog, Prisma } from '@prisma/client'

export interface CreateAuditLogInput {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export interface AuditLogWithUser extends AuditLog {
  user?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

export class AuditLogService {
  async createLog(data: CreateAuditLogInput): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date()
      }
    })
  }

  async getLogById(id: string): Promise<AuditLogWithUser | null> {
    return await prisma.auditLog.findUnique({
      where: { id },
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
    }) as AuditLogWithUser | null
  }

  async listLogs(options: {
    page?: number
    limit?: number
    userId?: string
    action?: string
    resource?: string
    startDate?: Date
    endDate?: Date
    ipAddress?: string
    includeUser?: boolean
  } = {}): Promise<{
    logs: AuditLog[] | AuditLogWithUser[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      resource,
      startDate,
      endDate,
      ipAddress,
      includeUser = false
    } = options

    const skip = (page - 1) * limit

    const where: Prisma.AuditLogWhereInput = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(resource && { resource }),
      ...(ipAddress && { ipAddress }),
      ...(startDate || endDate) && {
        timestamp: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate })
        }
      }
    }

    const include = includeUser ? {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    } : undefined

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  async getUserLogs(userId: string, options: {
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    logs: AuditLog[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    return await this.listLogs({
      ...options,
      userId
    }) as {
      logs: AuditLog[]
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }

  async getResourceLogs(resource: string, resourceId?: string, options: {
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    logs: AuditLogWithUser[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const where: Prisma.AuditLogWhereInput = {
      resource,
      ...(resourceId && { resourceId }),
      ...(options.startDate || options.endDate) && {
        timestamp: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate })
        }
      }
    }

    const skip = ((options.page || 1) - 1) * (options.limit || 50)

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        skip,
        take: options.limit || 50,
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      logs: logs as AuditLogWithUser[],
      total,
      page: options.page || 1,
      limit: options.limit || 50,
      totalPages: Math.ceil(total / (options.limit || 50))
    }
  }

  async getSecurityLogs(options: {
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    logs: AuditLogWithUser[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const securityActions = [
      'LOGIN',
      'LOGOUT',
      'LOGIN_FAILED',
      'PERMISSION_DENIED',
      'ACCESS_DENIED',
      'PASSWORD_RESET',
      'ACCOUNT_LOCKED',
      'SUSPICIOUS_ACTIVITY',
      'ROLE_ASSIGNED',
      'ROLE_REMOVED',
      'USER_CREATED',
      'USER_DELETED',
      'USER_DEACTIVATED'
    ]

    const where: Prisma.AuditLogWhereInput = {
      action: { in: securityActions },
      ...(options.startDate || options.endDate) && {
        timestamp: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate })
        }
      }
    }

    const skip = ((options.page || 1) - 1) * (options.limit || 50)

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        skip,
        take: options.limit || 50,
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      logs: logs as AuditLogWithUser[],
      total,
      page: options.page || 1,
      limit: options.limit || 50,
      totalPages: Math.ceil(total / (options.limit || 50))
    }
  }

  async searchLogs(query: string, options: {
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    logs: AuditLogWithUser[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { action: { contains: query, mode: 'insensitive' } },
        { resource: { contains: query, mode: 'insensitive' } },
        { resourceId: { contains: query, mode: 'insensitive' } },
        { ipAddress: { contains: query, mode: 'insensitive' } },
        { userAgent: { contains: query, mode: 'insensitive' } }
      ],
      ...(options.startDate || options.endDate) && {
        timestamp: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate })
        }
      }
    }

    const skip = ((options.page || 1) - 1) * (options.limit || 50)

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        skip,
        take: options.limit || 50,
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      logs: logs as AuditLogWithUser[],
      total,
      page: options.page || 1,
      limit: options.limit || 50,
      totalPages: Math.ceil(total / (options.limit || 50))
    }
  }

  async deleteOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    })

    return result.count
  }

  async getLogStats(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    total: number
    byAction: Record<string, number>
    byResource: Record<string, number>
    byUser: Record<string, number>
    byHour: Record<string, number>
    securityEvents: number
  }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(options.startDate || options.endDate) && {
        timestamp: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate })
        }
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    })

    const total = logs.length

    const byAction: Record<string, number> = {}
    const byResource: Record<string, number> = {}
    const byUser: Record<string, number> = {}
    const byHour: Record<string, number> = {}

    const securityActions = new Set([
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PERMISSION_DENIED',
      'ACCESS_DENIED', 'PASSWORD_RESET', 'ACCOUNT_LOCKED',
      'SUSPICIOUS_ACTIVITY', 'ROLE_ASSIGNED', 'ROLE_REMOVED'
    ])

    let securityEvents = 0

    logs.forEach(log => {
      // By action
      byAction[log.action] = (byAction[log.action] || 0) + 1

      // By resource
      if (log.resource) {
        byResource[log.resource] = (byResource[log.resource] || 0) + 1
      }

      // By user
      const userKey = log.user?.email || 'System'
      byUser[userKey] = (byUser[userKey] || 0) + 1

      // By hour
      const hourKey = log.timestamp.toISOString().slice(0, 13) + ':00'
      byHour[hourKey] = (byHour[hourKey] || 0) + 1

      // Security events
      if (securityActions.has(log.action)) {
        securityEvents++
      }
    })

    return {
      total,
      byAction,
      byResource,
      byUser,
      byHour,
      securityEvents
    }
  }

  // Convenience methods for common audit actions

  async logUserLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      details: {
        timestamp: new Date().toISOString()
      }
    })
  }

  async logUserLogout(userId: string, ipAddress?: string): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: 'LOGOUT',
      ipAddress,
      details: {
        timestamp: new Date().toISOString()
      }
    })
  }

  async logFailedLogin(email: string, reason: string, ipAddress?: string, userAgent?: string): Promise<AuditLog> {
    return await this.createLog({
      action: 'LOGIN_FAILED',
      ipAddress,
      userAgent,
      details: {
        email,
        reason,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logPermissionDenied(userId: string, action: string, resource?: string, resourceId?: string, ipAddress?: string): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: 'PERMISSION_DENIED',
      resource,
      resourceId,
      ipAddress,
      details: {
        attemptedAction: action,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logResourceCreated(userId: string, resource: string, resourceId: string, details?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: `CREATE_${resource.toUpperCase()}`,
      resource,
      resourceId,
      details: {
        ...details,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logResourceUpdated(userId: string, resource: string, resourceId: string, changes: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: `UPDATE_${resource.toUpperCase()}`,
      resource,
      resourceId,
      details: {
        changes,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logResourceDeleted(userId: string, resource: string, resourceId: string, details?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: `DELETE_${resource.toUpperCase()}`,
      resource,
      resourceId,
      details: {
        ...details,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logRoleAssigned(adminUserId: string, userId: string, roleId: string, roleName: string): Promise<AuditLog> {
    return await this.createLog({
      userId: adminUserId,
      action: 'ROLE_ASSIGNED',
      resource: 'user',
      resourceId: userId,
      details: {
        roleId,
        roleName,
        assignedTo: userId,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logRoleRemoved(adminUserId: string, userId: string, roleId: string, roleName: string): Promise<AuditLog> {
    return await this.createLog({
      userId: adminUserId,
      action: 'ROLE_REMOVED',
      resource: 'user',
      resourceId: userId,
      details: {
        roleId,
        roleName,
        removedFrom: userId,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logSystemEvent(action: string, details?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      action,
      resource: 'system',
      details: {
        ...details,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logStockMovement(userId: string, titleId: string, warehouseId: string, movementType: string, quantity: number, details?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: 'STOCK_MOVEMENT',
      resource: 'inventory',
      resourceId: `${titleId}-${warehouseId}`,
      details: {
        titleId,
        warehouseId,
        movementType,
        quantity,
        ...details,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logBulkOperation(userId: string, action: string, resource: string, affectedCount: number, details?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: `BULK_${action.toUpperCase()}`,
      resource,
      details: {
        affectedCount,
        ...details,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logDataExport(userId: string, exportType: string, recordCount: number, filters?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId,
      action: 'DATA_EXPORT',
      resource: exportType,
      details: {
        exportType,
        recordCount,
        filters,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logSuspiciousActivity(userId: string | null, activity: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', ipAddress?: string, details?: Record<string, any>): Promise<AuditLog> {
    return await this.createLog({
      userId: userId || undefined,
      action: 'SUSPICIOUS_ACTIVITY',
      ipAddress,
      details: {
        activity,
        severity,
        ...details,
        timestamp: new Date().toISOString()
      }
    })
  }
}

export const auditLogService = new AuditLogService()