import { NextRequest, NextResponse } from 'next/server'
import {
  removeTitleFromSeries,
  BusinessRuleError
} from '@/services/seriesService'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const titleId = parseInt(params.id)

    if (isNaN(titleId)) {
      return NextResponse.json(
        { error: 'Invalid title ID' },
        { status: 400 }
      )
    }

    await removeTitleFromSeries(titleId)

    return NextResponse.json(
      { message: 'Title removed from series successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error(`POST /api/titles/${params.id}/remove-from-series error:`, error)

    if (error instanceof BusinessRuleError) {
      const status = error.code === 'TITLE_NOT_FOUND' ? 404 : 409
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