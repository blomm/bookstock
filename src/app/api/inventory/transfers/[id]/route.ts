import { NextRequest, NextResponse } from 'next/server'
import InterWarehouseTransferService from '@/services/interWarehouseTransferService'

interface RouteParams {
  params: {
    id: string
  }
}

// PUT /api/inventory/transfers/[id] - Update transfer (approve, execute, track, complete)
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const transferId = params.id
    const body = await request.json()

    if (!transferId) {
      return NextResponse.json(
        { error: 'Transfer ID is required' },
        { status: 400 }
      )
    }

    const { action } = body

    switch (action) {
      case 'approve':
        const { approvedBy, approvalNotes, scheduledDate } = body

        if (!approvedBy) {
          return NextResponse.json(
            { error: 'approvedBy is required for approval' },
            { status: 400 }
          )
        }

        const approvalResult = await InterWarehouseTransferService.approveTransfer({
          transferId,
          approvedBy,
          approvalNotes,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
        })

        const approvalStatusCode = approvalResult.success ? 200 : 404

        return NextResponse.json({
          data: approvalResult,
          message: approvalResult.message
        }, { status: approvalStatusCode })

      case 'execute':
        const { executedBy } = body

        if (!executedBy) {
          return NextResponse.json(
            { error: 'executedBy is required for execution' },
            { status: 400 }
          )
        }

        const executeResult = await InterWarehouseTransferService.executeTransfer(transferId, executedBy)

        const executeStatusCode = executeResult.success ? 200 : 404

        return NextResponse.json({
          data: executeResult,
          message: executeResult.message
        }, { status: executeStatusCode })

      case 'track':
        const { status, location, estimatedArrival, carrier, trackingNumber, notes } = body

        if (!status) {
          return NextResponse.json(
            { error: 'status is required for tracking update' },
            { status: 400 }
          )
        }

        const trackingResult = await InterWarehouseTransferService.updateTransferTracking({
          transferId,
          status,
          location,
          estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
          carrier,
          trackingNumber,
          notes
        })

        const trackingStatusCode = trackingResult.success ? 200 : 404

        return NextResponse.json({
          data: trackingResult,
          message: trackingResult.message
        }, { status: trackingStatusCode })

      case 'complete':
        const { completedBy } = body

        if (!completedBy) {
          return NextResponse.json(
            { error: 'completedBy is required for completion' },
            { status: 400 }
          )
        }

        const completeResult = await InterWarehouseTransferService.completeTransfer(transferId, completedBy)

        const completeStatusCode = completeResult.success ? 200 : 404

        return NextResponse.json({
          data: completeResult,
          message: completeResult.message
        }, { status: completeStatusCode })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: approve, execute, track, complete' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error(`PUT /api/inventory/transfers/${params.id} error:`, error)

    return NextResponse.json(
      { error: 'Failed to update transfer' },
      { status: 500 }
    )
  }
}

// GET /api/inventory/transfers/[id] - Get transfer analytics
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const transferId = params.id

    if (!transferId) {
      return NextResponse.json(
        { error: 'Transfer ID is required' },
        { status: 400 }
      )
    }

    const analytics = await InterWarehouseTransferService.generateTransferAnalytics(transferId)

    return NextResponse.json({
      data: analytics,
      type: 'transfer_analytics'
    })
  } catch (error) {
    console.error(`GET /api/inventory/transfers/${params.id} error:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to get transfer analytics'
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