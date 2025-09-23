import { NextRequest, NextResponse } from 'next/server'
import InventoryValuationService, { ValuationAdjustment } from '@/services/inventoryValuationService'

// POST /api/inventory/valuations/adjustments - Create valuation adjustment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      titleId,
      warehouseId,
      adjustmentType,
      originalValue,
      adjustedValue,
      reason,
      approvedBy,
      effectiveDate
    } = body

    // Validation
    if (!titleId || !warehouseId || !adjustmentType || !originalValue ||
        !adjustedValue || !reason || !approvedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: titleId, warehouseId, adjustmentType, originalValue, adjustedValue, reason, approvedBy' },
        { status: 400 }
      )
    }

    if (!['WRITE_DOWN', 'WRITE_UP', 'WRITE_OFF', 'OBSOLESCENCE'].includes(adjustmentType)) {
      return NextResponse.json(
        { error: 'Invalid adjustmentType. Must be one of: WRITE_DOWN, WRITE_UP, WRITE_OFF, OBSOLESCENCE' },
        { status: 400 }
      )
    }

    const titleIdNum = parseInt(titleId)
    const warehouseIdNum = parseInt(warehouseId)
    const originalValueNum = parseFloat(originalValue)
    const adjustedValueNum = parseFloat(adjustedValue)

    if (isNaN(titleIdNum) || isNaN(warehouseIdNum) || isNaN(originalValueNum) || isNaN(adjustedValueNum)) {
      return NextResponse.json(
        { error: 'titleId, warehouseId, originalValue, and adjustedValue must be valid numbers' },
        { status: 400 }
      )
    }

    if (originalValueNum < 0 || adjustedValueNum < 0) {
      return NextResponse.json(
        { error: 'Values cannot be negative' },
        { status: 400 }
      )
    }

    const adjustmentAmount = adjustedValueNum - originalValueNum

    const adjustment: ValuationAdjustment = {
      titleId: titleIdNum,
      warehouseId: warehouseIdNum,
      adjustmentType,
      originalValue: originalValueNum,
      adjustedValue: adjustedValueNum,
      adjustmentAmount,
      reason,
      approvedBy,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date()
    }

    const result = await InventoryValuationService.createValuationAdjustment(adjustment)

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
    console.error('POST /api/inventory/valuations/adjustments error:', error)

    return NextResponse.json(
      { error: 'Failed to create valuation adjustment' },
      { status: 500 }
    )
  }
}