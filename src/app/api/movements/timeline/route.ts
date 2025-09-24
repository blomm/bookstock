import { NextRequest, NextResponse } from 'next/server'
import MovementTimelineService, { TimelineFilterOptions, VisualizationOptions } from '@/services/movementTimelineService'

// GET /api/movements/timeline - Get movement timeline and visualization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const movementId = searchParams.get('movementId')

    if (!movementId) {
      return NextResponse.json(
        { error: 'movementId parameter is required' },
        { status: 400 }
      )
    }

    const id = parseInt(movementId)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid movementId parameter' },
        { status: 400 }
      )
    }

    // Parse visualization options
    const visualizationOptions: VisualizationOptions = {}

    if (searchParams.get('layout')) {
      visualizationOptions.layout = searchParams.get('layout') as any
    }
    if (searchParams.get('includeRelated')) {
      visualizationOptions.includeRelated = searchParams.get('includeRelated') === 'true'
    }
    if (searchParams.get('maxDepth')) {
      visualizationOptions.maxDepth = parseInt(searchParams.get('maxDepth')!)
    }
    if (searchParams.get('groupByWarehouse')) {
      visualizationOptions.groupByWarehouse = searchParams.get('groupByWarehouse') === 'true'
    }
    if (searchParams.get('showTimestamps')) {
      visualizationOptions.showTimestamps = searchParams.get('showTimestamps') === 'true'
    }
    if (searchParams.get('colorScheme')) {
      visualizationOptions.colorScheme = searchParams.get('colorScheme') as any
    }

    // Check if filtered timeline is requested
    const filtered = searchParams.get('filtered')
    if (filtered === 'true') {
      const filterOptions: TimelineFilterOptions = {}

      if (searchParams.get('categories')) {
        filterOptions.categories = searchParams.get('categories')!.split(',') as any[]
      }
      if (searchParams.get('impactLevels')) {
        filterOptions.impactLevels = searchParams.get('impactLevels')!.split(',') as any[]
      }
      if (searchParams.get('dateFrom')) {
        filterOptions.dateRange = filterOptions.dateRange || {}
        filterOptions.dateRange.start = new Date(searchParams.get('dateFrom')!)
      }
      if (searchParams.get('dateTo')) {
        filterOptions.dateRange = filterOptions.dateRange || {}
        filterOptions.dateRange.end = new Date(searchParams.get('dateTo')!)
      }
      if (searchParams.get('warehouses')) {
        filterOptions.warehouses = searchParams.get('warehouses')!.split(',').map(id => parseInt(id))
      }
      if (searchParams.get('movementTypes')) {
        filterOptions.movementTypes = searchParams.get('movementTypes')!.split(',') as any[]
      }
      if (searchParams.get('includeSystemEvents')) {
        filterOptions.includeSystemEvents = searchParams.get('includeSystemEvents') === 'true'
      }

      const timeline = await MovementTimelineService.getFilteredTimeline(id, filterOptions)

      return NextResponse.json({
        success: true,
        data: {
          movementId: id,
          timeline,
          filters: filterOptions
        }
      })
    }

    // Get full movement history visualization
    const visualization = await MovementTimelineService.generateMovementHistoryVisualization(
      id,
      visualizationOptions
    )

    return NextResponse.json({
      success: true,
      data: visualization
    })

  } catch (error) {
    console.error('Timeline generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate movement timeline',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/movements/timeline - Export timeline data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { movementId, format = 'json' } = body

    if (!movementId) {
      return NextResponse.json(
        { error: 'movementId is required' },
        { status: 400 }
      )
    }

    if (!['json', 'csv', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: json, csv, pdf' },
        { status: 400 }
      )
    }

    const exportData = await MovementTimelineService.exportTimelineData(movementId, format)

    // Set appropriate content type and headers
    let contentType = 'application/json'
    let filename = `movement_timeline_${movementId}.json`

    if (format === 'csv') {
      contentType = 'text/csv'
      filename = `movement_timeline_${movementId}.csv`
    } else if (format === 'pdf') {
      contentType = 'application/pdf'
      filename = `movement_timeline_${movementId}.pdf`
    }

    const response = new NextResponse(exportData)
    response.headers.set('Content-Type', contentType)
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`)

    return response

  } catch (error) {
    console.error('Timeline export error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export timeline data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}