import { PrismaClient, MovementType, Prisma } from '@prisma/client'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Core interfaces for reporting
export interface MovementSummaryReport {
  periodStart: Date
  periodEnd: Date
  summary: {
    totalMovements: number
    totalQuantityIn: number
    totalQuantityOut: number
    totalValueProcessed: number
    uniqueTitles: number
    uniqueWarehouses: number
  }
  byType: MovementTypeAnalysis[]
  byWarehouse: WarehouseAnalysis[]
  byTimeGranularity: TimeSeriesData[]
}

export interface MovementTypeAnalysis {
  movementType: MovementType
  count: number
  totalQuantity: number
  totalValue: number
  averageTransactionSize: number
  percentageOfTotal: number
}

export interface WarehouseAnalysis {
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  totalMovements: number
  totalQuantityIn: number
  totalQuantityOut: number
  totalValue: number
  percentageOfTotal: number
}

export interface TimeSeriesData {
  timestamp: Date
  value: number
  movementCount: number
  volumeIn: number
  volumeOut: number
  netChange: number
}

export interface MovementTrendAnalysis {
  titleId?: number
  warehouseId?: number
  movementType?: MovementType
  period: { start: Date; end: Date }
  historicalData: TimeSeriesData[]
  trendDirection: 'INCREASING' | 'DECREASING' | 'STABLE'
  trendStrength: number // 0-1, where 1 is strong trend
  seasonalityDetected: boolean
  seasonalityPeriod?: number // days
  forecastData: ForecastPoint[]
  confidence: number
  statisticalSummary: {
    mean: number
    standardDeviation: number
    variance: number
    correlation: number
  }
}

export interface ForecastPoint {
  timestamp: Date
  predictedValue: number
  confidenceInterval: {
    upper: number
    lower: number
  }
  confidence: number
}

export interface MovementEfficiencyMetrics {
  warehouseId: number
  warehouseName: string
  period: { start: Date; end: Date }
  throughputVelocity: number // movements per day
  averageProcessingTime: number // minutes (estimated)
  transferAccuracy: number // percentage
  errorRate: number // percentage
  utilizationScore: number // 0-100
  performanceBreakdown: {
    inboundEfficiency: number
    outboundEfficiency: number
    transferEfficiency: number
    adjustmentFrequency: number
  }
  benchmarkComparison: {
    percentile: number
    industryAverage: number
    topPerformer: number
  }
}

export interface MovementAnomalyDetection {
  anomalies: MovementAnomaly[]
  detectionPeriod: { start: Date; end: Date }
  totalMovementsAnalyzed: number
  anomaliesFound: number
  severityBreakdown: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number>
  detectionStatistics: {
    meanValue: number
    standardDeviation: number
    outlierThreshold: number
    zScoreThreshold: number
  }
}

export interface MovementAnomaly {
  movementId: number
  anomalyType: 'QUANTITY' | 'TIMING' | 'FREQUENCY' | 'VALUE' | 'PATTERN'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  detectedAt: Date
  expectedValue: number
  actualValue: number
  deviationScore: number
  zScore: number
  movement: {
    movementType: MovementType
    quantity: number
    movementDate: Date
    warehouse: string
    title: string
  }
}

export interface ReportingOptions {
  warehouseIds?: number[]
  movementTypes?: MovementType[]
  titleIds?: number[]
  groupBy?: 'DAY' | 'WEEK' | 'MONTH'
  includeForecasting?: boolean
  forecastDays?: number
}

export interface TrendAnalysisOptions {
  titleId?: number
  warehouseId?: number
  movementType?: MovementType
  lookbackDays: number
  forecastDays?: number
  detectSeasonality?: boolean
  minDataPoints?: number
}

export interface AnomalyDetectionOptions {
  sensitivityLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  warehouseIds?: number[]
  movementTypes?: MovementType[]
  zScoreThreshold?: number
  includePatternAnomalies?: boolean
}

class MovementReportingService {

