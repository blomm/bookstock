import { NextRequest, NextResponse } from 'next/server'
import { create_audit_log } from '@/lib/auth'
import { prisma } from '@/lib/database'

export interface AuditOptions {
  action: string
  resource?: string
  resourceId?: string
  captureRequest?: boolean
  captureResponse?: boolean
  ignoreFailures?: boolean
}

export function withAuditLogging(options: AuditOptions) {
  return function <T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>>(
    handler: T
  ): T {
    return (async (req: NextRequest, ...args: any[]) => {
      const startTime = Date.now()
      let response: NextResponse
      let error: Error | null = null
      let userId: number | null = null

      try {
        // Extract user ID from request if available
        if (req.user?.id) {
          // Try to get database user ID
          const dbUser = await prisma.user.findUnique({
            where: { clerk_id: req.user.id },
            select: { id: true }
          })
          if (dbUser) {
            userId = parseInt(dbUser.id)
          }
        }

        // Execute the handler
        response = await handler(req, ...args)

        // Capture successful audit log
        if (userId) {
          await createAuditLogSafely(userId, {
            ...options,
            success: response.status >= 200 && response.status < 300,
            statusCode: response.status,
            duration: Date.now() - startTime,
            requestData: options.captureRequest ? await captureRequestData(req) : undefined,
            responseData: options.captureResponse ? await captureResponseData(response) : undefined
          }, req)
        }

        return response

      } catch (err) {
        error = err as Error

        // Capture error audit log
        if (userId) {
          await createAuditLogSafely(userId, {
            ...options,
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
            requestData: options.captureRequest ? await captureRequestData(req) : undefined
          }, req)
        }

        throw error
      }
    }) as T
  }
}

async function createAuditLogSafely(
  userId: number,
  auditData: AuditOptions & {
    success?: boolean
    statusCode?: number
    duration?: number
    error?: string
    requestData?: any
    responseData?: any
  },
  request: NextRequest
): Promise<void> {
  try {
    const details = {
      success: auditData.success,
      status_code: auditData.statusCode,
      duration_ms: auditData.duration,
      error: auditData.error,
      endpoint: request.url,
      method: request.method,
      request_data: auditData.requestData,
      response_data: auditData.responseData,
      resource_id: auditData.resourceId
    }

    await create_audit_log(
      userId,
      auditData.action,
      details,
      request
    )
  } catch (error) {
    if (!auditData.ignoreFailures) {
      console.error('Failed to create audit log:', error)
    }
  }
}

async function captureRequestData(req: NextRequest): Promise<any> {
  try {
    const url = new URL(req.url)
    const data: any = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(req.headers.entries())
    }

    // Capture body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      try {
        const body = await req.text()
        if (body) {
          data.body = JSON.parse(body)
        }
      } catch {
        // Body not JSON or empty
      }
    }

    // Remove sensitive headers
    delete data.headers.authorization
    delete data.headers.cookie
    delete data.headers['x-api-key']

    return data
  } catch (error) {
    return { error: 'Failed to capture request data' }
  }
}

async function captureResponseData(response: NextResponse): Promise<any> {
  try {
    const data: any = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    }

    // Try to capture response body if it's JSON
    try {
      const responseClone = response.clone()
      const body = await responseClone.text()
      if (body) {
        data.body = JSON.parse(body)
      }
    } catch {
      // Response not JSON or empty
    }

    // Remove sensitive response data
    delete data.headers['set-cookie']

    return data
  } catch (error) {
    return { error: 'Failed to capture response data' }
  }
}

export class AuditLogger {
  static async logUserAction(
    userId: number,
    action: string,
    details: any = {},
    request?: NextRequest
  ): Promise<void> {
    try {
      await create_audit_log(userId, action, details, request)
    } catch (error) {
      console.error('Audit logging failed:', error)
    }
  }

  static async logSystemAction(
    action: string,
    details: any = {},
    request?: NextRequest
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          user_id: null, // System action
          action,
          details,
          ip_address: request ? getClientIp(request) : null,
          user_agent: request?.headers.get('user-agent') || null,
          timestamp: new Date()
        }
      })
    } catch (error) {
      console.error('System audit logging failed:', error)
    }
  }

  static async logSecurityEvent(
    action: string,
    details: any = {},
    request?: NextRequest,
    userId?: number
  ): Promise<void> {
    try {
      const securityDetails = {
        ...details,
        security_event: true,
        severity: details.severity || 'medium',
        timestamp: new Date().toISOString()
      }

      await prisma.auditLog.create({
        data: {
          user_id: userId || null,
          action: `security:${action}`,
          details: securityDetails,
          ip_address: request ? getClientIp(request) : null,
          user_agent: request?.headers.get('user-agent') || null,
          timestamp: new Date()
        }
      })
    } catch (error) {
      console.error('Security audit logging failed:', error)
    }
  }

  static async getAuditLogs(filters: {
    userId?: number
    action?: string
    resource?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  } = {}): Promise<{
    data: any[]
    total: number
    page: number
    limit: number
  }> {
    try {
      const {
        userId,
        action,
        resource,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = filters

      const where: any = {}

      if (userId) {
        where.user_id = userId
      }

      if (action) {
        where.action = { contains: action, mode: 'insensitive' }
      }

      if (resource) {
        where.resource = { contains: resource, mode: 'insensitive' }
      }

      if (startDate || endDate) {
        where.timestamp = {}
        if (startDate) {
          where.timestamp.gte = startDate
        }
        if (endDate) {
          where.timestamp.lte = endDate
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.auditLog.count({ where })
      ])

      return {
        data: logs,
        total,
        page,
        limit
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 50
      }
    }
  }
}

function getClientIp(request: NextRequest): string | null {
  // Check various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) {
    return cfIp
  }

  return null
}

export const auditLogger = new AuditLogger()