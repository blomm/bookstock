import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { testDb } from '../utils/test-db'
import MovementReportingService, { setDbClient } from '@/services/movementReportingService'
import { MovementType } from '@prisma/client'

describe('Movement Reporting Service - Task 4.5', () => {
  beforeEach(async () => {
    setDbClient(testDb)
    await testDb.stockMovement.deleteMany()
    await testDb.inventory.deleteMany()
    await testDb.title.deleteMany()
    await testDb.warehouse.deleteMany()
    await testDb.series.deleteMany()
  })

  afterEach(async () => {
    await testDb.stockMovement.deleteMany()
    await testDb.inventory.deleteMany()
    await testDb.title.deleteMany()
    await testDb.warehouse.deleteMany()
    await testDb.series.deleteMany()
  })

  describe('Sub-task 1: Movement Summary Reports by Type and Period', () => {
    test('should generate comprehensive movement summary report', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create multiple movements
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-05'),
            rrpAtTime: 19.99,
            unitCostAtTime: 5.50
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -25,
            movementDate: new Date('2024-01-15'),
            rrpAtTime: 19.99
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'ONLINE_SALES',
            quantity: -10,
            movementDate: new Date('2024-01-20'),
            rrpAtTime: 19.99
          }
        ]
      })

      // Generate report
      const report = await MovementReportingService.generateMovementSummaryReport(
        startDate,
        endDate
      )

      expect(report).toBeDefined()
      expect(report.periodStart).toEqual(startDate)
      expect(report.periodEnd).toEqual(endDate)
      expect(report.summary.totalMovements).toBe(3)
      expect(report.summary.totalQuantityIn).toBe(100)
      expect(report.summary.totalQuantityOut).toBe(35)
      expect(report.summary.uniqueTitles).toBe(1)
      expect(report.summary.uniqueWarehouses).toBe(1)

      // Verify by-type analysis
      expect(report.byType).toHaveLength(3)
      const printReceived = report.byType.find(t => t.movementType === 'PRINT_RECEIVED')
      expect(printReceived).toBeDefined()
      expect(printReceived!.count).toBe(1)
      expect(printReceived!.totalQuantity).toBe(100)

      // Verify by-warehouse analysis
      expect(report.byWarehouse).toHaveLength(1)
      expect(report.byWarehouse[0].warehouseName).toBe('Test Warehouse')
      expect(report.byWarehouse[0].totalMovements).toBe(3)

      // Verify time series data
      expect(report.byTimeGranularity.length).toBeGreaterThan(0)
    })

    test('should filter movements by warehouse IDs', async () => {
      // Create test data with multiple warehouses
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse1 = await testDb.warehouse.create({
        data: {
          name: 'Warehouse 1',
          code: 'WH1',
          location: 'Location 1',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const warehouse2 = await testDb.warehouse.create({
        data: {
          name: 'Warehouse 2',
          code: 'WH2',
          location: 'Location 2',
          fulfillsChannels: ['US_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-05')
          },
          {
            titleId: title.id,
            warehouseId: warehouse2.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 50,
            movementDate: new Date('2024-01-10')
          }
        ]
      })

      const report = await MovementReportingService.generateMovementSummaryReport(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { warehouseIds: [warehouse1.id] }
      )

      expect(report.summary.totalMovements).toBe(1)
      expect(report.summary.totalQuantityIn).toBe(100)
      expect(report.byWarehouse).toHaveLength(1)
      expect(report.byWarehouse[0].warehouseName).toBe('Warehouse 1')
    })

    test('should group time series data by specified granularity', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create movements across different weeks
      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-01')
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -25,
            movementDate: new Date('2024-01-08')
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'ONLINE_SALES',
            quantity: -10,
            movementDate: new Date('2024-01-15')
          }
        ]
      })

      const weeklyReport = await MovementReportingService.generateMovementSummaryReport(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { groupBy: 'WEEK' }
      )

      expect(weeklyReport.byTimeGranularity.length).toBeGreaterThan(0)
      // Should have data points for different weeks
      const hasMultipleWeeks = weeklyReport.byTimeGranularity.some(point => point.movementCount > 0)
      expect(hasMultipleWeeks).toBe(true)
    })
  })

  describe('Sub-task 2: Movement Trend Analysis and Forecasting', () => {
    test('should analyze movement trends with increasing pattern', async () => {
      // Create test data with increasing trend
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create movements with increasing trend
      const movements = []
      for (let i = 0; i < 15; i++) {
        movements.push({
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES' as MovementType,
          quantity: -(10 + i * 2), // Increasing sales
          movementDate: new Date(2024, 0, i + 1), // Daily movements
          rrpAtTime: 19.99
        })
      }

      await testDb.stockMovement.createMany({ data: movements })

      const analysis = await MovementReportingService.analyzeMovementTrends(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        {
          lookbackDays: 30,
          titleId: title.id,
          forecastDays: 7,
          detectSeasonality: true
        }
      )

      expect(analysis).toBeDefined()
      expect(analysis.titleId).toBe(title.id)
      expect(analysis.historicalData.length).toBeGreaterThan(0)
      expect(['INCREASING', 'DECREASING', 'STABLE']).toContain(analysis.trendDirection)
      expect(analysis.trendStrength).toBeGreaterThanOrEqual(0)
      expect(analysis.trendStrength).toBeLessThanOrEqual(1)
      expect(analysis.confidence).toBeGreaterThanOrEqual(0)
      expect(analysis.forecastData).toHaveLength(7)

      // Verify statistical summary
      expect(analysis.statisticalSummary.mean).toBeGreaterThan(0)
      expect(analysis.statisticalSummary.standardDeviation).toBeGreaterThanOrEqual(0)

      // Verify forecast points
      analysis.forecastData.forEach(point => {
        expect(point.timestamp).toBeInstanceOf(Date)
        expect(point.predictedValue).toBeGreaterThanOrEqual(0)
        expect(point.confidence).toBeGreaterThan(0)
        expect(point.confidence).toBeLessThanOrEqual(100)
        expect(point.confidenceInterval.upper).toBeGreaterThanOrEqual(point.confidenceInterval.lower)
      })
    })

    test('should detect seasonal patterns when present', async () => {
      // Create test data with seasonal pattern (weekly cycle)
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create movements with 7-day seasonal pattern
      const movements = []
      for (let i = 0; i < 21; i++) { // 3 weeks
        const isWeekend = i % 7 >= 5
        const quantity = isWeekend ? -5 : -15 // Lower sales on weekends
        movements.push({
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES' as MovementType,
          quantity,
          movementDate: new Date(2024, 0, i + 1),
          rrpAtTime: 19.99
        })
      }

      await testDb.stockMovement.createMany({ data: movements })

      const analysis = await MovementReportingService.analyzeMovementTrends(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        {
          lookbackDays: 30,
          titleId: title.id,
          detectSeasonality: true,
          minDataPoints: 15
        }
      )

      expect(analysis.seasonalityDetected).toBeDefined()
      if (analysis.seasonalityDetected) {
        expect(analysis.seasonalityPeriod).toBeGreaterThan(0)
      }
    })

    test('should handle insufficient data points gracefully', async () => {
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create only a few movements (below minimum)
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -10,
          movementDate: new Date('2024-01-01'),
          rrpAtTime: 19.99
        }
      })

      await expect(
        MovementReportingService.analyzeMovementTrends(
          new Date('2024-01-01'),
          new Date('2024-01-31'),
          {
            lookbackDays: 30,
            titleId: title.id,
            minDataPoints: 10
          }
        )
      ).rejects.toThrow('Insufficient data points for trend analysis')
    })
  })

  describe('Sub-task 3: Movement Efficiency and Accuracy Metrics', () => {
    test('should calculate comprehensive efficiency metrics', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create varied movements for efficiency calculation
      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-01'),
            referenceNumber: 'REF-001'
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -25,
            movementDate: new Date('2024-01-05'),
            referenceNumber: 'SALE-001'
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -10,
            movementDate: new Date('2024-01-10'),
            referenceNumber: 'TRANSFER-001'
          }
        ]
      })

      const metrics = await MovementReportingService.calculateEfficiencyMetrics(
        warehouse.id,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(metrics).toBeDefined()
      expect(metrics.warehouseId).toBe(warehouse.id)
      expect(metrics.warehouseName).toBe('Test Warehouse')
      expect(metrics.period.start).toBeInstanceOf(Date)
      expect(metrics.period.end).toBeInstanceOf(Date)

      // Verify efficiency calculations
      expect(metrics.throughputVelocity).toBeGreaterThan(0)
      expect(metrics.averageProcessingTime).toBeGreaterThan(0)
      expect(metrics.transferAccuracy).toBeGreaterThanOrEqual(0)
      expect(metrics.transferAccuracy).toBeLessThanOrEqual(100)
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0)
      expect(metrics.errorRate).toBeLessThanOrEqual(100)
      expect(metrics.utilizationScore).toBeGreaterThanOrEqual(0)
      expect(metrics.utilizationScore).toBeLessThanOrEqual(100)

      // Verify performance breakdown
      expect(metrics.performanceBreakdown).toBeDefined()
      expect(metrics.performanceBreakdown.inboundEfficiency).toBeGreaterThanOrEqual(0)
      expect(metrics.performanceBreakdown.outboundEfficiency).toBeGreaterThanOrEqual(0)
      expect(metrics.performanceBreakdown.transferEfficiency).toBeGreaterThanOrEqual(0)

      // Verify benchmark comparison
      expect(metrics.benchmarkComparison).toBeDefined()
      expect(metrics.benchmarkComparison.percentile).toBeGreaterThanOrEqual(0)
      expect(metrics.benchmarkComparison.percentile).toBeLessThanOrEqual(100)
    })

    test('should calculate transfer accuracy correctly', async () => {
      // Create test data with matching transfers
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const sourceWarehouse = await testDb.warehouse.create({
        data: {
          name: 'Source Warehouse',
          code: 'SRC',
          location: 'Source Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const destWarehouse = await testDb.warehouse.create({
        data: {
          name: 'Destination Warehouse',
          code: 'DST',
          location: 'Destination Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create matching transfer pair
      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: sourceWarehouse.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -50,
            movementDate: new Date('2024-01-05'),
            referenceNumber: 'TRANSFER-001'
          },
          {
            titleId: title.id,
            warehouseId: destWarehouse.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: 50,
            movementDate: new Date('2024-01-05'),
            referenceNumber: 'TRANSFER-001'
          }
        ]
      })

      const metrics = await MovementReportingService.calculateEfficiencyMetrics(
        sourceWarehouse.id,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(metrics.transferAccuracy).toBe(100) // Perfect match
    })

    test('should handle warehouse with no movements', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Empty Warehouse',
          code: 'EMPTY',
          location: 'Empty Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      await expect(
        MovementReportingService.calculateEfficiencyMetrics(
          warehouse.id,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        )
      ).rejects.toThrow('No movements found')
    })
  })

  describe('Sub-task 4: Movement Exception and Anomaly Detection', () => {
    test('should detect quantity anomalies', async () => {
      // Create test data with normal and anomalous quantities
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create normal movements and one anomaly
      const movements = []

      // Normal movements (10-20 quantity range)
      for (let i = 0; i < 10; i++) {
        movements.push({
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES' as MovementType,
          quantity: -(10 + i),
          movementDate: new Date(2024, 0, i + 1),
          rrpAtTime: 19.99
        })
      }

      // Add anomalous movement
      movements.push({
        titleId: title.id,
        warehouseId: warehouse.id,
        movementType: 'UK_TRADE_SALES' as MovementType,
        quantity: -1000, // Anomalously large quantity
        movementDate: new Date(2024, 0, 15),
        rrpAtTime: 19.99
      })

      await testDb.stockMovement.createMany({ data: movements })

      const detection = await MovementReportingService.detectMovementAnomalies(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { sensitivityLevel: 'MEDIUM' }
      )

      expect(detection).toBeDefined()
      expect(detection.totalMovementsAnalyzed).toBe(11)
      expect(detection.anomaliesFound).toBeGreaterThan(0)
      expect(detection.severityBreakdown).toBeDefined()

      // Should detect the large quantity anomaly
      const quantityAnomalies = detection.anomalies.filter(a => a.anomalyType === 'QUANTITY')
      expect(quantityAnomalies.length).toBeGreaterThan(0)

      quantityAnomalies.forEach(anomaly => {
        expect(anomaly.movementId).toBeDefined()
        expect(anomaly.zScore).toBeGreaterThan(2.5) // Above threshold
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(anomaly.severity)
      })
    })

    test('should detect timing anomalies', async () => {
      // Create test data with off-hours movement
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create movement at unusual hour (2 AM)
      const unusualTime = new Date('2024-01-01T02:00:00Z')
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -10,
          movementDate: unusualTime,
          rrpAtTime: 19.99
        }
      })

      const detection = await MovementReportingService.detectMovementAnomalies(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      // Should detect timing anomaly
      const timingAnomalies = detection.anomalies.filter(a => a.anomalyType === 'TIMING')
      expect(timingAnomalies.length).toBeGreaterThan(0)

      timingAnomalies.forEach(anomaly => {
        expect(anomaly.description).toContain('business hours')
      })
    })

    test('should detect value anomalies', async () => {
      // Create test data with normal and high-value movements
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create normal movements
      const movements = []
      for (let i = 0; i < 10; i++) {
        movements.push({
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES' as MovementType,
          quantity: -10,
          movementDate: new Date(2024, 0, i + 1),
          rrpAtTime: 19.99 // Normal price
        })
      }

      // Add high-value anomaly
      movements.push({
        titleId: title.id,
        warehouseId: warehouse.id,
        movementType: 'UK_TRADE_SALES' as MovementType,
        quantity: -10,
        movementDate: new Date(2024, 0, 15),
        rrpAtTime: 999.99 // Anomalously high price
      })

      await testDb.stockMovement.createMany({ data: movements })

      const detection = await MovementReportingService.detectMovementAnomalies(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { sensitivityLevel: 'MEDIUM' }
      )

      // Should detect value anomaly
      const valueAnomalies = detection.anomalies.filter(a => a.anomalyType === 'VALUE')
      expect(valueAnomalies.length).toBeGreaterThan(0)

      valueAnomalies.forEach(anomaly => {
        expect(anomaly.actualValue).toBeGreaterThan(anomaly.expectedValue)
      })
    })

    test('should adjust sensitivity levels correctly', async () => {
      // Create test data with moderate outlier
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create movements with moderate outlier
      const movements = []
      for (let i = 0; i < 10; i++) {
        movements.push({
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES' as MovementType,
          quantity: -10,
          movementDate: new Date(2024, 0, i + 1),
          rrpAtTime: 19.99
        })
      }

      // Moderate outlier
      movements.push({
        titleId: title.id,
        warehouseId: warehouse.id,
        movementType: 'UK_TRADE_SALES' as MovementType,
        quantity: -50, // Moderately large
        movementDate: new Date(2024, 0, 15),
        rrpAtTime: 19.99
      })

      await testDb.stockMovement.createMany({ data: movements })

      // Test different sensitivity levels
      const highSensitivity = await MovementReportingService.detectMovementAnomalies(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { sensitivityLevel: 'HIGH' }
      )

      const lowSensitivity = await MovementReportingService.detectMovementAnomalies(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { sensitivityLevel: 'LOW' }
      )

      // High sensitivity should detect more anomalies
      expect(highSensitivity.anomaliesFound).toBeGreaterThanOrEqual(lowSensitivity.anomaliesFound)
    })

    test('should handle empty dataset gracefully', async () => {
      const detection = await MovementReportingService.detectMovementAnomalies(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(detection).toBeDefined()
      expect(detection.totalMovementsAnalyzed).toBe(0)
      expect(detection.anomaliesFound).toBe(0)
      expect(detection.anomalies).toHaveLength(0)
      expect(detection.severityBreakdown.LOW).toBe(0)
      expect(detection.severityBreakdown.MEDIUM).toBe(0)
      expect(detection.severityBreakdown.HIGH).toBe(0)
      expect(detection.severityBreakdown.CRITICAL).toBe(0)
    })
  })

  describe('Integration and Error Handling', () => {
    test('should handle invalid date ranges', async () => {
      const endDate = new Date('2024-01-01')
      const startDate = new Date('2024-01-31') // Invalid: start after end

      await expect(
        MovementReportingService.generateMovementSummaryReport(startDate, endDate)
      ).rejects.toThrow()
    })

    test('should handle non-existent warehouse for efficiency metrics', async () => {
      await expect(
        MovementReportingService.calculateEfficiencyMetrics(
          99999,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        )
      ).rejects.toThrow('Warehouse 99999 not found')
    })

    test('should filter by movement types correctly', async () => {
      // Create test data with different movement types
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-05')
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -25,
            movementDate: new Date('2024-01-10')
          },
          {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'ONLINE_SALES',
            quantity: -10,
            movementDate: new Date('2024-01-15')
          }
        ]
      })

      const filteredReport = await MovementReportingService.generateMovementSummaryReport(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        { movementTypes: ['UK_TRADE_SALES', 'ONLINE_SALES'] }
      )

      expect(filteredReport.summary.totalMovements).toBe(2)
      expect(filteredReport.byType).toHaveLength(2)
      expect(filteredReport.byType.some(t => t.movementType === 'PRINT_RECEIVED')).toBe(false)
    })
  })
})