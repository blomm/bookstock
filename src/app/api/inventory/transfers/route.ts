import { NextRequest, NextResponse } from 'next/server'
import InterWarehouseTransferService from '@/services/interWarehouseTransferService'

// POST /api/inventory/transfers - Create transfer request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      titleId,
      sourceWarehouseId,
      destinationWarehouseId,
      quantity,
      requestedBy,
      reason,
      priority,
      requestedDate,
      notes
    } = body

    // Validation
    if (!titleId || !sourceWarehouseId || !destinationWarehouseId || !quantity || !requestedBy || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: titleId, sourceWarehouseId, destinationWarehouseId, quantity, requestedBy, reason' },
        { status: 400 }
      )
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      return NextResponse.json(
        { error: 'Source and destination warehouses cannot be the same' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }

    const transferRequest = {
      titleId: parseInt(titleId),
      sourceWarehouseId: parseInt(sourceWarehouseId),
      destinationWarehouseId: parseInt(destinationWarehouseId),
      quantity: parseInt(quantity),
      requestedBy,
      reason,
      priority: priority || 'MEDIUM',
      requestedDate: requestedDate ? new Date(requestedDate) : undefined,
      notes
    }

    const result = await InterWarehouseTransferService.createTransferRequest(transferRequest)

    if (result.success) {
      return NextResponse.json({
        data: result,
        message: result.message
      }, { status: 201 })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('POST /api/inventory/transfers error:', error)

    return NextResponse.json(
      { error: 'Failed to create transfer request' },
      { status: 500 }
    )
  }
}

// GET /api/inventory/transfers - Get transfer summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const warehouseIdNum = warehouseId ? parseInt(warehouseId) : undefined
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined
    const dateToObj = dateTo ? new Date(dateTo) : undefined

    if (warehouseId && isNaN(warehouseIdNum!)) {
      return NextResponse.json(
        { error: 'warehouseId must be a valid number' },
        { status: 400 }
      )
    }

    if (dateFrom && isNaN(dateFromObj!.getTime())) {
      return NextResponse.json(
        { error: 'dateFrom must be a valid date' },
        { status: 400 }
      )
    }

    if (dateTo && isNaN(dateToObj!.getTime())) {
      return NextResponse.json(
        { error: 'dateTo must be a valid date' },
        { status: 400 }
      )
    }

    const summary = await InterWarehouseTransferService.getTransferSummary(
      warehouseIdNum,
      dateFromObj,
      dateToObj
    )

    return NextResponse.json({
      data: summary,
      type: 'transfer_summary'
    })
  } catch (error) {
    console.error('GET /api/inventory/transfers error:', error)

    return NextResponse.json(
      { error: 'Failed to get transfer summary' },
      { status: 500 }
    )
  }
}