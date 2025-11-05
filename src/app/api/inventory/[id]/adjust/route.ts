import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { stockMovementService } from '@/services/stockMovementService'
import { z } from 'zod'

const AdjustmentSchema = z.object({
  titleId: z.number().int(),
  warehouseId: z.number().int(),
  quantity: z.number().int(),
  notes: z.string().min(10)
})

async function adjustInventoryHandler(
  req: NextRequest & { user?: { id: string } },
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json()
    const data = AdjustmentSchema.parse(body)

    const result = await stockMovementService.recordMovement({
      titleId: data.titleId,
      warehouseId: data.warehouseId,
      movementType: 'STOCK_ADJUSTMENT',
      quantity: data.quantity,
      notes: data.notes,
      createdBy: req.user?.id || 'system'
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error adjusting inventory:', error)
    return NextResponse.json(
      { error: 'Failed to adjust inventory' },
      { status: 500 }
    )
  }
}

export const POST = requirePermission(
  'inventory:update',
  adjustInventoryHandler,
  {
    enableAuditLog: true,
    action: 'inventory:adjust',
    resource: 'inventory'
  }
)