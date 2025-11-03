import { NextResponse } from 'next/server'
import { requirePermission, AuthenticatedRequest } from '@/middleware/apiAuthMiddleware'
import { authorizationService } from '@/services/authorizationService'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const AssignRoleSchema = z.object({
  role_id: z.string(),
  expires_at: z.string().optional()
})

async function getUserRolesHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const roles = await authorizationService.getUserRoles(id)

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
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Create or update the user role assignment
    const userRole = await prisma.userRole.create({
      data: {
        userId: id,
        roleId: data.role_id,
        expiresAt: expiresAt
      },
      include: {
        role: true
      }
    })

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

export const POST = requirePermission(
  'user:update',
  assignRoleHandler,
  {
    enableAuditLog: true,
    action: 'role:assign',
    resource: 'user_role'
  }
)