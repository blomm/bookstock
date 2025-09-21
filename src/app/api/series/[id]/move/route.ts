import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  moveSeries,
  ValidationError,
  BusinessRuleError
} from '@/services/seriesService'

const moveSeriesSchema = z.object({
  newParentId: z.number().int().positive().nullable(),
  newSortOrder: z.number().int().min(0).optional()
})

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
    const validatedData = moveSeriesSchema.parse(body)

    const series = await moveSeries(
      seriesId,
      validatedData.newParentId,
      validatedData.newSortOrder
    )

    return NextResponse.json({ data: series })
  } catch (error) {
    console.error(`POST /api/series/${params.id}/move error:`, error)

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