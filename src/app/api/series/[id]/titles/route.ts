import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getSeriesTitles,
  addTitleToSeries,
  BusinessRuleError
} from '@/services/seriesService'

const querySchema = z.object({
  includeInactive: z.string().transform(val => val === 'true').optional(),
  page: z.string().transform(val => parseInt(val)).optional().default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val) || 50, 100)).optional().default('50'),
  orderBy: z.enum(['title', 'publicationDate', 'createdAt']).optional().default('title'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('asc')
})

const addTitleSchema = z.object({
  titleId: z.number().int().positive()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seriesId = parseInt(params.id)

    if (isNaN(seriesId)) {
      return NextResponse.json(
        { error: 'Invalid series ID' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)
    const validatedQuery = querySchema.parse(query)

    const result = await getSeriesTitles(seriesId, {
      includeInactive: validatedQuery.includeInactive,
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      orderBy: validatedQuery.orderBy,
      orderDirection: validatedQuery.orderDirection
    })

    return NextResponse.json({
      data: result.titles,
      pagination: {
        page: result.page,
        limit: validatedQuery.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error) {
    console.error(`GET /api/series/${params.id}/titles error:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seriesId = parseInt(params.id)

    if (isNaN(seriesId)) {
      return NextResponse.json(
        { error: 'Invalid series ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = addTitleSchema.parse(body)

    await addTitleToSeries(validatedData.titleId, seriesId)

    return NextResponse.json(
      { message: 'Title added to series successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error(`POST /api/series/${params.id}/titles error:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof BusinessRuleError) {
      const status = error.code?.includes('NOT_FOUND') ? 404 : 409
      return NextResponse.json(
        {
          error: error.message,
          code: error.code
        },
        { status }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}