import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'
import { z } from 'zod'

const UpdateWarehouseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(10).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  contact_person: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  is_active: z.boolean().optional()
})

async function getWarehouseHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const warehouse = await warehouseService.findById(params.id)

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(warehouse)
  } catch (error) {
    console.error('Error fetching warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse' },
      { status: 500 }
    )
  }
}

async function updateWarehouseHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const data = UpdateWarehouseSchema.parse(body)

    const warehouse = await warehouseService.update(params.id, data)

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(warehouse)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to update warehouse' },
      { status: 500 }
    )
  }
}

async function deleteWarehouseHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await warehouseService.delete(params.id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to delete warehouse' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'warehouse:read',
  getWarehouseHandler
)

export const PUT = withAuditLog(
  'warehouse:update',
  'warehouse'
)(
  requirePermission(
    'warehouse:update',
    updateWarehouseHandler
  )
)

export const DELETE = withAuditLog(
  'warehouse:delete',
  'warehouse'
)(
  requirePermission(
    'warehouse:delete',
    deleteWarehouseHandler
  )
)