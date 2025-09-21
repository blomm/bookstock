import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getSeriesAnalytics,
  getHierarchyAnalytics,
  BusinessRuleError
} from '@/services/seriesService'

const querySchema = z.object({
  includeHierarchy: z.string().transform(val => val === 'true').optional()
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

    let analytics
    if (validatedQuery.includeHierarchy) {
      analytics = await getHierarchyAnalytics(seriesId)
    } else {
      analytics = await getSeriesAnalytics(seriesId)
    }

    return NextResponse.json({ data: analytics })
  } catch (error) {
    console.error(`GET /api/series/${params.id}/analytics error:`, error)

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