import { NextRequest, NextResponse } from 'next/server'
import InventoryAllocationService from '@/services/inventoryAllocationService'

interface RouteParams {
  params: {
    id: string
  }
}

// DELETE /api/inventory/reservations/[id] - Release specific reservation
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const reservationId = params.id
    const { searchParams } = new URL(request.url)
    const reason = searchParams.get('reason') || 'Manual release via API'

    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      )
    }

    const releaseResult = await InventoryAllocationService.releaseReservation(
      reservationId,
      reason
    )

    const statusCode = releaseResult.success ? 200 : 404

    return NextResponse.json({
      data: releaseResult,
      message: releaseResult.message
    }, { status: statusCode })
  } catch (error) {
    console.error(`DELETE /api/inventory/reservations/${params.id} error:`, error)

    return NextResponse.json(
      { error: 'Failed to release reservation' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/reservations/[id] - Update specific reservation
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const reservationId = params.id
    const body = await request.json()

    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      )
    }

    if (body.action === 'extend' && body.newExpirationDate) {
      const newExpirationDate = new Date(body.newExpirationDate)

      if (isNaN(newExpirationDate.getTime()) || newExpirationDate <= new Date()) {
        return NextResponse.json(
          { error: 'New expiration date must be a valid future date' },
          { status: 400 }
        )
      }

      const extendResult = await InventoryAllocationService.extendReservation(
        reservationId,
        newExpirationDate
      )

      const statusCode = extendResult.success ? 200 : 404

      return NextResponse.json({
        data: extendResult,
        message: extendResult.message
      }, { status: statusCode })
    } else {
      return NextResponse.json(
        { error: 'Invalid action or missing parameters' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error(`PUT /api/inventory/reservations/${params.id} error:`, error)

    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    )
  }
}