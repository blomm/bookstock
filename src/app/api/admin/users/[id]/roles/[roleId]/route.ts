import { NextResponse } from 'next/server'
import { requirePermission, AuthenticatedRequest } from '@/middleware/apiAuthMiddleware'
import { userService } from '@/services/userService'
import { authorizationService } from '@/services/authorizationService'
import { prisma } from '@/lib/db'

async function removeRoleHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const { id, roleId } = await params

    // Check if the current user can remove this role
    const currentUserId = req.user?.id
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'User context not found' },
        { status: 400 }
      )
    }

    // For now, we'll assume admin role - in real implementation, validate against actual role
    const canRemove = await authorizationService.canUserAssignRole(
      currentUserId,
      'admin' // This would be dynamically determined from the roleId
    )

    if (!canRemove) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove this role' },
        { status: 403 }
      )
    }

    // Remove the user role assignment
    const removed = await prisma.userRole.deleteMany({
      where: {
        userId: id,
        roleId: roleId
      }
    })

    if (removed.count === 0) {
      return NextResponse.json(
        { error: 'Role assignment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing role:', error)
    return NextResponse.json(
      { error: 'Failed to remove role' },
      { status: 500 }
    )
  }
}

export const DELETE = requirePermission(
  'user:update',
  removeRoleHandler,
  {
    enableAuditLog: true,
    action: 'role:remove',
    resource: 'user_role'
  }
)