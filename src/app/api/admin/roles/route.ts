import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { roleService } from '@/services/roleService'
import { z } from 'zod'

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  is_system: z.boolean().optional()
})

const UpdateRoleSchema = CreateRoleSchema.partial()

async function getRolesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const isActive = searchParams.get('isActive')
    const includeSystem = searchParams.get('includeSystem') !== 'false'

    const result = await roleService.list({
      page,
      limit,
      search,
      isActive: isActive ? isActive === 'true' : undefined,
      includeSystem
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

async function createRoleHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateRoleSchema.parse(body)

    // Validate that all permissions are valid
    const invalidPermissions = data.permissions.filter(permission => {
      return !authorizationService.validatePermissionString(permission)
    })

    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid permissions',
          invalidPermissions
        },
        { status: 400 }
      )
    }

    const role = await roleService.create(data)

    return NextResponse.json(role, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating role:', error)
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'role:read',
  getRolesHandler
)

export const POST = withAuditLog(
  'role:create',
  'role'
)(
  requirePermission(
    'role:create',
    createRoleHandler
  )
)