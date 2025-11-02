import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { seriesService } from '@/services/seriesService'
import { UpdateSeriesSchema } from '@/lib/validators/series'
import { z } from 'zod'

/**
 * GET /api/series/[id]
 *
 * Get detailed series information by ID
 *
 * Returns: Series with title count
 *
 * Errors:
 * - 400: Invalid ID
 * - 404: Series not found
 * - 500: Internal server error
 */
async function getSeriesHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid series ID',
          code: 'INVALID_ID'
        },
        { status: 400 }
      )
    }

    // TODO: Get organizationId from authenticated user context
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId') || 'default-org'

    const series = await seriesService.getSeriesById(id, organizationId)

    return NextResponse.json(series)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Series not found',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    console.error('Error fetching series:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch series',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/series/[id]
 *
 * Update an existing series
 *
 * Request Body: UpdateSeriesInput (partial, validated by UpdateSeriesSchema)
 *
 * Returns: Updated series
 *
 * Errors:
 * - 400: Validation error or invalid ID
 * - 404: Series not found
 * - 409: Duplicate series name (if name changed to existing value)
 * - 500: Internal server error
 */
async function updateSeriesHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid series ID',
          code: 'INVALID_ID'
        },
        { status: 400 }
      )
    }

    const body = await req.json()
    const data = UpdateSeriesSchema.parse(body)

    // TODO: Get organizationId from authenticated user context
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId') || body.organizationId || 'default-org'

    const series = await seriesService.updateSeries(id, organizationId, data)

    return NextResponse.json(series)
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
          error: 'Series not found',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Duplicate series name error
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'DUPLICATE_SERIES'
        },
        { status: 409 }
      )
    }

    console.error('Error updating series:', error)
    return NextResponse.json(
      {
        error: 'Failed to update series',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/series/[id]
 *
 * Delete a series (only if no titles are associated)
 *
 * Returns: { success: true, message: string }
 *
 * Errors:
 * - 400: Invalid ID
 * - 404: Series not found
 * - 409: Cannot delete (has associated titles)
 * - 500: Internal server error
 */
async function deleteSeriesHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid series ID',
          code: 'INVALID_ID'
        },
        { status: 400 }
      )
    }

    // TODO: Get organizationId from authenticated user context
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId') || 'default-org'

    await seriesService.deleteSeries(id, organizationId)

    return NextResponse.json({
      success: true,
      message: 'Series deleted successfully'
    })
  } catch (error) {
    // Has titles error
    if (error instanceof Error && error.message.includes('associated titles')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'HAS_TITLES'
        },
        { status: 409 }
      )
    }

    // Not found error (from Prisma delete)
    if (error instanceof Error && (
      error.message.includes('not found') ||
      error.message.includes('Record to delete does not exist')
    )) {
      return NextResponse.json(
        {
          error: 'Series not found',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    console.error('Error deleting series:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete series',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Apply authentication and authorization middleware
export const GET = requirePermission(
  'series:read',
  getSeriesHandler
)

export const PUT = withAuditLog(
  'series:update',
  'series'
)(
  requirePermission(
    'series:update',
    updateSeriesHandler
  )
)

export const DELETE = withAuditLog(
  'series:delete',
  'series'
)(
  requirePermission(
    'series:delete',
    deleteSeriesHandler
  )
)
