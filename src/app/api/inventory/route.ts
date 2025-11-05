import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { inventoryService } from '@/services/inventoryService'
import { z } from 'zod'

const CreateInventorySchema = z.object({
  titleId: z.number().int(),
  warehouseId: z.number().int(),
  currentStock: z.number().int().min(0).optional(),
  reservedStock: z.number().int().min(0).optional()
})

async function getInventoryHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const warehouseId = searchParams.get('warehouseId') || undefined
    const titleId = searchParams.get('titleId') || undefined
    const lowStock = searchParams.get('lowStock') === 'true'
    const search = searchParams.get('search') || undefined

    const result = await inventoryService.list({
      page,
      limit,
      warehouseId,
      titleId,
      lowStock,
      search
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

async function createInventoryHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateInventorySchema.parse(body)

    const inventory = await inventoryService.create(data)

    return NextResponse.json(inventory, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating inventory record:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory record' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'inventory:read',
  getInventoryHandler
)

export const POST = requirePermission(
  'inventory:create',
  createInventoryHandler,
  {
    enableAuditLog: true,
    action: 'inventory:create',
    resource: 'inventory'
  }
)