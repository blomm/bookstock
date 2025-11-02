import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { seriesService } from '@/services/seriesService'
import { CreateSeriesSchema } from '@/lib/validators/series'
import { z } from 'zod'
import { SeriesStatus } from '@prisma/client'

/**
 * GET /api/series
 *
 * List series with pagination and filtering
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (searches name, description)
 * - status: SeriesStatus enum (ACTIVE, ARCHIVED)
 * - sortBy: 'name' | 'createdAt' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 *
 * Returns: { data: Series[], pagination: { page, limit, total, totalPages } }
 */
async function getSeriesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // TODO: Get organizationId from authenticated user context
    // For now, using a placeholder - will be replaced with actual org from Clerk auth
    const organizationId = searchParams.get('organizationId') || 'default-org'

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Parse filters
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') as SeriesStatus | undefined

    // Parse sorting
    const sortBy = (searchParams.get('sortBy') || 'name') as 'name' | 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'

    const result = await seriesService.getSeriesList({
      page,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
      organizationId
    })

    return NextResponse.json(result)
  } catch (error) {
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
 * POST /api/series
 *
 * Create a new series
 *
 * Request Body: CreateSeriesInput (validated by CreateSeriesSchema)
 *
 * Returns: Created series (status 201)
 *
 * Errors:
 * - 400: Validation error
 * - 409: Duplicate series name in organization
 * - 500: Internal server error
 */
async function createSeriesHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateSeriesSchema.parse(body)

    // TODO: Get organizationId from authenticated user context
    // For now, ensure organizationId is provided in the request body
    if (!data.organizationId) {
      return NextResponse.json(
        {
          error: 'organizationId is required',
          code: 'MISSING_ORGANIZATION'
        },
        { status: 400 }
      )
    }

    const series = await seriesService.createSeries(data)

    return NextResponse.json(series, { status: 201 })
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

    console.error('Error creating series:', error)
    return NextResponse.json(
      {
        error: 'Failed to create series',
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

export const POST = withAuditLog(
  'series:create',
  'series'
)(
  requirePermission(
    'series:create',
    createSeriesHandler
  )
)
