import { NextRequest, NextResponse } from 'next/server'
import { validate_api_auth, validate_api_permission, create_audit_log } from '@/lib/auth'
import { sync_user_to_database } from '@/lib/auth'

export interface AuthMiddlewareOptions {
  enableAuditLog?: boolean
  action?: string
  resource?: string
  resourceId?: string
  skipAuth?: boolean
}

type AuthenticatedRequest = NextRequest & {
  user?: {
    id: string
    email: string
    role: string
    clerk_user: any
  }
}

export function apiAuthMiddleware(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  requiredPermissions: string[] = [],
  options: AuthMiddlewareOptions = {}
) {
  return async (req: AuthenticatedRequest): Promise<NextResponse> => {
    try {
      // Skip authentication if explicitly requested (for public routes)
      if (options.skipAuth) {
        return await handler(req)
      }

      // Validate authentication
      const authInfo = await validate_api_auth(req)

      // Sync user to database if not exists
      const dbUser = await sync_user_to_database(authInfo.user)

      // Add user context to request
      req.user = {
        id: authInfo.userId,
        email: authInfo.email || '',
        role: authInfo.role,
        clerk_user: authInfo.user
      }

      // Check permissions if required
      if (requiredPermissions.length > 0) {
        try {
          await validate_api_permission(req, requiredPermissions[0])
        } catch (error) {
          // If first permission fails, check if user has any of the required permissions
          let hasAnyPermission = false
          for (const permission of requiredPermissions) {
            try {
              await validate_api_permission(req, permission)
              hasAnyPermission = true
              break
            } catch {
              // Continue checking other permissions
            }
          }

          if (!hasAnyPermission) {
            if (options.enableAuditLog) {
              await createAuditLogSafely(
                parseInt(dbUser.id),
                'authorization:denied',
                {
                  required_permissions: requiredPermissions,
                  user_role: authInfo.role,
                  endpoint: req.url
                },
                req
              )
            }

            return NextResponse.json(
              { error: 'Forbidden' },
              { status: 403 }
            )
          }
        }
      }

      // Execute the protected handler
      const response = await handler(req)

      // Create audit log if enabled
      if (options.enableAuditLog && options.action) {
        await createAuditLogSafely(
          parseInt(dbUser.id),
          options.action,
          {
            resource: options.resource,
            resource_id: options.resourceId,
            endpoint: req.url,
            method: req.method,
            success: response.status >= 200 && response.status < 300
          },
          req
        )
      }

      return response

    } catch (error) {
      console.error('API Auth Middleware Error:', error)

      // Return appropriate error response based on error type
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          return NextResponse.json(
            { error: 'Unauthorized', details: error.toString() },
            { status: 401 }
          )
        }
        if (error.message === 'Forbidden') {
          return NextResponse.json(
            { error: 'Forbidden', details: error.toString() },
            { status: 403 }
          )
        }
      }

      // Generic server error
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    }
  }
}

async function createAuditLogSafely(
  userId: number,
  action: string,
  details: any,
  request?: NextRequest
): Promise<void> {
  try {
    await create_audit_log(userId, action, details, request)
  } catch (error) {
    // Log audit creation failure but don't fail the request
    console.error('Failed to create audit log:', error)
  }
}

export function requireAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return apiAuthMiddleware(handler)
}

export function requirePermission(
  permission: string,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options?: AuthMiddlewareOptions
) {
  return apiAuthMiddleware(handler, [permission], options)
}

export function requireAnyPermission(
  permissions: string[],
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options?: AuthMiddlewareOptions
) {
  return apiAuthMiddleware(handler, permissions, options)
}

export function withAuditLog(
  action: string,
  resource?: string,
  handler?: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  if (!handler) {
    // Return a decorator function
    return (actualHandler: (req: AuthenticatedRequest) => Promise<NextResponse>) =>
      apiAuthMiddleware(actualHandler, [], {
        enableAuditLog: true,
        action,
        resource
      })
  }

  return apiAuthMiddleware(handler, [], {
    enableAuditLog: true,
    action,
    resource
  })
}

export type { AuthenticatedRequest }