  // Sub-task 1: Build movement summary reports by type and period
  static async generateMovementSummaryReport(
    dateFrom: Date,
    dateTo: Date,
    options: ReportingOptions = {}
  ): Promise<MovementSummaryReport> {
    try {
      // Validate date range
      if (dateFrom >= dateTo) {
        throw new Error('dateFrom must be before dateTo')
      }
      // Build base query filters
      const whereClause: any = {
        movementDate: {
          gte: dateFrom,
          lte: dateTo
        }
      }

      if (options.warehouseIds && options.warehouseIds.length > 0) {
        whereClause.warehouseId = { in: options.warehouseIds }
      }

      if (options.movementTypes && options.movementTypes.length > 0) {
        whereClause.movementType = { in: options.movementTypes }
      }

      if (options.titleIds && options.titleIds.length > 0) {
        whereClause.titleId = { in: options.titleIds }
      }

      // Get movements with related data
      const movements = await dbClient.stockMovement.findMany({
        where: whereClause,
        include: {
          title: {
            select: { title: true, isbn: true }
          },
          warehouse: {
            select: { name: true, code: true }
          }
        },
        orderBy: { movementDate: 'asc' }
      })

      // Calculate summary statistics
      const summary = {
        totalMovements: movements.length,
        totalQuantityIn: movements
          .filter(m => m.quantity > 0)
          .reduce((sum, m) => sum + m.quantity, 0),
        totalQuantityOut: Math.abs(movements
          .filter(m => m.quantity < 0)
          .reduce((sum, m) => sum + m.quantity, 0)),
        totalValueProcessed: movements
          .reduce((sum, m) => {
            const value = m.rrpAtTime ? parseFloat(m.rrpAtTime.toString()) : 0
            return sum + (value * Math.abs(m.quantity))
          }, 0),
        uniqueTitles: new Set(movements.map(m => m.titleId)).size,
        uniqueWarehouses: new Set(movements.map(m => m.warehouseId)).size
      }

      // Analyze by movement type
      const byType = await this.analyzeByMovementType(movements)

      // Analyze by warehouse
      const byWarehouse = await this.analyzeByWarehouse(movements)

      // Generate time series data
      const byTimeGranularity = await this.generateTimeSeriesData(
        movements,
        dateFrom,
        dateTo,
        options.groupBy || 'DAY'
      )

      return {
        periodStart: dateFrom,
        periodEnd: dateTo,
        summary,
        byType,
        byWarehouse,
        byTimeGranularity
      }
    } catch (error) {
      throw new Error(`Failed to generate movement summary report: ${error}`)
    }
  }

  private static analyzeByMovementType(movements: any[]): MovementTypeAnalysis[] {
    const typeMap = new Map<MovementType, {
      count: number
      totalQuantity: number
      totalValue: number
    }>()

    let totalValue = 0

    // Aggregate by movement type
    movements.forEach(movement => {
      const type = movement.movementType
      const quantity = Math.abs(movement.quantity)
      const value = movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * quantity : 0

      if (!typeMap.has(type)) {
        typeMap.set(type, { count: 0, totalQuantity: 0, totalValue: 0 })
      }

      const typeData = typeMap.get(type)!
      typeData.count++
      typeData.totalQuantity += quantity
      typeData.totalValue += value
      totalValue += value
    })

    // Convert to analysis format
    return Array.from(typeMap.entries()).map(([movementType, data]) => ({
      movementType,
      count: data.count,
      totalQuantity: data.totalQuantity,
      totalValue: data.totalValue,
      averageTransactionSize: data.totalQuantity / data.count,
      percentageOfTotal: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0
    })).sort((a, b) => b.count - a.count)
  }

