import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { userService } from '@/services/userService'
import { clerkAuthService } from '@/services/clerkAuthService'
import { z } from 'zod'

/**
 * Users API - Now using Clerk-based roles
 *
 * User data is stored in both Clerk and our database:
 * - Clerk: Authentication, roles in publicMetadata
 * - Database: Foreign key relationships (audit logs, stock movements)
 */

const CreateUserSchema = z.object({
  clerk_id: z.string(),
  email: z.string().email(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  is_active: z.boolean().optional()
})

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional()
})

async function getUsersHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const isActive = searchParams.get('isActive')

    const result = await userService.listUsers({
      page,
      limit,
      search,
      isActive: isActive ? isActive === 'true' : undefined,
      includeRoles: false // No longer fetching roles from DB
    })

    // Get role and permissions from Clerk for each user
    const usersWithPermissions = await Promise.all(
      result.users.map(async (user: any) => {
        const { role, permissions } = await clerkAuthService.getEffectivePermissions(user.clerkId)

        // Format role as user_roles array for backward compatibility
        const userRoles = role ? [{
          id: role, // Use role name as ID
          role: {
            id: role,
            name: role
          }
        }] : []

        return {
          id: user.id,
          clerk_id: user.clerkId,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          is_active: user.isActive,
          user_roles: userRoles,
          effectivePermissions: permissions
        }
      })
    )

    return NextResponse.json({
      data: usersWithPermissions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

async function createUserHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateUserSchema.parse(body)

    // Map snake_case to camelCase for service
    const createData = {
      clerkId: data.clerk_id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      isActive: data.is_active ?? true
    }

    const user = await userService.createUser(createData)

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'user:read',
  getUsersHandler
)

export const POST = requirePermission(
  'user:create',
  createUserHandler,
  {
    enableAuditLog: true,
    action: 'user:create',
    resource: 'user'
  }
)