import { NextRequest, NextResponse } from 'next/server'
import { WarehouseManagementService, UpdateWarehouseData } from '@/services/warehouseManagementService'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/warehouses/[id] - Get warehouse by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const warehouseId = parseInt(params.id)

    if (isNaN(warehouseId)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    const warehouse = await WarehouseManagementService.getWarehouseById(warehouseId)

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: warehouse
    })
  } catch (error) {
    console.error(`GET /api/warehouses/${params.id} error:`, error)

    return NextResponse.json(
      { error: 'Failed to retrieve warehouse' },
      { status: 500 }
    )
  }
}

// PUT /api/warehouses/[id] - Update warehouse
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const warehouseId = parseInt(params.id)

    if (isNaN(warehouseId)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    const body = await request.json() as UpdateWarehouseData

    const warehouse = await WarehouseManagementService.updateWarehouse(warehouseId, body)

    return NextResponse.json({
      data: warehouse,
      message: 'Warehouse updated successfully'
    })
  } catch (error) {
    console.error(`PUT /api/warehouses/${params.id} error:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to update warehouse'
    let statusCode = 500

    if (errorMessage.includes('not found')) {
      statusCode = 404
    } else if (errorMessage.includes('already exists')) {
      statusCode = 409
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}

// DELETE /api/warehouses/[id] - Delete (deactivate) warehouse
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const warehouseId = parseInt(params.id)

    if (isNaN(warehouseId)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    await WarehouseManagementService.deleteWarehouse(warehouseId)

    return NextResponse.json({
      message: 'Warehouse deactivated successfully'
    })
  } catch (error) {
    console.error(`DELETE /api/warehouses/${params.id} error:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete warehouse'
    const statusCode = errorMessage.includes('not found') ? 404 : 500

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}