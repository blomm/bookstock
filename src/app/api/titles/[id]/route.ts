import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { UpdateTitleSchema } from '@/lib/validators/title'
import { z } from 'zod'

/**
 * GET /api/titles/[id]
 *
 * Get detailed title information by ID
 *
 * Returns: Title with all relationships (series, priceHistory, inventory)
 *
 * Errors:
 * - 400: Invalid ID
 * - 404: Title not found
 * - 500: Internal server error
 */
async function getTitleHandler(
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

    const title = await titleService.findById(id)

    return NextResponse.json(title)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Title not found',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    console.error('Error fetching title:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch title',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/titles/[id]
 *
 * Update an existing title
 *
 * Request Body: UpdateTitleInput (partial, validated by UpdateTitleSchema)
 *
 * Returns: Updated title with relationships
 *
 * Errors:
 * - 400: Validation error or invalid ID
 * - 404: Title not found
 * - 409: Duplicate ISBN (if ISBN changed to existing value)
 * - 500: Internal server error
 */
async function updateTitleHandler(
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
    const data = UpdateTitleSchema.parse(body)

    const title = await titleService.update(id, data)

    return NextResponse.json(title)
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

    console.error('Error updating title:', error)
    return NextResponse.json(
      {
        error: 'Failed to update title',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/titles/[id]
 *
 * Delete a title (only if no inventory exists)
 *
 * Returns: { success: true, message: string }
 *
 * Errors:
 * - 400: Invalid ID
 * - 404: Title not found
 * - 409: Cannot delete (has inventory)
 * - 500: Internal server error
 */
async function deleteTitleHandler(
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

    await titleService.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Title deleted successfully'
    })
  } catch (error) {
    // Has inventory error
    if (error instanceof Error && error.message.includes('existing inventory')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'HAS_INVENTORY'
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
          error: 'Title not found',
          code: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    console.error('Error deleting title:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete title',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Apply authentication and authorization middleware
export const GET = requirePermission(
  'title:read',
  getTitleHandler
)

export const PUT = withAuditLog(
  'title:update',
  'title'
)(
  requirePermission(
    'title:update',
    updateTitleHandler
  )
)

export const DELETE = withAuditLog(
  'title:delete',
  'title'
)(
  requirePermission(
    'title:delete',
    deleteTitleHandler
  )
)
