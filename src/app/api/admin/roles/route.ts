import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { clerkAuthService } from '@/services/clerkAuthService'

/**
 * Roles API - Now using Clerk-based roles
 *
 * Roles are defined in code (/lib/clerk.ts) and stored in Clerk publicMetadata.
 * This endpoint returns the available roles from code definitions.
 */

async function getRolesHandler(req: NextRequest) {
  try {
    // Get roles from code definitions
    const roles = clerkAuthService.getAvailableRoles()

    // Format to match expected API structure
    const formattedRoles = roles.map(role => ({
      id: role.name, // Use role name as ID since we don't have DB IDs
      name: role.name,
      description: getRoleDescription(role.name),
      permissions: role.permissions,
      isSystem: true, // All code-defined roles are system roles
      isActive: true,
    }))

    return NextResponse.json({
      data: formattedRoles, // Frontend expects 'data' field
      roles: formattedRoles, // Keep for backward compatibility
      total: formattedRoles.length,
      page: 1,
      limit: formattedRoles.length,
      totalPages: 1
    })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

/**
 * Get human-readable description for a role
 */
function getRoleDescription(roleName: string): string {
  const descriptions: Record<string, string> = {
    'admin': 'Full system access for system administrators',
    'operations_manager': 'Operational access for managing inventory and orders',
    'inventory_manager': 'Access to inventory management and stock operations',
    'read_only_user': 'View-only access for stakeholders and junior team members'
  }
  return descriptions[roleName] || 'No description available'
}

export const GET = requirePermission(
  'role:read',
  getRolesHandler
)

// POST is no longer supported - roles are defined in code
// Use /api/admin/users/[id]/roles to assign roles to users