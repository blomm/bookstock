import { NextRequest, NextResponse } from 'next/server'
import RealTimeInventoryService from '@/services/realTimeInventoryService'
import InventoryDiscrepancyService from '@/services/inventoryDiscrepancyService'

// GET /api/inventory/real-time - Get live inventory levels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const titleId = searchParams.get('titleId')

    if (titleId) {
      // Get title inventory across all warehouses
      const titleInventory = await RealTimeInventoryService.getTitleInventoryAcrossWarehouses(
        parseInt(titleId)
      )

      return NextResponse.json({
        data: titleInventory,
        count: titleInventory.length,
        type: 'title_across_warehouses'
      })
    } else if (warehouseId) {
      // Get warehouse inventory levels
      const warehouseInventory = await RealTimeInventoryService.getLiveInventoryLevels(
        parseInt(warehouseId)
      )

      return NextResponse.json({
        data: warehouseInventory,
        count: warehouseInventory.length,
        type: 'warehouse_inventory'
      })
    } else {
      return NextResponse.json(
        { error: 'Either warehouseId or titleId parameter is required' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('GET /api/inventory/real-time error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve real-time inventory levels' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/real-time - Update inventory level
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic validation
    if (!body.inventoryId || body.stockChange === undefined || !body.reason) {
      return NextResponse.json(
        { error: 'inventoryId, stockChange, and reason are required' },
        { status: 400 }
      )
    }

    const updatedInventory = await RealTimeInventoryService.updateInventoryLevel(
      body.inventoryId,
      body.stockChange,
      body.reason,
      body.userId,
      body.batchId
    )

    return NextResponse.json({
      data: updatedInventory,
      message: 'Inventory level updated successfully'
    })
  } catch (error) {
    console.error('POST /api/inventory/real-time error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to update inventory level'
    let statusCode = 500

    if (errorMessage.includes('not found')) {
      statusCode = 404
    } else if (errorMessage.includes('Insufficient')) {
      statusCode = 400
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}

// PUT /api/inventory/real-time - Bulk update inventory levels
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate bulk update request
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each update
    for (const update of body.updates) {
      if (!update.inventoryId || update.stockChange === undefined || !update.reason) {
        return NextResponse.json(
          { error: 'Each update must have inventoryId, stockChange, and reason' },
          { status: 400 }
        )
      }
    }

    const updatedInventories = await RealTimeInventoryService.processBulkInventoryUpdates(
      body.updates,
      body.userId,
      body.batchId
    )

    return NextResponse.json({
      data: updatedInventories,
      count: updatedInventories.length,
      message: 'Bulk inventory update completed successfully'
    })
  } catch (error) {
    console.error('PUT /api/inventory/real-time error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to process bulk inventory updates'
    let statusCode = 500

    if (errorMessage.includes('not found')) {
      statusCode = 404
    } else if (errorMessage.includes('Insufficient')) {
      statusCode = 400
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}