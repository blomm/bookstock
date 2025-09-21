import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  reorderSeries,
  ValidationError,
  BusinessRuleError
} from '@/services/seriesService'

const reorderSchema = z.object({
  parentId: z.number().int().positive().nullable(),
  seriesOrders: z.array(z.object({
    id: z.number().int().positive(),
    sortOrder: z.number().int().min(0)
  })).min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = reorderSchema.parse(body)

    await reorderSeries(validatedData.parentId, validatedData.seriesOrders)

    return NextResponse.json(
      { message: 'Series reordered successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('POST /api/series/reorder error:', error)

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
      return NextResponse.json(
        {
          error: error.message,
          code: error.code
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}