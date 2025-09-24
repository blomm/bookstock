import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestPrinter } from '../utils/test-db'
import MonthlyImportService, { setDbClient, MonthlyImportData, ImportOptions, ImportMetadata } from '@/services/monthlyImportService'
import { setDbClient as setStockMovementDbClient } from '@/services/stockMovementService'

describe('Monthly Import Service', () => {
  let warehouse1: any
  let warehouse2: any
  let title1: any
  let title2: any
  let printer: any

  beforeEach(async () => {
    await cleanDatabase()
    setDbClient(testDb)
    setStockMovementDbClient(testDb)

    // Create test data
    warehouse1 = await createTestWarehouse({
      name: 'Main Warehouse',
      code: 'MAIN001',
      location: 'London, UK',
      fulfillsChannels: ['wholesale', 'online']
    })

    warehouse2 = await createTestWarehouse({
      name: 'Secondary Warehouse',
      code: 'SEC001',
      location: 'Manchester, UK',
      fulfillsChannels: ['retail']
    })

    title1 = await createTestTitle({
      isbn: '9781234567890',
      title: 'Import Test Book 1',
      author: 'Test Author 1',
      rrp: 19.99,
      unitCost: 8.50
    })

    title2 = await createTestTitle({
      isbn: '9781234567891',
      title: 'Import Test Book 2',
      author: 'Test Author 2',
      rrp: 24.99,
      unitCost: 12.50
    })

    printer = await createTestPrinter({
      name: 'Lightning Source UK',
      location: 'Milton Keynes, UK'
    })

    // Create initial inventory
    await testDb.inventory.createMany({
      data: [
        {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 1000,
          reservedStock: 0
        },
        {
          titleId: title2.id,
          warehouseId: warehouse1.id,
          currentStock: 500,
          reservedStock: 0
        }
      ]
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Automated Monthly Import Processing', () => {
    test('should process valid CSV data successfully', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber,rrp,unitCost
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,MONTHLY-001,19.99,8.50
9781234567891,MAIN001,ONLINE_SALES,-50,2024-01-16,MONTHLY-002,24.99,12.50
9781234567890,MAIN001,PRINT_RECEIVED,2000,2024-01-10,PRINT-001,19.99,8.50`

      const metadata: ImportMetadata = {
        fileName: 'monthly_import_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        warehouse: 'MAIN001',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const options: ImportOptions = {
        validateFirst: true,
        continueOnError: false,
        batchSize: 10,
        dryRun: false
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata, options)

      expect(job.status).toBe('completed')
      expect(job.summary.totalRecords).toBe(3)
      expect(job.summary.successfulMovements).toBe(3)
      expect(job.summary.failedMovements).toBe(0)
      expect(job.errors).toHaveLength(0)

      // Verify movements were created
      const movements = await testDb.stockMovement.findMany({
        where: {
          referenceNumber: {
            in: ['MONTHLY-001', 'MONTHLY-002', 'PRINT-001']
          }
        }
      })
      expect(movements).toHaveLength(3)

      // Verify inventory was updated
      const inventory1 = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventory1!.currentStock).toBe(2900) // 1000 - 100 + 2000

      const inventory2 = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title2.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventory2!.currentStock).toBe(450) // 500 - 50
    })

    test('should handle dry run mode without creating movements', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,DRYRUN-001`

      const metadata: ImportMetadata = {
        fileName: 'dry_run_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const options: ImportOptions = {
        dryRun: true
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata, options)

      expect(job.status).toBe('completed')
      expect(job.summary.totalRecords).toBe(1)
      expect(job.processedMovements).toHaveLength(0)

      // Verify no movements were created
      const movements = await testDb.stockMovement.findMany({
        where: { referenceNumber: 'DRYRUN-001' }
      })
      expect(movements).toHaveLength(0)

      // Verify inventory was not changed
      const inventory = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventory!.currentStock).toBe(1000) // Unchanged
    })

    test('should handle batch processing with configurable batch size', async () => {
      // Create CSV with multiple records
      const csvRows = []
      csvRows.push('isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber')

      for (let i = 1; i <= 25; i++) {
        const isbn = i % 2 === 0 ? title1.isbn : title2.isbn
        csvRows.push(`${isbn},MAIN001,UK_TRADE_SALES,-${i},2024-01-${String(i).padStart(2, '0')},BATCH-${String(i).padStart(3, '0')}`)
      }

      const csvData = csvRows.join('\n')

      const metadata: ImportMetadata = {
        fileName: 'batch_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const options: ImportOptions = {
        batchSize: 10, // Process in smaller batches
        continueOnError: true
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata, options)

      expect(job.summary.totalRecords).toBe(25)
      expect(job.summary.successfulMovements).toBeGreaterThan(0)
      expect(job.status).toBe('completed')
    })
  })

  describe('Data Validation and Reconciliation', () => {
    test('should validate CSV data and identify errors', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
,MAIN001,UK_TRADE_SALES,-100,2024-01-15,INVALID-001
9781234567890,,UK_TRADE_SALES,-100,2024-01-15,INVALID-002
9781234567890,MAIN001,,-100,2024-01-15,INVALID-003
9781234567890,MAIN001,UK_TRADE_SALES,,2024-01-15,INVALID-004
9781234567890,MAIN001,UK_TRADE_SALES,-100,,INVALID-005
9999999999999,MAIN001,UK_TRADE_SALES,-100,2024-01-15,INVALID-006
9781234567890,INVALID,UK_TRADE_SALES,-100,2024-01-15,INVALID-007
9781234567890,MAIN001,INVALID_TYPE,-100,2024-01-15,INVALID-008`

      const validation = await MonthlyImportService.validateCSV(csvData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)

      // Check for specific validation errors
      const errorMessages = validation.errors.map(e => e.error)
      expect(errorMessages).toContain('ISBN is required')
      expect(errorMessages).toContain('Warehouse code is required')
      expect(errorMessages).toContain('Movement type is required')
      expect(errorMessages).toContain('Quantity is required')
      expect(errorMessages).toContain('Movement date is required')
      expect(errorMessages.some(msg => msg.includes('Title not found'))).toBe(true)
      expect(errorMessages.some(msg => msg.includes('Warehouse not found'))).toBe(true)
      expect(errorMessages.some(msg => msg.includes('Invalid movement type'))).toBe(true)
    })

    test('should detect duplicate records', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,DUP-001
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,DUP-002`

      const validation = await MonthlyImportService.validateCSV(csvData)

      expect(validation.warnings.some(w => w.error.includes('duplicate'))).toBe(true)
    })

    test('should validate business rules', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber,rrp,unitCost
9781234567890,MAIN001,UK_TRADE_SALES,0,2024-01-15,ZERO-001,19.99,8.50
9781234567890,MAIN001,UK_TRADE_SALES,-999999,2024-01-15,LARGE-001,19.99,8.50
9781234567890,MAIN001,UK_TRADE_SALES,-100,2025-12-31,FUTURE-001,19.99,8.50
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,NEGATIVE-001,-19.99,-8.50`

      const validation = await MonthlyImportService.validateCSV(csvData)

      const warningMessages = validation.warnings.map(w => w.error)
      const errorMessages = validation.errors.map(e => e.error)

      expect(warningMessages).toContain('Zero quantity movement')
      expect(warningMessages).toContain('Unusually large quantity')
      expect(errorMessages).toContain('Future movement dates not allowed')
      expect(errorMessages).toContain('RRP cannot be negative')
      expect(errorMessages).toContain('Unit cost cannot be negative')
    })

    test('should handle validation errors gracefully with continueOnError', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,VALID-001
9999999999999,MAIN001,UK_TRADE_SALES,-100,2024-01-15,INVALID-001
9781234567891,MAIN001,ONLINE_SALES,-50,2024-01-16,VALID-002`

      const metadata: ImportMetadata = {
        fileName: 'error_handling_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const options: ImportOptions = {
        continueOnError: true
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata, options)

      expect(job.summary.totalRecords).toBe(3)
      expect(job.summary.successfulMovements).toBe(2) // Only valid records processed
      expect(job.summary.failedMovements).toBe(0) // Invalid records are not counted as failed movements, they're validation errors
      expect(job.errors.length).toBeGreaterThan(0)
      expect(job.status).toBe('completed') // Completed with errors, not failed
    })
  })

  describe('Import Statistics and Reporting', () => {
    test('should calculate comprehensive import statistics', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber,rrp,unitCost
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,STATS-001,19.99,8.50
9781234567891,MAIN001,ONLINE_SALES,-50,2024-01-16,STATS-002,24.99,12.50
9781234567890,MAIN001,PRINT_RECEIVED,1000,2024-01-10,STATS-003,19.99,8.50
9781234567891,MAIN001,US_TRADE_SALES,-25,2024-01-17,STATS-004,24.99,12.50`

      const metadata: ImportMetadata = {
        fileName: 'stats_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata)

      expect(job.summary.totalRecords).toBe(4)
      expect(job.summary.successfulMovements).toBe(4)
      expect(job.summary.totalQuantity).toBe(1175) // 100 + 50 + 1000 + 25

      // Check movement type breakdown
      expect(job.summary.movementsByType['UK_TRADE_SALES']).toBe(1)
      expect(job.summary.movementsByType['ONLINE_SALES']).toBe(1)
      expect(job.summary.movementsByType['PRINT_RECEIVED']).toBe(1)
      expect(job.summary.movementsByType['US_TRADE_SALES']).toBe(1)

      // Check warehouse summary
      const warehouseSummary = job.summary.warehouseSummary[warehouse1.id.toString()]
      expect(warehouseSummary).toBeDefined()
      expect(warehouseSummary.inbound).toBe(1000) // PRINT_RECEIVED
      expect(warehouseSummary.outbound).toBe(175) // All sales combined
    })

    test('should track import progress and timing', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,TIMING-001`

      const metadata: ImportMetadata = {
        fileName: 'timing_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const startTime = Date.now()
      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata)
      const endTime = Date.now()

      expect(job.summary.startTime).toBeInstanceOf(Date)
      expect(job.summary.endTime).toBeInstanceOf(Date)
      expect(job.summary.duration).toBeGreaterThan(0)
      expect(job.summary.duration).toBeLessThan(endTime - startTime + 1000) // Allow some tolerance
      expect(job.progress).toBe(100)
    })
  })

  describe('Job Management and Status Tracking', () => {
    test('should track job status throughout import process', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,JOB-001`

      const metadata: ImportMetadata = {
        fileName: 'job_tracking_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata)

      // Check job properties
      expect(job.id).toBeDefined()
      expect(job.id).toContain('import_')
      expect(job.status).toBe('completed')
      expect(job.metadata).toEqual(metadata)
      expect(job.createdAt).toBeInstanceOf(Date)
      expect(job.updatedAt).toBeInstanceOf(Date)

      // Check that job can be retrieved
      const retrievedJob = await MonthlyImportService.getJobStatus(job.id)
      expect(retrievedJob).toBeDefined()
      expect(retrievedJob!.id).toBe(job.id)
    })

    test('should maintain job history', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,HISTORY-001`

      const metadata: ImportMetadata = {
        fileName: 'history_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      await MonthlyImportService.processMonthlyImport(csvData, metadata)

      const history = await MonthlyImportService.getJobHistory(10)
      expect(history.length).toBeGreaterThan(0)

      const latestJob = history[history.length - 1]
      expect(latestJob.metadata.fileName).toBe('history_test.csv')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed CSV data', async () => {
      const malformedCSV = `isbn,warehouseCode,movementType,quantity,movementDate
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15
"unclosed quote,MAIN001,UK_TRADE_SALES,-50,2024-01-16`

      const metadata: ImportMetadata = {
        fileName: 'malformed_test.csv',
        fileSize: malformedCSV.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const job = await MonthlyImportService.processMonthlyImport(malformedCSV, metadata)

      expect(job.status).toBe('failed')
      expect(job.errors.length).toBeGreaterThan(0)
      expect(job.errors.some(e => e.error.includes('CSV parsing failed'))).toBe(true)
    })

    test('should handle empty CSV data', async () => {
      const emptyCSV = 'isbn,warehouseCode,movementType,quantity,movementDate'

      const metadata: ImportMetadata = {
        fileName: 'empty_test.csv',
        fileSize: emptyCSV.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const job = await MonthlyImportService.processMonthlyImport(emptyCSV, metadata)

      expect(job.status).toBe('completed')
      expect(job.summary.totalRecords).toBe(0)
      expect(job.summary.successfulMovements).toBe(0)
    })

    test('should handle very large quantities', async () => {
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,PRINT_RECEIVED,1000000,2024-01-15,LARGE-001`

      const metadata: ImportMetadata = {
        fileName: 'large_quantity_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata)

      expect(job.warnings.some(w => w.error.includes('Unusually large quantity'))).toBe(true)
      expect(job.summary.successfulMovements).toBe(1) // Should still process
    })

    test('should handle insufficient stock for outbound movements', async () => {
      // Create small inventory
      await testDb.inventory.update({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        },
        data: { currentStock: 10 }
      })

      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9781234567890,MAIN001,UK_TRADE_SALES,-100,2024-01-15,INSUFFICIENT-001`

      const metadata: ImportMetadata = {
        fileName: 'insufficient_stock_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const job = await MonthlyImportService.processMonthlyImport(csvData, metadata)

      expect(job.summary.failedMovements).toBe(1)
      expect(job.errors.some(e => e.error.includes('Insufficient stock'))).toBe(true)
    })
  })

  describe('Import Scheduling and Retry', () => {
    test('should create import schedule', async () => {
      const schedule = await MonthlyImportService.scheduleImport({
        name: 'Monthly Warehouse Import',
        warehouseCode: 'MAIN001',
        cronExpression: '0 0 1 * *', // First day of each month
        isActive: true,
        nextRun: new Date('2024-02-01'),
        importOptions: {
          validateFirst: true,
          continueOnError: false,
          batchSize: 100
        }
      })

      expect(schedule.id).toBeDefined()
      expect(schedule.name).toBe('Monthly Warehouse Import')
      expect(schedule.warehouseCode).toBe('MAIN001')
      expect(schedule.isActive).toBe(true)
      expect(schedule.createdAt).toBeInstanceOf(Date)
    })

    test('should handle retry mechanism', async () => {
      // Create a failed job first
      const csvData = `isbn,warehouseCode,movementType,quantity,movementDate,referenceNumber
9999999999999,MAIN001,UK_TRADE_SALES,-100,2024-01-15,RETRY-001`

      const metadata: ImportMetadata = {
        fileName: 'retry_test.csv',
        fileSize: csvData.length,
        uploadedBy: 'test-user',
        period: { year: 2024, month: 1 },
        source: 'manual',
        format: 'csv'
      }

      const failedJob = await MonthlyImportService.processMonthlyImport(csvData, metadata)
      expect(failedJob.status).toBe('failed')

      // Wait a moment for job to be added to history
      await new Promise(resolve => setTimeout(resolve, 10))

      // Attempt retry
      const retryJob = await MonthlyImportService.retryImport(failedJob.id, {
        continueOnError: true
      })

      expect(retryJob).toBeDefined()
      expect(retryJob!.id).not.toBe(failedJob.id) // New job ID
      expect(retryJob!.options.continueOnError).toBe(true)
    })
  })
})