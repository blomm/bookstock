import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'

async function deactivateWarehouseHandler(
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

    const warehouse = await warehouseService.deactivate(id)

    return NextResponse.json(warehouse)
  } catch (error) {
    // Handle warehouse not found error
    if (error instanceof Error && error.message === 'Warehouse not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    console.error('Error deactivating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate warehouse' },
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
    deactivateWarehouseHandler
  )
)
