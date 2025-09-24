import { NextRequest, NextResponse } from 'next/server'
import MovementReportingService, {
  ReportingOptions,
  TrendAnalysisOptions,
  AnomalyDetectionOptions
} from '@/services/movementReportingService'
import { MovementType } from '@prisma/client'

// GET /api/movements/reports - Get movement reports and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type')

    if (!reportType) {
      return NextResponse.json(
        { error: 'Report type parameter is required. Available types: summary, trends, efficiency, anomalies' },
        { status: 400 }
      )
    }

    // Common date parameters
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'dateFrom and dateTo parameters are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'dateFrom must be before dateTo' },
        { status: 400 }
      )
    }

    switch (reportType) {
      case 'summary':
        return handleSummaryReport(startDate, endDate, searchParams)

      case 'trends':
        return handleTrendAnalysis(startDate, endDate, searchParams)

      case 'efficiency':
        return handleEfficiencyMetrics(startDate, endDate, searchParams)

      case 'anomalies':
        return handleAnomalyDetection(startDate, endDate, searchParams)

      default:
        return NextResponse.json(
          { error: `Invalid report type: ${reportType}. Available types: summary, trends, efficiency, anomalies` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Movement reports error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate movement report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleSummaryReport(
  startDate: Date,
  endDate: Date,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const options: ReportingOptions = {}

  // Parse warehouse IDs
  const warehouseIds = searchParams.get('warehouseIds')
  if (warehouseIds) {
    options.warehouseIds = warehouseIds.split(',').map(id => {
      const num = parseInt(id.trim())
      if (isNaN(num)) throw new Error(`Invalid warehouse ID: ${id}`)
      return num
    })
  }

  // Parse movement types
  const movementTypes = searchParams.get('movementTypes')
  if (movementTypes) {
    options.movementTypes = movementTypes.split(',').map(type => {
      const trimmedType = type.trim() as MovementType
      // Validate movement type
      const validTypes = [
        'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
        'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
      ]
      if (!validTypes.includes(trimmedType)) {
        throw new Error(`Invalid movement type: ${type}`)
      }
      return trimmedType
    })
  }

  // Parse title IDs
  const titleIds = searchParams.get('titleIds')
  if (titleIds) {
    options.titleIds = titleIds.split(',').map(id => {
      const num = parseInt(id.trim())
      if (isNaN(num)) throw new Error(`Invalid title ID: ${id}`)
      return num
    })
  }

  // Parse groupBy
  const groupBy = searchParams.get('groupBy')
  if (groupBy) {
    if (!['DAY', 'WEEK', 'MONTH'].includes(groupBy)) {
      throw new Error(`Invalid groupBy value: ${groupBy}. Valid values: DAY, WEEK, MONTH`)
    }
    options.groupBy = groupBy as 'DAY' | 'WEEK' | 'MONTH'
  }

  const report = await MovementReportingService.generateMovementSummaryReport(
    startDate,
    endDate,
    options
  )

  return NextResponse.json({
    success: true,
    reportType: 'summary',
    data: report
  })
}

async function handleTrendAnalysis(
  startDate: Date,
  endDate: Date,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const lookbackDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))

  const options: TrendAnalysisOptions = {
    lookbackDays,
    detectSeasonality: searchParams.get('detectSeasonality') === 'true',
    minDataPoints: parseInt(searchParams.get('minDataPoints') || '10')
  }

  // Parse optional filters
  const titleId = searchParams.get('titleId')
  if (titleId) {
    const num = parseInt(titleId)
    if (isNaN(num)) throw new Error(`Invalid title ID: ${titleId}`)
    options.titleId = num
  }

  const warehouseId = searchParams.get('warehouseId')
  if (warehouseId) {
    const num = parseInt(warehouseId)
    if (isNaN(num)) throw new Error(`Invalid warehouse ID: ${warehouseId}`)
    options.warehouseId = num
  }

  const movementType = searchParams.get('movementType')
  if (movementType) {
    const validTypes = [
      'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
      'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
    ]
    if (!validTypes.includes(movementType)) {
      throw new Error(`Invalid movement type: ${movementType}`)
    }
    options.movementType = movementType as MovementType
  }

  const forecastDays = searchParams.get('forecastDays')
  if (forecastDays) {
    const num = parseInt(forecastDays)
    if (isNaN(num) || num < 1 || num > 365) {
      throw new Error(`Invalid forecast days: ${forecastDays}. Must be between 1 and 365`)
    }
    options.forecastDays = num
  }

  const analysis = await MovementReportingService.analyzeMovementTrends(
    startDate,
    endDate,
    options
  )

  return NextResponse.json({
    success: true,
    reportType: 'trends',
    data: analysis
  })
}

async function handleEfficiencyMetrics(
  startDate: Date,
  endDate: Date,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const warehouseId = searchParams.get('warehouseId')
  if (!warehouseId) {
    return NextResponse.json(
      { error: 'warehouseId parameter is required for efficiency metrics' },
      { status: 400 }
    )
  }

  const num = parseInt(warehouseId)
  if (isNaN(num)) {
    return NextResponse.json(
      { error: `Invalid warehouse ID: ${warehouseId}` },
      { status: 400 }
    )
  }

  const metrics = await MovementReportingService.calculateEfficiencyMetrics(
    num,
    startDate,
    endDate
  )

  return NextResponse.json({
    success: true,
    reportType: 'efficiency',
    data: metrics
  })
}

async function handleAnomalyDetection(
  startDate: Date,
  endDate: Date,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const options: AnomalyDetectionOptions = {}

  // Parse sensitivity level
  const sensitivityLevel = searchParams.get('sensitivityLevel')
  if (sensitivityLevel) {
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(sensitivityLevel)) {
      throw new Error(`Invalid sensitivity level: ${sensitivityLevel}. Valid values: LOW, MEDIUM, HIGH`)
    }
    options.sensitivityLevel = sensitivityLevel as 'LOW' | 'MEDIUM' | 'HIGH'
  }

  // Parse warehouse IDs
  const warehouseIds = searchParams.get('warehouseIds')
  if (warehouseIds) {
    options.warehouseIds = warehouseIds.split(',').map(id => {
      const num = parseInt(id.trim())
      if (isNaN(num)) throw new Error(`Invalid warehouse ID: ${id}`)
      return num
    })
  }

  // Parse movement types
  const movementTypes = searchParams.get('movementTypes')
  if (movementTypes) {
    options.movementTypes = movementTypes.split(',').map(type => {
      const trimmedType = type.trim() as MovementType
      const validTypes = [
        'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
        'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
      ]
      if (!validTypes.includes(trimmedType)) {
        throw new Error(`Invalid movement type: ${type}`)
      }
      return trimmedType
    })
  }

  // Parse z-score threshold
  const zScoreThreshold = searchParams.get('zScoreThreshold')
  if (zScoreThreshold) {
    const num = parseFloat(zScoreThreshold)
    if (isNaN(num) || num < 1.0 || num > 5.0) {
      throw new Error(`Invalid z-score threshold: ${zScoreThreshold}. Must be between 1.0 and 5.0`)
    }
    options.zScoreThreshold = num
  }

  // Parse pattern anomalies flag
  options.includePatternAnomalies = searchParams.get('includePatternAnomalies') === 'true'

  const detection = await MovementReportingService.detectMovementAnomalies(
    startDate,
    endDate,
    options
  )

  return NextResponse.json({
    success: true,
    reportType: 'anomalies',
    data: detection
  })
}

