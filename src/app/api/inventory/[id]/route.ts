import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { inventoryService } from '@/services/inventoryService'
import { z } from 'zod'

const UpdateInventorySchema = z.object({
  currentStock: z.number().int().min(0).optional(),
  reservedStock: z.number().int().min(0).optional(),
  lastStockCheck: z.date().optional()
})

async function getInventoryHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid inventory ID' },
        { status: 400 }
      )
    }

    const inventory = await inventoryService.findById(id)

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Error fetching inventory record:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory record' },
      { status: 500 }
    )
  }
}

async function updateInventoryHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid inventory ID' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const data = UpdateInventorySchema.parse(body)

    const inventory = await inventoryService.update(id, data)

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(inventory)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating inventory record:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory record' },
      { status: 500 }
    )
  }
}

async function deleteInventoryHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid inventory ID' },
        { status: 400 }
      )
    }

    const deleted = await inventoryService.delete(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Inventory record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting inventory record:', error)
    return NextResponse.json(
      { error: 'Failed to delete inventory record' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'inventory:read',
  getInventoryHandler
)

export const PUT = requirePermission(
  'inventory:update',
  updateInventoryHandler,
  {
    enableAuditLog: true,
    action: 'inventory:update',
    resource: 'inventory'
  }
)

export const DELETE = requirePermission(
  'inventory:delete',
  deleteInventoryHandler,
  {
    enableAuditLog: true,
    action: 'inventory:delete',
    resource: 'inventory'
  }
)