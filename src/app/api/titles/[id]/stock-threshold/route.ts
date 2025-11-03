import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { inventoryService } from '@/services/inventoryService'
import { UpdateLowStockThresholdSchema } from '@/lib/validators/inventory'
import { z } from 'zod'

/**
 * PATCH /api/titles/[id]/stock-threshold
 *
 * Updates low stock threshold for a title
 *
 * Request Body:
 * - lowStockThreshold: number | null (nullable integer >= 0)
 *
 * Returns: Updated title
 *
 * Errors:
 * - 400: Validation error or invalid ID
 * - 404: Title not found
 * - 500: Internal server error
 */
async function updateStockThresholdHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const id = parseInt(paramId)

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid title ID',
          code: 'INVALID_ID'
        },
        { status: 400 }
      )
    }

    const body = await req.json()

    // Validate with Zod schema
    const data = UpdateLowStockThresholdSchema.parse(body)

    // Update the threshold
    const title = await inventoryService.updateStockThreshold(
      id,
      data.lowStockThreshold
    )

    return NextResponse.json({
      data: title,
      message: 'Low stock threshold updated successfully'
    })
  } catch (error) {
    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    // Not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Title not found',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    console.error('Error updating stock threshold:', error)
    return NextResponse.json(
      {
        error: 'Failed to update stock threshold',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

export const PATCH = requirePermission(
  'title:update',
  updateStockThresholdHandler,
  {
    enableAuditLog: true,
    action: 'title:update_threshold',
    resource: 'title'
  }
)
