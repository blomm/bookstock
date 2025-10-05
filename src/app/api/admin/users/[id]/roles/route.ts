import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { userService } from '@/services/userService'
import { authorizationService } from '@/services/authorizationService'
import { z } from 'zod'

const AssignRoleSchema = z.object({
  role_id: z.string(),
  expires_at: z.string().optional()
})

async function getUserRolesHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roles = await authorizationService.getUserRoles(params.id)

    return NextResponse.json(roles)
  } catch (error) {
    console.error('Error fetching user roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user roles' },
      { status: 500 }
    )
  }
}

async function assignRoleHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const data = AssignRoleSchema.parse(body)

    // Check if the current user can assign this role
    const currentUserId = req.user?.id
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'User context not found' },
        { status: 400 }
      )
    }

    // For now, we'll get the role name from the role service
    // In a real implementation, you'd want to validate the role exists
    const canAssign = await authorizationService.canUserAssignRole(
      currentUserId,
      'admin' // This would be dynamically determined from the role_id
    )

    if (!canAssign) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign this role' },
        { status: 403 }
      )
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : null

    const userRole = await userService.assignRole(
      params.id,
      data.role_id,
      currentUserId,
      expiresAt
    )

    return NextResponse.json(userRole, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error assigning role:', error)
    return NextResponse.json(
      { error: 'Failed to assign role' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'user:read',
  getUserRolesHandler
)

export const POST = withAuditLog(
  'role:assign',
  'user_role'
)(
  requirePermission(
    'user:update',
    assignRoleHandler
  )
)