  private static analyzeByWarehouse(movements: any[]): WarehouseAnalysis[] {
    const warehouseMap = new Map<number, {
      name: string
      code: string
      totalMovements: number
      totalQuantityIn: number
      totalQuantityOut: number
      totalValue: number
    }>()

    let totalValue = 0

    // Aggregate by warehouse
    movements.forEach(movement => {
      const warehouseId = movement.warehouseId
      const quantity = movement.quantity
      const value = movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * Math.abs(quantity) : 0

      if (!warehouseMap.has(warehouseId)) {
        warehouseMap.set(warehouseId, {
          name: movement.warehouse.name,
          code: movement.warehouse.code,
          totalMovements: 0,
          totalQuantityIn: 0,
          totalQuantityOut: 0,
          totalValue: 0
        })
      }

      const warehouseData = warehouseMap.get(warehouseId)!
      warehouseData.totalMovements++
      if (quantity > 0) {
        warehouseData.totalQuantityIn += quantity
      } else {
        warehouseData.totalQuantityOut += Math.abs(quantity)
      }
      warehouseData.totalValue += value
      totalValue += value
    })

    // Convert to analysis format
    return Array.from(warehouseMap.entries()).map(([warehouseId, data]) => ({
      warehouseId,
      warehouseName: data.name,
      warehouseCode: data.code,
      totalMovements: data.totalMovements,
      totalQuantityIn: data.totalQuantityIn,
      totalQuantityOut: data.totalQuantityOut,
      totalValue: data.totalValue,
      percentageOfTotal: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0
    })).sort((a, b) => b.totalMovements - a.totalMovements)
  }

