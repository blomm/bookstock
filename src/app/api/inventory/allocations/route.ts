import { NextRequest, NextResponse } from 'next/server'
import InventoryAllocationService from '@/services/inventoryAllocationService'

// POST /api/inventory/allocations - Allocate inventory across warehouses
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic validation
    if (!body.titleId || !body.quantity || !body.customerId) {
      return NextResponse.json(
        { error: 'titleId, quantity, and customerId are required' },
        { status: 400 }
      )
    }

    // Validate quantity is positive
    if (body.quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be positive' },
        { status: 400 }
      )
    }

    const allocationResult = await InventoryAllocationService.allocateInventory({
      titleId: body.titleId,
      quantity: body.quantity,
      customerId: body.customerId,
      preferredWarehouseIds: body.preferredWarehouseIds,
      maxWarehouses: body.maxWarehouses,
      customerTier: body.customerTier,
      channelType: body.channelType
    })

    return NextResponse.json({
      data: allocationResult,
      message: allocationResult.success ? 'Allocation completed successfully' : 'Partial or failed allocation'
    })
  } catch (error) {
    console.error('POST /api/inventory/allocations error:', error)

    return NextResponse.json(
      { error: 'Failed to allocate inventory' },
      { status: 500 }
    )
  }
}

// GET /api/inventory/allocations - Get allocation statistics and reservations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const titleId = searchParams.get('titleId')
    const warehouseId = searchParams.get('warehouseId')
    const type = searchParams.get('type') || 'statistics'

    if (type === 'reservations') {
      // Get active reservations
      const reservations = InventoryAllocationService.getActiveReservations(
        titleId ? parseInt(titleId) : undefined,
        warehouseId ? parseInt(warehouseId) : undefined
      )

      return NextResponse.json({
        data: reservations,
        count: reservations.length,
        type: 'active_reservations'
      })
    } else if (type === 'statistics') {
      // Get allocation statistics
      const statistics = await InventoryAllocationService.getAllocationStatistics(
        titleId ? parseInt(titleId) : undefined,
        warehouseId ? parseInt(warehouseId) : undefined
      )

      return NextResponse.json({
        data: statistics,
        type: 'allocation_statistics'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter. Use "reservations" or "statistics"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('GET /api/inventory/allocations error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve allocation data' },
      { status: 500 }
    )
  }
}