import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withAuditLog } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { z } from 'zod'

const CreateTitleSchema = z.object({
  isbn: z.string().min(10).max(17),
  title: z.string().min(1).max(255),
  author: z.string().min(1).max(255),
  publisher: z.string().optional(),
  publication_date: z.string().optional(),
  description: z.string().optional(),
  retail_price: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  series_id: z.string().optional()
})

const UpdateTitleSchema = CreateTitleSchema.partial()

async function getTitlesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const seriesId = searchParams.get('seriesId') || undefined

    const result = await titleService.list({
      page,
      limit,
      search,
      seriesId
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching titles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch titles' },
      { status: 500 }
    )
  }
}

async function createTitleHandler(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateTitleSchema.parse(body)

    const title = await titleService.create(data)

    return NextResponse.json(title, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating title:', error)
    return NextResponse.json(
      { error: 'Failed to create title' },
      { status: 500 }
    )
  }
}

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