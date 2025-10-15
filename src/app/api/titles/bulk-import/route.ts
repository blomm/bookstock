import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { BulkImportSchema } from '@/lib/validators/title'
import { z } from 'zod'

/**
 * POST /api/titles/bulk-import
 *
 * Import multiple titles from array
 *
 * Request Body: { titles: CreateTitleInput[] }
 * - Minimum 1 title, maximum 1000 titles per import
 * - Each title validated individually
 *
 * Returns: { success: number, failed: number, errors: Array<{ row, isbn, error }> }
 *
 * Errors:
 * - 400: Validation error
 * - 401: Unauthorized
 * - 403: Forbidden
 * - 500: Internal server error
 *
 * Note: Returns 200 even with partial failures. Check response body for details.
 */
async function bulkImportHandler(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const data = BulkImportSchema.parse(body)

    // Process bulk import
    const result = await titleService.bulkImport(data.titles)

    return NextResponse.json(result, { status: 200 })
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
    console.error('Error during bulk import:', error)
    return NextResponse.json(
      {
        error: 'Failed to import titles',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Apply middleware: authentication, authorization, and audit logging
export const POST = withAuditLog(
  'title:bulk-import',
  'title'
)(
  requirePermission('title:create', bulkImportHandler)
)
