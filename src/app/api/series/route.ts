import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createSeries,
  getAllSeries,
  ValidationError,
  BusinessRuleError
} from '@/services/seriesService'

// Request validation schemas
const createSeriesSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  parentId: z.number().int().positive().optional(),
  sortOrder: z.number().int().min(0).optional(),
  level: z.number().int().min(0).max(10).optional(),
  isActive: z.boolean().optional().default(true)
})

const querySchema = z.object({
  includeInactive: z.string().transform(val => val === 'true').optional(),
  parentId: z.string().transform(val => val === 'null' ? null : parseInt(val)).optional(),
  level: z.string().transform(val => parseInt(val)).optional(),
  page: z.string().transform(val => parseInt(val)).optional().default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val) || 50, 100)).optional().default('50'),
  orderBy: z.enum(['name', 'createdAt', 'sortOrder']).optional().default('name'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('asc')
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)

    const validatedQuery = querySchema.parse(query)

    const result = await getAllSeries({
      includeInactive: validatedQuery.includeInactive,
      parentId: validatedQuery.parentId,
      level: validatedQuery.level,
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      orderBy: validatedQuery.orderBy,
      orderDirection: validatedQuery.orderDirection
    })

    return NextResponse.json({
      data: result.series,
      pagination: {
        page: result.page,
        limit: validatedQuery.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error) {
    console.error('GET /api/series error:', error)

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createSeriesSchema.parse(body)

    const series = await createSeries(validatedData)

    return NextResponse.json(
      { data: series },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/series error:', error)

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
      const status = error.code === 'PARENT_NOT_FOUND' ? 404 : 409
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