// POST /api/movements/reports - Export reports or trigger batch processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reportType, exportFormat, ...params } = body

    if (!reportType) {
      return NextResponse.json(
        { error: 'reportType is required' },
        { status: 400 }
      )
    }

    if (!params.dateFrom || !params.dateTo) {
      return NextResponse.json(
        { error: 'dateFrom and dateTo are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(params.dateFrom)
    const endDate = new Date(params.dateTo)

    let reportData: any

    switch (reportType) {
      case 'summary':
        reportData = await MovementReportingService.generateMovementSummaryReport(
          startDate,
          endDate,
          params
        )
        break

      case 'trends':
        reportData = await MovementReportingService.analyzeMovementTrends(
          startDate,
          endDate,
          { lookbackDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)), ...params }
        )
        break

      case 'efficiency':
        if (!params.warehouseId) {
          return NextResponse.json(
            { error: 'warehouseId is required for efficiency reports' },
            { status: 400 }
          )
        }
        reportData = await MovementReportingService.calculateEfficiencyMetrics(
          params.warehouseId,
          startDate,
          endDate
        )
        break

      case 'anomalies':
        reportData = await MovementReportingService.detectMovementAnomalies(
          startDate,
          endDate,
          params
        )
        break

      default:
        return NextResponse.json(
          { error: `Invalid report type: ${reportType}` },
          { status: 400 }
        )
    }

    // Handle export format
    const format = exportFormat || 'json'
    let contentType = 'application/json'
    let filename = `movement_${reportType}_report_${startDate.toISOString().split('T')[0]}.json`
    let responseData = JSON.stringify(reportData, null, 2)

    if (format === 'csv') {
      contentType = 'text/csv'
      filename = filename.replace('.json', '.csv')
      responseData = convertToCSV(reportData, reportType)
    }

    const response = new NextResponse(responseData)
    response.headers.set('Content-Type', contentType)
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`)

    return response

  } catch (error) {
    console.error('Report export error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function convertToCSV(data: any, reportType: string): string {
  switch (reportType) {
    case 'summary':
      return convertSummaryToCSV(data)
    case 'trends':
      return convertTrendsToCSV(data)
    case 'efficiency':
      return convertEfficiencyToCSV(data)
    case 'anomalies':
      return convertAnomaliesToCSV(data)
    default:
      return JSON.stringify(data)
  }
}

function convertSummaryToCSV(summary: any): string {
  const headers = ['Type', 'Count', 'Total Quantity', 'Total Value', 'Average Transaction Size', 'Percentage']
  const rows = summary.byType.map((type: any) => [
    type.movementType,
    type.count,
    type.totalQuantity,
    type.totalValue.toFixed(2),
    type.averageTransactionSize.toFixed(2),
    type.percentageOfTotal.toFixed(2) + '%'
  ])

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

function convertTrendsToCSV(trends: any): string {
  const headers = ['Date', 'Value', 'Movement Count', 'Volume In', 'Volume Out', 'Net Change']
  const rows = trends.historicalData.map((point: any) => [
    point.timestamp,
    point.value,
    point.movementCount,
    point.volumeIn,
    point.volumeOut,
    point.netChange
  ])

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

function convertEfficiencyToCSV(efficiency: any): string {
  const headers = ['Metric', 'Value']
  const rows = [
    ['Warehouse', efficiency.warehouseName],
    ['Period Start', efficiency.period.start],
    ['Period End', efficiency.period.end],
    ['Throughput Velocity', efficiency.throughputVelocity.toFixed(2)],
    ['Average Processing Time', efficiency.averageProcessingTime.toFixed(2)],
    ['Transfer Accuracy', efficiency.transferAccuracy.toFixed(2) + '%'],
    ['Error Rate', efficiency.errorRate.toFixed(2) + '%'],
    ['Utilization Score', efficiency.utilizationScore.toFixed(2)]
  ]

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

function convertAnomaliesToCSV(anomalies: any): string {
  const headers = [
    'Movement ID', 'Anomaly Type', 'Severity', 'Description', 'Expected Value',
    'Actual Value', 'Z-Score', 'Movement Type', 'Warehouse', 'Title'
  ]
  const rows = anomalies.anomalies.map((anomaly: any) => [
    anomaly.movementId,
    anomaly.anomalyType,
    anomaly.severity,
    anomaly.description,
    anomaly.expectedValue,
    anomaly.actualValue,
    anomaly.zScore.toFixed(2),
    anomaly.movement.movementType,
    anomaly.movement.warehouse,
    anomaly.movement.title
  ])

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}