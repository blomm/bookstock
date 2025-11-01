import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'
import { CreateWarehouseSchema, WarehouseTypeSchema, WarehouseStatusSchema } from '@/lib/validators/warehouse'
import { z } from 'zod'

async function getWarehousesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const isActive = searchParams.get('isActive')
    const statusParam = searchParams.get('status')
    const typeParam = searchParams.get('type')

    // Validate status and type if provided
    let status = undefined
    let type = undefined

    if (statusParam) {
      const statusResult = WarehouseStatusSchema.safeParse(statusParam)
      if (!statusResult.success) {
        return NextResponse.json(
          { error: 'Invalid status value', details: statusResult.error.errors },
          { status: 400 }
        )
      }
      status = statusResult.data
    }

    if (typeParam) {
      const typeResult = WarehouseTypeSchema.safeParse(typeParam)
      if (!typeResult.success) {
        return NextResponse.json(
          { error: 'Invalid type value', details: typeResult.error.errors },
          { status: 400 }
        )
      }
      type = typeResult.data
    }

    const result = await warehouseService.list({
      page,
      limit,
      search,
      status,
      type,
      isActive: isActive ? isActive === 'true' : undefined
    })

    // Transform to snake_case for frontend consistency
    const transformedWarehouses = result.warehouses.map((warehouse: any) => ({
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      type: warehouse.type,
      status: warehouse.status,
      is_active: warehouse.isActive,
      location: warehouse.location,
      fulfills_channels: warehouse.fulfillsChannels,
      address_line1: warehouse.addressLine1,
      address_line2: warehouse.addressLine2,
      city: warehouse.city,
      state_province: warehouse.stateProvince,
      postal_code: warehouse.postalCode,
      country: warehouse.country,
      contact_name: warehouse.contactName,
      contact_email: warehouse.contactEmail,
      contact_phone: warehouse.contactPhone,
      notes: warehouse.notes,
      created_at: warehouse.createdAt,
      updated_at: warehouse.updatedAt
    }))

    return NextResponse.json({
      warehouses: transformedWarehouses,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    })
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

    // Handle duplicate warehouse code error
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
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