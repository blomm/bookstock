import { NextRequest, NextResponse } from 'next/server'
import StockMovementAuditService, { AuditSearchOptions } from '@/services/stockMovementAuditService'

// GET /api/movements/audit - Search audit entries or get specific movement audit trail
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const movementId = searchParams.get('movementId')

    // If specific movement ID provided, return full audit trail
    if (movementId) {
      const auditTrail = await StockMovementAuditService.getMovementAuditTrail(parseInt(movementId))

      if (!auditTrail) {
        return NextResponse.json(
          { error: 'Movement not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: auditTrail
      })
    }

    // Otherwise, search audit entries
    const searchOptions: AuditSearchOptions = {}

    if (searchParams.get('titleId')) {
      searchOptions.titleId = parseInt(searchParams.get('titleId')!)
    }
    if (searchParams.get('warehouseId')) {
      searchOptions.warehouseId = parseInt(searchParams.get('warehouseId')!)
    }
    if (searchParams.get('performedBy')) {
      searchOptions.performedBy = searchParams.get('performedBy')!
    }
    if (searchParams.get('action')) {
      searchOptions.action = searchParams.get('action') as any
    }
    if (searchParams.get('dateFrom')) {
      searchOptions.dateFrom = new Date(searchParams.get('dateFrom')!)
    }
    if (searchParams.get('dateTo')) {
      searchOptions.dateTo = new Date(searchParams.get('dateTo')!)
    }
    if (searchParams.get('limit')) {
      searchOptions.limit = parseInt(searchParams.get('limit')!)
    }
    if (searchParams.get('offset')) {
      searchOptions.offset = parseInt(searchParams.get('offset')!)
    }

    const auditEntries = await StockMovementAuditService.searchAuditEntries(searchOptions)

    return NextResponse.json({
      success: true,
      data: auditEntries,
      pagination: {
        limit: searchOptions.limit || 50,
        offset: searchOptions.offset || 0,
        total: auditEntries.length
      }
    })

  } catch (error) {
    console.error('Audit search error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search audit entries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/movements/audit - Create audit entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      movementId,
      action,
      performedBy,
      oldValues,
      newValues,
      reason,
      ipAddress,
      userAgent,
      metadata
    } = body

    // Validation
    if (!movementId || !action || !performedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: movementId, action, performedBy' },
        { status: 400 }
      )
    }

    const auditEntry = await StockMovementAuditService.createAuditEntry(
      movementId,
      action,
      performedBy,
      {
        oldValues,
        newValues,
        reason,
        ipAddress,
        userAgent,
        metadata
      }
    )

    return NextResponse.json({
      success: true,
      data: auditEntry
    }, { status: 201 })

  } catch (error) {
    console.error('Audit entry creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create audit entry',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}