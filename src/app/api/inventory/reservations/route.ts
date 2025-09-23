import { NextRequest, NextResponse } from 'next/server'
import InventoryAllocationService from '@/services/inventoryAllocationService'

// POST /api/inventory/reservations - Create inventory reservation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic validation
    if (!body.titleId || !body.warehouseId || !body.quantity || !body.orderId || !body.customerId) {
      return NextResponse.json(
        { error: 'titleId, warehouseId, quantity, orderId, and customerId are required' },
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

    // Validate expiration date if provided
    let expirationDate: Date | undefined
    if (body.expirationDate) {
      expirationDate = new Date(body.expirationDate)
      if (isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
        return NextResponse.json(
          { error: 'Expiration date must be a valid future date' },
          { status: 400 }
        )
      }
    }

    const reservationResult = await InventoryAllocationService.reserveInventory({
      titleId: body.titleId,
      warehouseId: body.warehouseId,
      quantity: body.quantity,
      orderId: body.orderId,
      customerId: body.customerId,
      expirationDate,
      priority: body.priority
    })

    const statusCode = reservationResult.success ? 201 : 400

    return NextResponse.json({
      data: reservationResult,
      message: reservationResult.message
    }, { status: statusCode })
  } catch (error) {
    console.error('POST /api/inventory/reservations error:', error)

    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}

// GET /api/inventory/reservations - Get reservations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const titleId = searchParams.get('titleId')
    const warehouseId = searchParams.get('warehouseId')

    const reservations = InventoryAllocationService.getActiveReservations(
      titleId ? parseInt(titleId) : undefined,
      warehouseId ? parseInt(warehouseId) : undefined
    )

    return NextResponse.json({
      data: reservations,
      count: reservations.length
    })
  } catch (error) {
    console.error('GET /api/inventory/reservations error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve reservations' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/reservations - Extend reservation or cleanup
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action

    if (action === 'cleanup') {
      // Cleanup expired reservations
      const cleanupResult = await InventoryAllocationService.cleanupExpiredReservations()

      return NextResponse.json({
        data: cleanupResult,
        message: `Cleaned up ${cleanupResult.cleaned} expired reservations`
      })
    } else if (action === 'extend' && body.reservationId && body.newExpirationDate) {
      // Extend specific reservation
      const newExpirationDate = new Date(body.newExpirationDate)

      if (isNaN(newExpirationDate.getTime()) || newExpirationDate <= new Date()) {
        return NextResponse.json(
          { error: 'New expiration date must be a valid future date' },
          { status: 400 }
        )
      }

      const extendResult = await InventoryAllocationService.extendReservation(
        body.reservationId,
        newExpirationDate
      )

      const statusCode = extendResult.success ? 200 : 400

      return NextResponse.json({
        data: extendResult,
        message: extendResult.message
      }, { status: statusCode })
    } else if (action === 'maintenance' && typeof body.olderThanDays === 'number') {
      // Perform maintenance cleanup
      const maintenanceResult = await InventoryAllocationService.performMaintenanceCleanup(
        body.olderThanDays
      )

      return NextResponse.json({
        data: maintenanceResult,
        message: `Maintenance cleanup completed. Removed ${maintenanceResult.removedReservations} old reservations`
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action or missing required parameters' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('PUT /api/inventory/reservations error:', error)

    return NextResponse.json(
      { error: 'Failed to process reservation request' },
      { status: 500 }
    )
  }
}