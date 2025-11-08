import { NextResponse } from 'next/server'
import { requirePermission, AuthenticatedRequest } from '@/middleware/apiAuthMiddleware'
import { clerkAuthService } from '@/services/clerkAuthService'
import { prisma } from '@/lib/database'
import { type UserRole } from '@/lib/clerk'
import { z } from 'zod'

/**
 * User Roles API - Now using Clerk-based roles
 *
 * Roles are stored in Clerk publicMetadata and defined in code.
 * This endpoint manages role assignment via Clerk's API.
 */

const AssignRoleSchema = z.object({
  role_name: z.enum(['admin', 'operations_manager', 'inventory_manager', 'read_only_user']).optional(),
  role_id: z.enum(['admin', 'operations_manager', 'inventory_manager', 'read_only_user']).optional()
}).refine(data => data.role_name || data.role_id, {
  message: 'Either role_name or role_id must be provided'
})

async function getUserRolesHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get user from database to find their clerkId
    const user = await prisma.user.findUnique({
      where: { id },
      select: { clerkId: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get role and permissions from Clerk
    const { role, permissions } = await clerkAuthService.getEffectivePermissions(user.clerkId)

    return NextResponse.json({
      role,
      permissions,
      user: {
        id,
        clerkId: user.clerkId,
        email: user.email
      }
    })
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

    // Get user from database to find their clerkId
    const user = await prisma.user.findUnique({
      where: { id },
      select: { clerkId: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if current user has permission to assign roles
    if (!req.user?.id) {
      return NextResponse.json(
        { error: 'User context not found' },
        { status: 400 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { clerkId: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Current user not found' },
        { status: 400 }
      )
    }

    // Check if current user has permission
    const hasPermission = await clerkAuthService.hasPermission(currentUser.clerkId, 'user:update')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign roles' },
        { status: 403 }
      )
    }

    // Update role in Clerk - accept either role_name or role_id
    const roleName = (data.role_name || data.role_id) as UserRole
    await clerkAuthService.updateUserRole(user.clerkId, roleName)

    // Get updated role info
    const { role, permissions } = await clerkAuthService.getEffectivePermissions(user.clerkId)

    return NextResponse.json({
      message: 'Role assigned successfully',
      role,
      permissions,
      user: {
        id,
        clerkId: user.clerkId,
        email: user.email
      }
    }, { status: 200 })
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