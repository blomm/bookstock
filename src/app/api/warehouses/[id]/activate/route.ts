import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'

async function activateWarehouseHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid warehouse ID' },
        { status: 400 }
      )
    }

    const warehouse = await warehouseService.activate(id)

    return NextResponse.json(warehouse)
  } catch (error) {
    // Handle warehouse not found error
    if (error instanceof Error && error.message === 'Warehouse not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    console.error('Error activating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to activate warehouse' },
      { status: 500 }
    )
  }
}

export const PATCH = withAuditLog(
  'warehouse:update',
  'warehouse'
)(
  requirePermission(
    'warehouse:update',
    activateWarehouseHandler
  )
)
