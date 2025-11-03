import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'
import { UpdateWarehouseSchema } from '@/lib/validators/warehouse'
import { z } from 'zod'

async function getWarehouseHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const id = parseInt(paramId)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    const warehouse = await warehouseService.findById(id)

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const id = parseInt(paramId)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const data = UpdateWarehouseSchema.parse(body)

    const warehouse = await warehouseService.update(id, data)

    return NextResponse.json(warehouse)
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

    // Handle warehouse not found error
    if (error instanceof Error && error.message === 'Warehouse not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const id = parseInt(paramId)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    await warehouseService.delete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle warehouse not found error
    if (error instanceof Error && error.message === 'Warehouse not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    // Handle warehouse with inventory error
    if (error instanceof Error && error.message.includes('existing inventory')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

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

export const PUT = requirePermission(
  'warehouse:update',
  updateWarehouseHandler,
  {
    enableAuditLog: true,
    action: 'warehouse:update',
    resource: 'warehouse'
  }
)

export const DELETE = requirePermission(
  'warehouse:delete',
  deleteWarehouseHandler,
  {
    enableAuditLog: true,
    action: 'warehouse:delete',
    resource: 'warehouse'
  }
)