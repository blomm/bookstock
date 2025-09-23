import { NextRequest, NextResponse } from 'next/server'
import InventoryValuationService from '@/services/inventoryValuationService'

// GET /api/inventory/valuations - Get inventory valuations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const titleId = searchParams.get('titleId')
    const warehouseId = searchParams.get('warehouseId')
    const type = searchParams.get('type') || 'summary'

    if (type === 'summary' && titleId) {
      // Get title valuation summary across all warehouses
      const titleIdNum = parseInt(titleId)
      if (isNaN(titleIdNum)) {
        return NextResponse.json(
          { error: 'titleId must be a valid number' },
          { status: 400 }
        )
      }

      const summary = await InventoryValuationService.getTitleValuationSummary(titleIdNum)

      if (!summary) {
        return NextResponse.json(
          { error: 'Title not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        data: summary,
        type: 'title_valuation_summary'
      })
    }

    if (type === 'warehouse' && titleId && warehouseId) {
      // Get specific warehouse valuation
      const titleIdNum = parseInt(titleId)
      const warehouseIdNum = parseInt(warehouseId)

      if (isNaN(titleIdNum) || isNaN(warehouseIdNum)) {
        return NextResponse.json(
          { error: 'titleId and warehouseId must be valid numbers' },
          { status: 400 }
        )
      }

      const valuation = await InventoryValuationService.calculateTitleWarehouseValuation(
        titleIdNum,
        warehouseIdNum
      )

      if (!valuation) {
        return NextResponse.json(
          { error: 'Inventory record not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        data: valuation,
        type: 'warehouse_valuation'
      })
    }

    if (type === 'aging') {
      // Generate aging report
      const warehouseIdNum = warehouseId ? parseInt(warehouseId) : undefined

      if (warehouseId && isNaN(warehouseIdNum!)) {
        return NextResponse.json(
          { error: 'warehouseId must be a valid number' },
          { status: 400 }
        )
      }

      const agingReport = await InventoryValuationService.generateAgingReport(warehouseIdNum)

      return NextResponse.json({
        data: agingReport,
        type: 'aging_report'
      })
    }

    return NextResponse.json(
      { error: 'Invalid request. Supported types: summary, warehouse, aging' },
      { status: 400 }
    )
  } catch (error) {
    console.error('GET /api/inventory/valuations error:', error)

    return NextResponse.json(
      { error: 'Failed to get inventory valuations' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/valuations - Update inventory valuation method
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      titleId,
      warehouseId,
      method
    } = body

    // Validation
    if (!titleId || !warehouseId || !method) {
      return NextResponse.json(
        { error: 'titleId, warehouseId, and method are required' },
        { status: 400 }
      )
    }

    if (!['FIFO', 'LIFO', 'WEIGHTED_AVERAGE'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be one of: FIFO, LIFO, WEIGHTED_AVERAGE' },
        { status: 400 }
      )
    }

    const titleIdNum = parseInt(titleId)
    const warehouseIdNum = parseInt(warehouseId)

    if (isNaN(titleIdNum) || isNaN(warehouseIdNum)) {
      return NextResponse.json(
        { error: 'titleId and warehouseId must be valid numbers' },
        { status: 400 }
      )
    }

    const result = await InventoryValuationService.updateInventoryValuation(
      titleIdNum,
      warehouseIdNum,
      method
    )

    if (result.success) {
      return NextResponse.json({
        data: result,
        message: result.message
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('PUT /api/inventory/valuations error:', error)

    return NextResponse.json(
      { error: 'Failed to update inventory valuation' },
      { status: 500 }
    )
  }
}