import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { warehouseService } from '@/services/warehouseService'

async function deactivateWarehouseHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const id = parseInt(paramId)
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

export const PATCH = requirePermission(
  'warehouse:update',
  deactivateWarehouseHandler,
  {
    enableAuditLog: true,
    action: 'warehouse:update',
    resource: 'warehouse'
  }
)
