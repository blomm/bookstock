import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { CreateTitleSchema } from '@/lib/validators/title'
import { z } from 'zod'
import { Format } from '@prisma/client'

/**
 * GET /api/titles
 *
 * List titles with pagination and filtering
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (searches title, author, ISBN)
 * - format: Format enum (PAPERBACK, HARDCOVER, DIGITAL, AUDIOBOOK)
 * - seriesId: number
 * - category: string
 * - publisher: string
 * - sortBy: 'title' | 'author' | 'publicationDate' | 'createdAt' (default: 'title')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 *
 * Returns: { data: Title[], pagination: { page, limit, total, totalPages } }
 */
async function getTitlesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Parse filters
    const search = searchParams.get('search') || undefined
    const format = searchParams.get('format') as Format | undefined
    const seriesId = searchParams.get('seriesId')
      ? parseInt(searchParams.get('seriesId')!)
      : undefined
    const category = searchParams.get('category') || undefined
    const publisher = searchParams.get('publisher') || undefined

    // Parse sorting
    const sortBy = (searchParams.get('sortBy') || 'title') as 'title' | 'author' | 'publicationDate' | 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'

    const result = await titleService.list({
      page,
      limit,
      search,
      format,
      seriesId,
      category,
      publisher,
      sortBy,
      sortOrder
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching titles:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch titles',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/titles
 *
 * Create a new title
 *
 * Request Body: CreateTitleInput (validated by CreateTitleSchema)
 *
 * Returns: Created title with relationships (status 201)
 *
 * Errors:
 * - 400: Validation error
 * - 409: Duplicate ISBN
 * - 500: Internal server error
 */
async function createTitleHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateTitleSchema.parse(body)

    const title = await titleService.create(data)

    return NextResponse.json(title, { status: 201 })
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

    // Duplicate ISBN error
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'DUPLICATE_ISBN'
        },
        { status: 409 }
      )
    }

    // Invalid ISBN error
    if (error instanceof Error && error.message.includes('Invalid ISBN')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INVALID_ISBN'
        },
        { status: 400 }
      )
    }

    console.error('Error creating title:', error)
    return NextResponse.json(
      {
        error: 'Failed to create title',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Apply authentication and authorization middleware
export const GET = requirePermission(
  'title:read',
  getTitlesHandler
)

export const POST = withAuditLog(
  'title:create',
  'title'
)(
  requirePermission(
    'title:create',
    createTitleHandler
  )
)
