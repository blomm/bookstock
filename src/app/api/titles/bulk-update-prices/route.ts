import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { BulkUpdatePricesSchema } from '@/lib/validators/title'
import { z } from 'zod'

/**
 * PUT /api/titles/bulk-update-prices
 *
 * Update prices for multiple titles with price history tracking
 *
 * Request Body: {
 *   updates: Array<{ id: number, rrp?: number, unitCost?: number, tradeDiscount?: number }>,
 *   reason: string
 * }
 * - Minimum 1 update, maximum 1000 updates per request
 * - At least one price field must be provided per update
 * - Reason is required for price history tracking
 *
 * Returns: Array<{ success: boolean, id: number, title?: Title, error?: string }>
 *
 * Errors:
 * - 400: Validation error
 * - 401: Unauthorized
 * - 403: Forbidden
 * - 500: Internal server error
 *
 * Note: Returns 200 even with partial failures. Check response array for individual results.
 */
async function bulkUpdatePricesHandler(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const data = BulkUpdatePricesSchema.parse(body)

    // Process bulk price updates
    const results = await titleService.bulkUpdatePrices(
      data.updates,
      data.reason
    )

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    // Validation error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    // Internal error
    console.error('Error during bulk price update:', error)
    return NextResponse.json(
      {
        error: 'Failed to update prices',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Apply middleware: authentication, authorization, and audit logging
export const PUT = withAuditLog(
  'title:bulk-update-prices',
  'title'
)(
  requirePermission('title:update', bulkUpdatePricesHandler)
)