  private static generateTimeSeriesData(
    movements: any[],
    dateFrom: Date,
    dateTo: Date,
    groupBy: 'DAY' | 'WEEK' | 'MONTH'
  ): TimeSeriesData[] {
    const timeSeriesMap = new Map<string, {
      movementCount: number
      volumeIn: number
      volumeOut: number
      value: number
    }>()

    // Generate time buckets
    const buckets = this.generateTimeBuckets(dateFrom, dateTo, groupBy)
    buckets.forEach(bucket => {
      timeSeriesMap.set(bucket, {
        movementCount: 0,
        volumeIn: 0,
        volumeOut: 0,
        value: 0
      })
    })

    // Aggregate movements into time buckets
    movements.forEach(movement => {
      const bucket = this.getTimeBucket(movement.movementDate, groupBy)
      if (timeSeriesMap.has(bucket)) {
        const data = timeSeriesMap.get(bucket)!
        const quantity = movement.quantity
        const value = movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * Math.abs(quantity) : 0

        data.movementCount++
        if (quantity > 0) {
          data.volumeIn += quantity
        } else {
          data.volumeOut += Math.abs(quantity)
        }
        data.value += value
      }
    })

    // Convert to time series format
    return Array.from(timeSeriesMap.entries())
      .map(([bucket, data]) => ({
        timestamp: new Date(bucket),
        value: data.value,
        movementCount: data.movementCount,
        volumeIn: data.volumeIn,
        volumeOut: data.volumeOut,
        netChange: data.volumeIn - data.volumeOut
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  // Sub-task 2: Implement movement trend analysis and forecasting
  static async analyzeMovementTrends(
    dateFrom: Date,
    dateTo: Date,
    options: TrendAnalysisOptions
  ): Promise<MovementTrendAnalysis> {
    try {
      // Build query filters
      const whereClause: any = {
        movementDate: {
          gte: dateFrom,
          lte: dateTo
        }
      }

      if (options.titleId) whereClause.titleId = options.titleId
      if (options.warehouseId) whereClause.warehouseId = options.warehouseId
      if (options.movementType) whereClause.movementType = options.movementType

      // Get movement data
      const movements = await dbClient.stockMovement.findMany({
        where: whereClause,
        orderBy: { movementDate: 'asc' }
      })

      if (movements.length < (options.minDataPoints || 10)) {
        throw new Error('Insufficient data points for trend analysis')
      }

      // Generate historical time series
      const historicalData = this.generateTimeSeriesData(
        movements,
        dateFrom,
        dateTo,
        'DAY'
      )

      // Perform trend analysis
      const trendAnalysis = this.performTrendAnalysis(historicalData)

      // Detect seasonality if requested
      let seasonalityDetected = false
      let seasonalityPeriod: number | undefined

      if (options.detectSeasonality && historicalData.length >= 14) {
        const seasonality = this.detectSeasonality(historicalData)
        seasonalityDetected = seasonality.detected
        seasonalityPeriod = seasonality.period
      }

      // Generate forecasts if requested
      let forecastData: ForecastPoint[] = []
      if (options.forecastDays && options.forecastDays > 0) {
        forecastData = this.generateForecast(
          historicalData,
          options.forecastDays,
          trendAnalysis,
          { detected: seasonalityDetected, period: seasonalityPeriod }
        )
      }

      // Calculate statistical summary
      const values = historicalData.map(d => d.value)
      const statisticalSummary = this.calculateStatisticalSummary(values)

      return {
        titleId: options.titleId,
        warehouseId: options.warehouseId,
        movementType: options.movementType,
        period: { start: dateFrom, end: dateTo },
        historicalData,
        trendDirection: trendAnalysis.direction,
        trendStrength: trendAnalysis.strength,
        seasonalityDetected,
        seasonalityPeriod,
        forecastData,
        confidence: trendAnalysis.confidence,
        statisticalSummary
      }
    } catch (error) {
      throw new Error(`Failed to analyze movement trends: ${error}`)
    }
  }

  private static performTrendAnalysis(data: TimeSeriesData[]): {
    direction: 'INCREASING' | 'DECREASING' | 'STABLE'
    strength: number
    confidence: number
  } {
    if (data.length < 2) {
      return { direction: 'STABLE', strength: 0, confidence: 0 }
    }

    // Simple linear regression to detect trend
    const n = data.length
    const x = data.map((_, i) => i) // time points
    const y = data.map(d => d.value) // values

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate correlation coefficient
    const meanX = sumX / n
    const meanY = sumY / n

    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0)
    const denomX = Math.sqrt(x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0))
    const denomY = Math.sqrt(y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0))

    const correlation = denomX * denomY !== 0 ? numerator / (denomX * denomY) : 0

    // Determine trend direction and strength
    const direction: 'INCREASING' | 'DECREASING' | 'STABLE' =
      Math.abs(slope) < 0.1 ? 'STABLE' : slope > 0 ? 'INCREASING' : 'DECREASING'

    const strength = Math.abs(correlation)
    const confidence = Math.min(Math.abs(correlation) * 100, 100)

    return { direction, strength, confidence }
  }

  private static detectSeasonality(data: TimeSeriesData[]): { detected: boolean; period?: number } {
    if (data.length < 14) return { detected: false }

    // Simple periodicity detection using autocorrelation
    const values = data.map(d => d.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length

    // Test common seasonal periods (7, 14, 30 days)
    const testPeriods = [7, 14, 30].filter(p => p < values.length / 2)

    for (const period of testPeriods) {
      let correlation = 0
      let count = 0

      for (let i = 0; i < values.length - period; i++) {
        correlation += (values[i] - mean) * (values[i + period] - mean)
        count++
      }

      if (count > 0) {
        correlation /= count
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
        const normalizedCorr = correlation / variance

        if (normalizedCorr > 0.3) { // Threshold for seasonality detection
          return { detected: true, period }
        }
      }
    }

    return { detected: false }
  }

  private static generateForecast(
    historicalData: TimeSeriesData[],
    forecastDays: number,
    trendAnalysis: any,
    seasonality: { detected: boolean; period?: number }
  ): ForecastPoint[] {
    const forecast: ForecastPoint[] = []
    const lastDataPoint = historicalData[historicalData.length - 1]
    const values = historicalData.map(d => d.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length)

    // Simple trend-based forecasting
    const trendSlope = trendAnalysis.direction === 'INCREASING' ? stdDev * 0.1 :
                      trendAnalysis.direction === 'DECREASING' ? -stdDev * 0.1 : 0

    for (let i = 1; i <= forecastDays; i++) {
      const futureDate = new Date(lastDataPoint.timestamp.getTime() + i * 24 * 60 * 60 * 1000)

      // Base prediction using trend
      let predictedValue = lastDataPoint.value + (trendSlope * i)

      // Apply seasonal adjustment if detected
      if (seasonality.detected && seasonality.period) {
        const seasonalIndex = i % seasonality.period
        const historicalSeasonal = historicalData[historicalData.length - seasonality.period + seasonalIndex]
        if (historicalSeasonal) {
          const seasonalAdjustment = (historicalSeasonal.value - mean) * 0.3
          predictedValue += seasonalAdjustment
        }
      }

      // Calculate confidence interval
      const confidence = Math.max(0.1, 1 - (i / forecastDays) * 0.5) // Decreasing confidence over time
      const intervalWidth = stdDev * (2 - confidence)

      forecast.push({
        timestamp: futureDate,
        predictedValue: Math.max(0, predictedValue),
        confidenceInterval: {
          upper: Math.max(0, predictedValue + intervalWidth),
          lower: Math.max(0, predictedValue - intervalWidth)
        },
        confidence: confidence * 100
      })
    }

    return forecast
  }

  private static calculateStatisticalSummary(values: number[]): {
    mean: number
    standardDeviation: number
    variance: number
    correlation: number
  } {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    const standardDeviation = Math.sqrt(variance)

    // Simple autocorrelation at lag 1
    let correlation = 0
    if (values.length > 1) {
      const numerator = values.slice(1).reduce((sum, v, i) => sum + (values[i] - mean) * (v - mean), 0)
      const denominator = variance * (values.length - 1)
      correlation = denominator !== 0 ? numerator / denominator : 0
    }

    return { mean, standardDeviation, variance, correlation }
  }

  // Sub-task 3: Add movement efficiency and accuracy metrics
  static async calculateEfficiencyMetrics(
    warehouseId: number,
    dateFrom: Date,
    dateTo: Date
  ): Promise<MovementEfficiencyMetrics> {
    try {
      // Get warehouse information
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id: warehouseId },
        select: { name: true, code: true }
      })

      if (!warehouse) {
        throw new Error(`Warehouse ${warehouseId} not found`)
      }

      // Get movements for the warehouse
      const movements = await dbClient.stockMovement.findMany({
        where: {
          warehouseId,
          movementDate: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        include: {
          title: { select: { title: true } }
        },
        orderBy: { movementDate: 'asc' }
      })

      if (movements.length === 0) {
        throw new Error(`No movements found for warehouse ${warehouseId} in the specified period`)
      }

      // Calculate period duration in days
      const periodDays = Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000)))

      // Calculate throughput velocity (movements per day)
      const throughputVelocity = movements.length / periodDays

      // Estimate average processing time (simplified)
      const averageProcessingTime = this.estimateProcessingTime(movements)

      // Calculate transfer accuracy
      const transferAccuracy = await this.calculateTransferAccuracy(movements, warehouseId, dateFrom, dateTo)

      // Calculate error rate (movements with issues)
      const errorRate = this.calculateErrorRate(movements)

      // Calculate utilization score
      const utilizationScore = this.calculateUtilizationScore(movements, throughputVelocity)

      // Performance breakdown
      const performanceBreakdown = this.calculatePerformanceBreakdown(movements)

      // Benchmark comparison (simulated)
      const benchmarkComparison = this.calculateBenchmarkComparison(throughputVelocity, transferAccuracy)

      return {
        warehouseId,
        warehouseName: warehouse.name,
        period: { start: dateFrom, end: dateTo },
        throughputVelocity,
        averageProcessingTime,
        transferAccuracy,
        errorRate,
        utilizationScore,
        performanceBreakdown,
        benchmarkComparison
      }
    } catch (error) {
      throw new Error(`Failed to calculate efficiency metrics: ${error}`)
    }
  }

  private static estimateProcessingTime(movements: any[]): number {
    // Simplified estimation based on movement complexity
    let totalProcessingMinutes = 0

    movements.forEach(movement => {
      let baseTime = 5 // Base 5 minutes per movement

      // Add complexity based on movement type
      switch (movement.movementType) {
        case 'WAREHOUSE_TRANSFER':
          baseTime += 10 // Transfers are more complex
          break
        case 'PRINT_RECEIVED':
          baseTime += 15 // Receiving requires more validation
          break
        default:
          baseTime += 2 // Standard movements
      }

      // Add time based on quantity (more items = more time)
      if (movement.quantity > 100) baseTime += 5
      if (movement.quantity > 500) baseTime += 10

      totalProcessingMinutes += baseTime
    })

    return movements.length > 0 ? totalProcessingMinutes / movements.length : 0
  }

  private static async calculateTransferAccuracy(
    movements: any[],
    warehouseId: number,
    dateFrom: Date,
    dateTo: Date
  ): Promise<number> {
    // Find transfer movements
    const transferMovements = movements.filter(m =>
      m.movementType === 'WAREHOUSE_TRANSFER' && m.referenceNumber
    )

    if (transferMovements.length === 0) return 100 // No transfers, perfect accuracy

    let accurateTransfers = 0

    // Check each transfer for matching counterpart
    for (const transfer of transferMovements) {
      if (!transfer.referenceNumber) continue

      // Look for matching counterpart transfer
      const counterpart = await dbClient.stockMovement.findFirst({
        where: {
          referenceNumber: transfer.referenceNumber,
          titleId: transfer.titleId,
          movementDate: {
            gte: new Date(transfer.movementDate.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(transfer.movementDate.getTime() + 24 * 60 * 60 * 1000)
          },
          id: { not: transfer.id }
        }
      })

      if (counterpart && Math.abs(transfer.quantity) === Math.abs(counterpart.quantity)) {
        accurateTransfers++
      }
    }

    return (accurateTransfers / transferMovements.length) * 100
  }

  private static calculateErrorRate(movements: any[]): number {
    // Identify potential errors (simplified heuristics)
    let errorCount = 0

    movements.forEach(movement => {
      // Large quantity movements might indicate errors
      if (Math.abs(movement.quantity) > 10000) errorCount++

      // Movements without proper documentation
      if (!movement.referenceNumber && movement.movementType !== 'PRINT_RECEIVED') {
        errorCount += 0.5 // Partial error
      }

      // Check for unusual timing (movements during non-business hours)
      const hour = movement.movementDate.getHours()
      if (hour < 6 || hour > 22) errorCount += 0.3
    })

    return movements.length > 0 ? (errorCount / movements.length) * 100 : 0
  }

  private static calculateUtilizationScore(movements: any[], throughputVelocity: number): number {
    // Calculate based on movement distribution and throughput
    const dailyCapacity = 100 // Assumed daily capacity
    const utilizationRatio = throughputVelocity / dailyCapacity

    // Consider movement type distribution
    const typeDistribution = new Map<string, number>()
    movements.forEach(m => {
      typeDistribution.set(m.movementType, (typeDistribution.get(m.movementType) || 0) + 1)
    })

    // Bonus for balanced movement types
    const typeBalance = typeDistribution.size / 8 // Assuming 8 total movement types

    const baseScore = Math.min(utilizationRatio * 100, 100)
    const balanceBonus = typeBalance * 10

    return Math.min(baseScore + balanceBonus, 100)
  }

  private static calculatePerformanceBreakdown(movements: any[]): {
    inboundEfficiency: number
    outboundEfficiency: number
    transferEfficiency: number
    adjustmentFrequency: number
  } {
    const inboundMovements = movements.filter(m => m.quantity > 0)
    const outboundMovements = movements.filter(m => m.quantity < 0)
    const transferMovements = movements.filter(m => m.movementType === 'WAREHOUSE_TRANSFER')

    return {
      inboundEfficiency: inboundMovements.length > 0 ?
        Math.min((inboundMovements.length / movements.length) * 200, 100) : 0,
      outboundEfficiency: outboundMovements.length > 0 ?
        Math.min((outboundMovements.length / movements.length) * 200, 100) : 0,
      transferEfficiency: transferMovements.length > 0 ?
        Math.min((transferMovements.length / movements.length) * 300, 100) : 0,
      adjustmentFrequency: movements.length > 0 ?
        (movements.length / 30) * 10 : 0 // Adjustments per month metric
    }
  }

  private static calculateBenchmarkComparison(throughputVelocity: number, transferAccuracy: number): {
    percentile: number
    industryAverage: number
    topPerformer: number
  } {
    // Simulated benchmark data
    const industryAverage = 25 // movements per day
    const topPerformer = 50

    const throughputPercentile = Math.min((throughputVelocity / topPerformer) * 100, 100)
    const accuracyWeight = transferAccuracy / 100
    const overallPercentile = (throughputPercentile * 0.7) + (accuracyWeight * 30)

    return {
      percentile: Math.round(overallPercentile),
      industryAverage,
      topPerformer
    }
  }

  // Sub-task 4: Create movement exception and anomaly detection
  static async detectMovementAnomalies(
    dateFrom: Date,
    dateTo: Date,
    options: AnomalyDetectionOptions = {}
  ): Promise<MovementAnomalyDetection> {
    try {
      // Build query filters
      const whereClause: any = {
        movementDate: {
          gte: dateFrom,
          lte: dateTo
        }
      }

      if (options.warehouseIds && options.warehouseIds.length > 0) {
        whereClause.warehouseId = { in: options.warehouseIds }
      }

      if (options.movementTypes && options.movementTypes.length > 0) {
        whereClause.movementType = { in: options.movementTypes }
      }

      // Get movements with related data
      const movements = await dbClient.stockMovement.findMany({
        where: whereClause,
        include: {
          title: { select: { title: true, isbn: true } },
          warehouse: { select: { name: true, code: true } }
        },
        orderBy: { movementDate: 'asc' }
      })

      if (movements.length === 0) {
        return {
          anomalies: [],
          detectionPeriod: { start: dateFrom, end: dateTo },
          totalMovementsAnalyzed: 0,
          anomaliesFound: 0,
          severityBreakdown: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
          detectionStatistics: {
            meanValue: 0,
            standardDeviation: 0,
            outlierThreshold: 0,
            zScoreThreshold: options.zScoreThreshold || 2.5
          }
        }
      }

      // Calculate statistical baselines
      const quantities = movements.map(m => Math.abs(m.quantity))
      const values = movements.map(m => {
        const rrp = m.rrpAtTime ? parseFloat(m.rrpAtTime.toString()) : 0
        return rrp * Math.abs(m.quantity)
      })

      const quantityStats = this.calculateStatistics(quantities)
      const valueStats = this.calculateStatistics(values.filter(v => v > 0))

      const zScoreThreshold = options.zScoreThreshold || this.getSensitivityThreshold(options.sensitivityLevel)

      // Detect anomalies
      const anomalies: MovementAnomaly[] = []

      movements.forEach(movement => {
        const detectedAnomalies = this.detectMovementAnomaliesForSingle(
          movement,
          quantityStats,
          valueStats,
          zScoreThreshold,
          options.includePatternAnomalies || false
        )
        anomalies.push(...detectedAnomalies)
      })

      // Calculate severity breakdown
      const severityBreakdown = anomalies.reduce((acc, anomaly) => {
        acc[anomaly.severity]++
        return acc
      }, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 })

      return {
        anomalies: anomalies.sort((a, b) => b.deviationScore - a.deviationScore),
        detectionPeriod: { start: dateFrom, end: dateTo },
        totalMovementsAnalyzed: movements.length,
        anomaliesFound: anomalies.length,
        severityBreakdown,
        detectionStatistics: {
          meanValue: valueStats.mean,
          standardDeviation: valueStats.standardDeviation,
          outlierThreshold: valueStats.mean + (zScoreThreshold * valueStats.standardDeviation),
          zScoreThreshold
        }
      }
    } catch (error) {
      throw new Error(`Failed to detect movement anomalies: ${error}`)
    }
  }

  private static calculateStatistics(values: number[]): {
    mean: number
    standardDeviation: number
    variance: number
    median: number
    q1: number
    q3: number
    iqr: number
  } {
    if (values.length === 0) {
      return { mean: 0, standardDeviation: 0, variance: 0, median: 0, q1: 0, q3: 0, iqr: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    const standardDeviation = Math.sqrt(variance)

    const median = sorted[Math.floor(sorted.length / 2)]
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1

    return { mean, standardDeviation, variance, median, q1, q3, iqr }
  }

  private static getSensitivityThreshold(sensitivityLevel?: 'LOW' | 'MEDIUM' | 'HIGH'): number {
    switch (sensitivityLevel) {
      case 'LOW': return 3.0
      case 'MEDIUM': return 2.5
      case 'HIGH': return 2.0
      default: return 2.5
    }
  }

  private static detectMovementAnomaliesForSingle(
    movement: any,
    quantityStats: any,
    valueStats: any,
    zScoreThreshold: number,
    includePatternAnomalies: boolean
  ): MovementAnomaly[] {
    const anomalies: MovementAnomaly[] = []
    const quantity = Math.abs(movement.quantity)
    const value = movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * quantity : 0

    // Quantity anomaly detection
    if (quantityStats.standardDeviation > 0) {
      const quantityZScore = Math.abs(quantity - quantityStats.mean) / quantityStats.standardDeviation
      if (quantityZScore > zScoreThreshold) {
        anomalies.push(this.createAnomaly(
          movement,
          'QUANTITY',
          'Unusual quantity detected',
          quantityStats.mean,
          quantity,
          quantityZScore
        ))
      }
    }

    // Value anomaly detection
    if (value > 0 && valueStats.standardDeviation > 0) {
      const valueZScore = Math.abs(value - valueStats.mean) / valueStats.standardDeviation
      if (valueZScore > zScoreThreshold) {
        anomalies.push(this.createAnomaly(
          movement,
          'VALUE',
          'Unusual transaction value detected',
          valueStats.mean,
          value,
          valueZScore
        ))
      }
    }

    // Timing anomaly detection
    const hour = movement.movementDate.getHours()
    if (hour < 6 || hour > 22) {
      anomalies.push(this.createAnomaly(
        movement,
        'TIMING',
        'Movement occurred outside business hours',
        12, // Expected hour (noon)
        hour,
        Math.abs(hour - 12) / 6 // Normalized timing score
      ))
    }

    // Pattern anomaly detection (if enabled)
    if (includePatternAnomalies) {
      // Detect unusual patterns (simplified)
      if (movement.movementType === 'PRINT_RECEIVED' && movement.quantity < 0) {
        anomalies.push(this.createAnomaly(
          movement,
          'PATTERN',
          'Negative quantity for print receipt',
          100, // Expected positive quantity
          quantity,
          5.0 // High anomaly score for pattern violations
        ))
      }
    }

    return anomalies
  }

  private static createAnomaly(
    movement: any,
    type: 'QUANTITY' | 'TIMING' | 'FREQUENCY' | 'VALUE' | 'PATTERN',
    description: string,
    expectedValue: number,
    actualValue: number,
    zScore: number
  ): MovementAnomaly {
    // Determine severity based on z-score
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    if (zScore > 4.0) severity = 'CRITICAL'
    else if (zScore > 3.0) severity = 'HIGH'
    else if (zScore > 2.5) severity = 'MEDIUM'
    else severity = 'LOW'

    return {
      movementId: movement.id,
      anomalyType: type,
      severity,
      description,
      detectedAt: new Date(),
      expectedValue,
      actualValue,
      deviationScore: Math.abs(actualValue - expectedValue),
      zScore,
      movement: {
        movementType: movement.movementType,
        quantity: movement.quantity,
        movementDate: movement.movementDate,
        warehouse: movement.warehouse.name,
        title: movement.title.title
      }
    }
  }

  // Utility methods
  private static generateTimeBuckets(dateFrom: Date, dateTo: Date, groupBy: 'DAY' | 'WEEK' | 'MONTH'): string[] {
    const buckets: string[] = []
    const current = new Date(dateFrom)
    const end = new Date(dateTo)

    while (current <= end) {
      buckets.push(this.getTimeBucket(current, groupBy))

      // Increment based on groupBy
      switch (groupBy) {
        case 'DAY':
          current.setDate(current.getDate() + 1)
          break
        case 'WEEK':
          current.setDate(current.getDate() + 7)
          break
        case 'MONTH':
          current.setMonth(current.getMonth() + 1)
          break
      }
    }

    return buckets
  }

  private static getTimeBucket(date: Date, groupBy: 'DAY' | 'WEEK' | 'MONTH'): string {
    const d = new Date(date)

    switch (groupBy) {
      case 'DAY':
        return d.toISOString().split('T')[0]
      case 'WEEK':
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay()) // Start of week
        return weekStart.toISOString().split('T')[0]
      case 'MONTH':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      default:
        return d.toISOString().split('T')[0]
    }
  }
}

export default MovementReportingService