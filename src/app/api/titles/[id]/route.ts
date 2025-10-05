import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { z } from 'zod'

const UpdateTitleSchema = z.object({
  isbn: z.string().min(10).max(17).optional(),
  title: z.string().min(1).max(255).optional(),
  author: z.string().min(1).max(255).optional(),
  publisher: z.string().optional(),
  publication_date: z.string().optional(),
  description: z.string().optional(),
  retail_price: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  series_id: z.string().optional()
})

async function getTitleHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const title = await titleService.findById(params.id)

    if (!title) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(title)
  } catch (error) {
    console.error('Error fetching title:', error)
    return NextResponse.json(
      { error: 'Failed to fetch title' },
      { status: 500 }
    )
  }
}

async function updateTitleHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const data = UpdateTitleSchema.parse(body)

    const title = await titleService.update(params.id, data)

    if (!title) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(title)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating title:', error)
    return NextResponse.json(
      { error: 'Failed to update title' },
      { status: 500 }
    )
  }
}

async function deleteTitleHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await titleService.delete(params.id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting title:', error)
    return NextResponse.json(
      { error: 'Failed to delete title' },
      { status: 500 }
    )
  }
}

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