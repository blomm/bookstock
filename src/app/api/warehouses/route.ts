import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'
import { z } from 'zod'

const CreateWarehouseSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(10),
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

const UpdateWarehouseSchema = CreateWarehouseSchema.partial()

async function getWarehousesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const isActive = searchParams.get('isActive')

    const result = await warehouseService.list({
      page,
      limit,
      search,
      isActive: isActive ? isActive === 'true' : undefined
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

async function createWarehouseHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateWarehouseSchema.parse(body)

    const warehouse = await warehouseService.create(data)

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'warehouse:read',
  getWarehousesHandler
)

export const POST = withAuditLog(
  'warehouse:create',
  'warehouse'
)(
  requirePermission(
    'warehouse:create',
    createWarehouseHandler
  )
)