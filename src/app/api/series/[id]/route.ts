import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getSeries,
  updateSeries,
  deleteSeries,
  getSeriesAnalytics,
  ValidationError,
  BusinessRuleError
} from '@/services/seriesService'

// Request validation schemas
const updateSeriesSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  level: z.number().int().min(0).max(10).optional(),
  isActive: z.boolean().optional()
})

const querySchema = z.object({
  includeTitles: z.string().transform(val => val === 'true').optional(),
  includeChildren: z.string().transform(val => val === 'true').optional(),
  includeParent: z.string().transform(val => val === 'true').optional(),
  includeAnalytics: z.string().transform(val => val === 'true').optional()
})

const deleteQuerySchema = z.object({
  force: z.string().transform(val => val === 'true').optional()
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

    // Check if this is an analytics request
    if (searchParams.get('analytics') === 'true') {
      const analytics = await getSeriesAnalytics(seriesId)
      return NextResponse.json({ data: analytics })
    }

    const series = await getSeries(seriesId, {
      includeTitles: validatedQuery.includeTitles,
      includeChildren: validatedQuery.includeChildren,
      includeParent: validatedQuery.includeParent,
      includeAnalytics: validatedQuery.includeAnalytics
    })

    return NextResponse.json({ data: series })
  } catch (error) {
    console.error(`GET /api/series/${params.id} error:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof BusinessRuleError && error.code === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const validatedData = updateSeriesSchema.parse(body)

    const series = await updateSeries(seriesId, validatedData)

    return NextResponse.json({ data: series })
  } catch (error) {
    console.error(`PUT /api/series/${params.id} error:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field
        },
        { status: 400 }
      )
    }

    if (error instanceof BusinessRuleError) {
      let status = 409
      if (error.code === 'NOT_FOUND' || error.code === 'PARENT_NOT_FOUND') {
        status = 404
      }

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

export async function DELETE(
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
    const validatedQuery = deleteQuerySchema.parse(query)

    await deleteSeries(seriesId, {
      force: validatedQuery.force
    })

    return NextResponse.json(
      { message: 'Series deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error(`DELETE /api/series/${params.id} error:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof BusinessRuleError) {
      let status = 409
      if (error.code === 'NOT_FOUND') {
        status = 404
      }

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