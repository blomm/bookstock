import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { userService } from '@/services/userService'
import { authorizationService } from '@/services/authorizationService'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional()
})

async function getUserHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await userService.getUserWithRoles(params.id)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Add effective permissions
    const effectivePermissions = await authorizationService.getEffectivePermissions(user.id)

    // Transform userRoles array to snake_case
    const userRoles = user.userRoles?.map((ur: any) => ({
      id: ur.id,
      role: {
        id: ur.role.id,
        name: ur.role.name
      }
    })) || []

    return NextResponse.json({
      id: user.id,
      clerk_id: user.clerkId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      is_active: user.isActive,
      user_roles: userRoles,
      effectivePermissions
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

async function updateUserHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json()
    const data = UpdateUserSchema.parse(body)

    // Map snake_case to camelCase for Prisma
    const updateData = {
      ...(data.email && { email: data.email }),
      ...(data.first_name && { firstName: data.first_name }),
      ...(data.last_name && { lastName: data.last_name }),
      ...(data.is_active !== undefined && { isActive: data.is_active })
    }

    const user = await userService.updateUser(params.id, updateData)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Transform to snake_case for response
    return NextResponse.json({
      id: user.id,
      clerk_id: user.clerkId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      is_active: user.isActive
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

async function deleteUserHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Don't actually delete users, just deactivate them
    const user = await userService.deactivateUser(params.id)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, deactivated: true })
  } catch (error) {
    console.error('Error deactivating user:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'user:read',
  getUserHandler
)

export const PUT = requirePermission(
  'user:update',
  updateUserHandler,
  {
    enableAuditLog: true,
    action: 'user:update',
    resource: 'user'
  }
)

export const DELETE = requirePermission(
  'user:delete',
  deleteUserHandler,
  {
    enableAuditLog: true,
    action: 'user:deactivate',
    resource: 'user'
  }
)