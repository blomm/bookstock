import { NextRequest, NextResponse } from 'next/server'
import {
  getSearchPerformanceStats,
  warmSearchCache
} from '@/services/searchService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'warm-cache') {
      await warmSearchCache()
      return NextResponse.json({
        message: 'Search cache warmed successfully',
        timestamp: new Date().toISOString()
      })
    }

    const stats = await getSearchPerformanceStats()

    return NextResponse.json({
      data: stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('GET /api/search/performance error:', error)

    return NextResponse.json(
      { error: 'Performance monitoring error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'warm-cache') {
      await warmSearchCache()
      return NextResponse.json({
        message: 'Search cache warmed successfully',
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('POST /api/search/performance error:', error)

    return NextResponse.json(
      { error: 'Performance action error' },
      { status: 500 }
    )
  }
}