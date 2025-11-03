import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { inventoryService } from '@/services/inventoryService'
import { z } from 'zod'

const AdjustmentSchema = z.object({
  adjustment_type: z.enum(['stock_in', 'stock_out', 'adjustment', 'transfer']),
  quantity: z.number().int(),
  reason: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional()
})

async function adjustInventoryHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json()
    const data = AdjustmentSchema.parse(body)

    const result = await inventoryService.adjustStock(params.id, {
      ...data,
      adjusted_by: req.user?.id || 'system'
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