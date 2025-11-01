import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { userService } from '@/services/userService'
import { authorizationService } from '@/services/authorizationService'
import { z } from 'zod'

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
    const roleId = searchParams.get('roleId') || undefined

    const result = await userService.listUsers({
      page,
      limit,
      search,
      isActive: isActive ? isActive === 'true' : undefined,
      includeRoles: true
    })

    // Add effective permissions for each user and transform to snake_case
    const usersWithPermissions = await Promise.all(
      result.users.map(async (user: any) => {
        const effectivePermissions = await authorizationService.getEffectivePermissions(user.id)

        // Transform userRoles array if it exists
        const userRoles = user.userRoles?.map((ur: any) => ({
          id: ur.id,
          role: {
            id: ur.role.id,
            name: ur.role.name
          }
        })) || []

        return {
          id: user.id,
          clerk_id: user.clerkId,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          is_active: user.isActive,
          user_roles: userRoles,
          effectivePermissions
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

    const user = await userService.create(data)

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

export const POST = withAuditLog(
  'user:create',
  'user'
)(
  requirePermission(
    'user:create',
    createUserHandler
  )
)