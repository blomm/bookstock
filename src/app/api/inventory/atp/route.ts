import { NextRequest, NextResponse } from 'next/server'
import InventoryAllocationService from '@/services/inventoryAllocationService'

// GET /api/inventory/atp - Get Available-to-Promise calculations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const titleId = searchParams.get('titleId')
    const warehouseId = searchParams.get('warehouseId')
    const scope = searchParams.get('scope') || 'single'

    if (!titleId) {
      return NextResponse.json(
        { error: 'titleId parameter is required' },
        { status: 400 }
      )
    }

    const titleIdNum = parseInt(titleId)
    if (isNaN(titleIdNum)) {
      return NextResponse.json(
        { error: 'titleId must be a valid number' },
        { status: 400 }
      )
    }

    if (scope === 'multi' || !warehouseId) {
      // Calculate ATP across all warehouses for the title
      const multiWarehouseAtp = await InventoryAllocationService.calculateMultiWarehouseAtp(titleIdNum)

      return NextResponse.json({
        data: multiWarehouseAtp,
        type: 'multi_warehouse_atp'
      })
    } else {
      // Calculate ATP for specific warehouse
      const warehouseIdNum = parseInt(warehouseId)
      if (isNaN(warehouseIdNum)) {
        return NextResponse.json(
          { error: 'warehouseId must be a valid number' },
          { status: 400 }
        )
      }

      const singleWarehouseAtp = await InventoryAllocationService.calculateAtp(titleIdNum, warehouseIdNum)

      return NextResponse.json({
        data: singleWarehouseAtp,
        type: 'single_warehouse_atp'
      })
    }
  } catch (error) {
    console.error('GET /api/inventory/atp error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate ATP'
    let statusCode = 500

    if (errorMessage.includes('not found')) {
      statusCode = 404
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}