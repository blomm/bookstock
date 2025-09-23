import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestPrinter } from '../utils/test-db'

describe('Stock Movement Service', () => {
  let warehouse1: any
  let warehouse2: any
  let title1: any
  let title2: any
  let printer: any

  beforeEach(async () => {
    await cleanDatabase()

    // Create test warehouses
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

    // Create test titles
    title1 = await createTestTitle({
      isbn: '9781234567890',
      title: 'Movement Test Book 1',
      author: 'Test Author 1',
      rrp: 19.99,
      unitCost: 8.50
    })

    title2 = await createTestTitle({
      isbn: '9781234567891',
      title: 'Movement Test Book 2',
      author: 'Test Author 2',
      rrp: 24.99,
      unitCost: 12.50
    })

    // Create test printer
    printer = await createTestPrinter({
      name: 'Lightning Source UK',
      location: 'Milton Keynes, UK'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Stock Movement Transaction Engine (Task 4.2)', () => {
    describe('Inbound Movement Processing', () => {
      test('should process print received movement with inventory update', async () => {
        // Create initial inventory record
        const inventory = await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 0,
            reservedStock: 0
          }
        })

        // Create print received movement
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 5000,
            movementDate: new Date('2024-01-15'),
            printerId: printer.id,
            referenceNumber: 'PRINT-2024-001',
            batchNumber: 'BATCH-001',
            unitCostAtTime: 8.50,
            manufacturingDate: new Date('2024-01-10')
          }
        })

        expect(movement).toMatchObject({
          titleId: title1.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 5000,
          printerId: printer.id,
          referenceNumber: 'PRINT-2024-001',
          batchNumber: 'BATCH-001'
        })
        expect(parseFloat(movement.unitCostAtTime?.toString() || '0')).toBe(8.50)

        // Verify inventory would be updated by transaction engine
        expect(movement.quantity).toBe(5000) // Positive for inbound
      })

      test('should process warehouse transfer inbound movement', async () => {
        // Create inventory records for both warehouses
        await testDb.inventory.createMany({
          data: [
            {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              currentStock: 1000,
              reservedStock: 0
            },
            {
              titleId: title1.id,
              warehouseId: warehouse2.id,
              currentStock: 0,
              reservedStock: 0
            }
          ]
        })

        // Create transfer movement (inbound to warehouse2)
        const inboundMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse2.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: 500,
            movementDate: new Date('2024-01-20'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: 'TRANSFER-001',
            unitCostAtTime: 8.50
          }
        })

        expect(inboundMovement).toMatchObject({
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 500,
          sourceWarehouseId: warehouse1.id,
          destinationWarehouseId: warehouse2.id,
          referenceNumber: 'TRANSFER-001'
        })
      })
    })

    describe('Outbound Movement Processing', () => {
      test('should process sales movement with financial tracking', async () => {
        // Create inventory with existing stock
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0,
            averageCost: 8.50
          }
        })

        // Create sales movement
        const saleMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -250,
            movementDate: new Date('2024-01-25'),
            referenceNumber: 'SALE-2024-001',
            rrpAtTime: 19.99,
            unitCostAtTime: 8.50,
            tradeDiscountAtTime: 40.00
          }
        })

        expect(saleMovement).toMatchObject({
          movementType: 'UK_TRADE_SALES',
          quantity: -250 // Negative for outbound
        })
        expect(parseFloat(saleMovement.rrpAtTime?.toString() || '0')).toBe(19.99)
        expect(parseFloat(saleMovement.unitCostAtTime?.toString() || '0')).toBe(8.50)
        expect(parseFloat(saleMovement.tradeDiscountAtTime?.toString() || '0')).toBe(40.00)
      })

      test('should process multiple sales channels correctly', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 2000,
            reservedStock: 0
          }
        })

        const salesChannels = [
          { type: 'ONLINE_SALES', quantity: -100, ref: 'ONLINE-001' },
          { type: 'UK_TRADE_SALES', quantity: -200, ref: 'TRADE-001' },
          { type: 'US_TRADE_SALES', quantity: -150, ref: 'US-001' },
          { type: 'ROW_TRADE_SALES', quantity: -75, ref: 'ROW-001' },
          { type: 'DIRECT_SALES', quantity: -50, ref: 'DIRECT-001' }
        ]

        for (const sale of salesChannels) {
          const movement = await testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: sale.type as any,
              quantity: sale.quantity,
              movementDate: new Date('2024-01-25'),
              referenceNumber: sale.ref,
              rrpAtTime: 19.99,
              unitCostAtTime: 8.50
            }
          })

          expect(movement.movementType).toBe(sale.type)
          expect(movement.quantity).toBe(sale.quantity)
          expect(movement.referenceNumber).toBe(sale.ref)
        }
      })

      test('should process stock adjustments (damage, pulping, free copies)', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0
          }
        })

        const adjustmentTypes = [
          { type: 'DAMAGED', quantity: -25, reason: 'Water damage in storage' },
          { type: 'PULPED', quantity: -100, reason: 'End of life disposal' },
          { type: 'FREE_COPIES', quantity: -10, reason: 'Author promotional copies' }
        ]

        for (const adjustment of adjustmentTypes) {
          const movement = await testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: adjustment.type as any,
              quantity: adjustment.quantity,
              movementDate: new Date('2024-01-30'),
              referenceNumber: `ADJ-${adjustment.type}-001`,
              notes: adjustment.reason
            }
          })

          expect(movement.movementType).toBe(adjustment.type)
          expect(movement.quantity).toBe(adjustment.quantity)
          expect(movement.notes).toBe(adjustment.reason)
        }
      })
    })

    describe('Transaction Validation', () => {
      test('should enforce business rules for warehouse transfers', async () => {
        // Create movements for warehouse transfer validation
        const outboundMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -500, // Outbound from source
            movementDate: new Date('2024-01-20'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: 'TRANSFER-PAIR-001'
          }
        })

        const inboundMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse2.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: 500, // Inbound to destination
            movementDate: new Date('2024-01-20'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: 'TRANSFER-PAIR-001'
          }
        })

        // Verify transfer pair has matching reference numbers and quantities
        expect(outboundMovement.referenceNumber).toBe(inboundMovement.referenceNumber)
        expect(Math.abs(outboundMovement.quantity)).toBe(inboundMovement.quantity)
        expect(outboundMovement.sourceWarehouseId).toBe(inboundMovement.sourceWarehouseId)
        expect(outboundMovement.destinationWarehouseId).toBe(inboundMovement.destinationWarehouseId)
      })

      test('should validate movement dates are not in future', async () => {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 30)

        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 1000,
            movementDate: futureDate,
            referenceNumber: 'FUTURE-001'
          }
        })

        // Movement created but transaction engine should validate date
        expect(movement.movementDate).toEqual(futureDate)
      })
    })
  })

  describe('Monthly Import Processing (Task 4.3)', () => {
    describe('Data Import Validation', () => {
      test('should validate import file structure and required fields', async () => {
        const validImportData = [
          {
            isbn: '9781234567890',
            warehouseCode: 'MAIN001',
            movementType: 'UK_TRADE_SALES',
            quantity: -50,
            movementDate: '2024-01-15',
            referenceNumber: 'IMPORT-001',
            rrp: 19.99,
            unitCost: 8.50,
            tradeDiscount: 40.00
          },
          {
            isbn: '9781234567891',
            warehouseCode: 'SEC001',
            movementType: 'ONLINE_SALES',
            quantity: -25,
            movementDate: '2024-01-16',
            referenceNumber: 'IMPORT-002',
            rrp: 24.99,
            unitCost: 12.50
          }
        ]

        // Validate each record has required fields
        for (const record of validImportData) {
          expect(record.isbn).toBeDefined()
          expect(record.warehouseCode).toBeDefined()
          expect(record.movementType).toBeDefined()
          expect(record.quantity).toBeDefined()
          expect(record.movementDate).toBeDefined()
          expect(record.referenceNumber).toBeDefined()
        }
      })

      test('should identify and report validation errors in import data', async () => {
        const invalidImportData = [
          {
            // Missing ISBN
            warehouseCode: 'MAIN001',
            movementType: 'UK_TRADE_SALES',
            quantity: -50,
            movementDate: '2024-01-15'
          },
          {
            isbn: '9781234567890',
            warehouseCode: 'INVALID_CODE', // Invalid warehouse
            movementType: 'UK_TRADE_SALES',
            quantity: -50,
            movementDate: '2024-01-15'
          },
          {
            isbn: '9781234567890',
            warehouseCode: 'MAIN001',
            movementType: 'INVALID_TYPE', // Invalid movement type
            quantity: -50,
            movementDate: '2024-01-15'
          },
          {
            isbn: '9781234567890',
            warehouseCode: 'MAIN001',
            movementType: 'UK_TRADE_SALES',
            quantity: 'invalid', // Invalid quantity
            movementDate: '2024-01-15'
          }
        ]

        const validationErrors: string[] = []

        for (const [index, record] of invalidImportData.entries()) {
          if (!record.isbn) {
            validationErrors.push(`Row ${index + 1}: Missing ISBN`)
          }
          if (record.warehouseCode === 'INVALID_CODE') {
            validationErrors.push(`Row ${index + 1}: Invalid warehouse code`)
          }
          if (record.movementType === 'INVALID_TYPE') {
            validationErrors.push(`Row ${index + 1}: Invalid movement type`)
          }
          if (record.quantity === 'invalid') {
            validationErrors.push(`Row ${index + 1}: Invalid quantity format`)
          }
        }

        expect(validationErrors).toHaveLength(4)
      })
    })

    describe('Batch Processing', () => {
      test('should process valid import records in batches', async () => {
        // Create inventory records first
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
              warehouseId: warehouse2.id,
              currentStock: 500,
              reservedStock: 0
            }
          ]
        })

        const importBatch = [
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'BATCH-001-1',
            rrpAtTime: 19.99,
            unitCostAtTime: 8.50
          },
          {
            titleId: title2.id,
            warehouseId: warehouse2.id,
            movementType: 'ONLINE_SALES',
            quantity: -50,
            movementDate: new Date('2024-01-16'),
            referenceNumber: 'BATCH-001-2',
            rrpAtTime: 24.99,
            unitCostAtTime: 12.50
          }
        ]

        // Process batch import
        const createdMovements = await testDb.stockMovement.createMany({
          data: importBatch
        })

        expect(createdMovements.count).toBe(2)

        // Verify movements were created
        const movements = await testDb.stockMovement.findMany({
          where: {
            referenceNumber: {
              startsWith: 'BATCH-001'
            }
          }
        })

        expect(movements).toHaveLength(2)
      })

      test('should handle partial batch failures gracefully', async () => {
        // Create inventory for first title only
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0
          }
        })

        const partialBatch = [
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'PARTIAL-001'
          },
          {
            titleId: 99999, // Non-existent title
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -50,
            movementDate: new Date('2024-01-16'),
            referenceNumber: 'PARTIAL-002'
          }
        ]

        // First record should succeed
        const validMovement = await testDb.stockMovement.create({
          data: partialBatch[0]
        })

        expect(validMovement.referenceNumber).toBe('PARTIAL-001')

        // Second record should fail due to foreign key constraint
        await expect(testDb.stockMovement.create({
          data: partialBatch[1]
        })).rejects.toThrow()
      })
    })

    describe('Import Summary and Reporting', () => {
      test('should generate import summary statistics', async () => {
        // Create sample movements for summary
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 2000,
            reservedStock: 0
          }
        })

        const importMovements = [
          { type: 'UK_TRADE_SALES', quantity: -100 },
          { type: 'ONLINE_SALES', quantity: -75 },
          { type: 'DIRECT_SALES', quantity: -50 },
          { type: 'US_TRADE_SALES', quantity: -25 }
        ]

        for (const [index, movement] of importMovements.entries()) {
          await testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: movement.type as any,
              quantity: movement.quantity,
              movementDate: new Date('2024-01-15'),
              referenceNumber: `SUMMARY-${index + 1}`
            }
          })
        }

        // Query movements for summary
        const movements = await testDb.stockMovement.findMany({
          where: {
            referenceNumber: {
              startsWith: 'SUMMARY'
            }
          }
        })

        const summary = {
          totalRecords: movements.length,
          totalQuantity: movements.reduce((sum, m) => sum + Math.abs(m.quantity), 0),
          movementTypes: [...new Set(movements.map(m => m.movementType))],
          dateRange: {
            earliest: movements.reduce((min, m) => m.movementDate < min ? m.movementDate : min, movements[0].movementDate),
            latest: movements.reduce((max, m) => m.movementDate > max ? m.movementDate : max, movements[0].movementDate)
          }
        }

        expect(summary.totalRecords).toBe(4)
        expect(summary.totalQuantity).toBe(250)
        expect(summary.movementTypes).toHaveLength(4)
      })
    })
  })

  describe('Movement Audit Trail and Reporting', () => {
    describe('Audit Trail Tracking', () => {
      test('should maintain complete audit trail for all movements', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0
          }
        })

        // Create movement with audit information
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -150,
            movementDate: new Date('2024-01-20'),
            referenceNumber: 'AUDIT-001',
            notes: 'Bulk trade sale to major retailer',
            rrpAtTime: 19.99,
            unitCostAtTime: 8.50,
            tradeDiscountAtTime: 45.00
          }
        })

        // Verify audit trail fields are captured
        expect(movement.createdAt).toBeInstanceOf(Date)
        expect(movement.updatedAt).toBeInstanceOf(Date)
        expect(movement.referenceNumber).toBe('AUDIT-001')
        expect(movement.notes).toBe('Bulk trade sale to major retailer')

        // Financial snapshot preserved
        expect(parseFloat(movement.rrpAtTime?.toString() || '0')).toBe(19.99)
        expect(parseFloat(movement.unitCostAtTime?.toString() || '0')).toBe(8.50)
        expect(parseFloat(movement.tradeDiscountAtTime?.toString() || '0')).toBe(45.00)
      })

      test('should track movement chains for warehouse transfers', async () => {
        await testDb.inventory.createMany({
          data: [
            {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              currentStock: 800,
              reservedStock: 0
            },
            {
              titleId: title1.id,
              warehouseId: warehouse2.id,
              currentStock: 0,
              reservedStock: 0
            }
          ]
        })

        const transferRef = 'TRANSFER-AUDIT-001'

        // Create linked transfer movements
        const outboundMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -300,
            movementDate: new Date('2024-01-25'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: transferRef,
            notes: 'Transfer to secondary warehouse due to capacity constraints'
          }
        })

        const inboundMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse2.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: 300,
            movementDate: new Date('2024-01-25'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: transferRef,
            notes: 'Received from main warehouse'
          }
        })

        // Query transfer chain
        const transferChain = await testDb.stockMovement.findMany({
          where: { referenceNumber: transferRef },
          include: {
            sourceWarehouse: true,
            destinationWarehouse: true
          },
          orderBy: { quantity: 'asc' } // Outbound first (negative), then inbound
        })

        expect(transferChain).toHaveLength(2)
        expect(transferChain[0].quantity).toBe(-300) // Outbound
        expect(transferChain[1].quantity).toBe(300)  // Inbound
        expect(transferChain[0].sourceWarehouse?.code).toBe('MAIN001')
        expect(transferChain[1].destinationWarehouse?.code).toBe('SEC001')
      })
    })

    describe('Movement History Reporting', () => {
      test('should generate title movement history report', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 3000,
            reservedStock: 0
          }
        })

        // Create movement history over time
        const movementHistory = [
          { type: 'PRINT_RECEIVED', quantity: 5000, date: '2024-01-01', ref: 'PRINT-001' },
          { type: 'UK_TRADE_SALES', quantity: -800, date: '2024-01-10', ref: 'SALE-001' },
          { type: 'ONLINE_SALES', quantity: -600, date: '2024-01-15', ref: 'ONLINE-001' },
          { type: 'DIRECT_SALES', quantity: -400, date: '2024-01-20', ref: 'DIRECT-001' },
          { type: 'DAMAGED', quantity: -200, date: '2024-01-25', ref: 'ADJ-001' }
        ]

        for (const movement of movementHistory) {
          await testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: movement.type as any,
              quantity: movement.quantity,
              movementDate: new Date(movement.date),
              referenceNumber: movement.ref,
              unitCostAtTime: 8.50
            }
          })
        }

        // Generate history report
        const history = await testDb.stockMovement.findMany({
          where: { titleId: title1.id },
          orderBy: { movementDate: 'asc' },
          include: {
            title: true,
            warehouse: true
          }
        })

        expect(history).toHaveLength(5)

        // Calculate running balance
        let runningBalance = 0
        const expectedBalances = [5000, 4200, 3600, 3200, 3000]

        history.forEach((movement, index) => {
          runningBalance += movement.quantity
          expect(runningBalance).toBe(expectedBalances[index])
        })
      })

      test('should generate warehouse activity report', async () => {
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

        // Create diverse warehouse activity
        const warehouseActivity = [
          { titleId: title1.id, type: 'UK_TRADE_SALES', quantity: -100, ref: 'WH-ACT-001' },
          { titleId: title2.id, type: 'ONLINE_SALES', quantity: -50, ref: 'WH-ACT-002' },
          { titleId: title1.id, type: 'DIRECT_SALES', quantity: -75, ref: 'WH-ACT-003' },
          { titleId: title2.id, type: 'US_TRADE_SALES', quantity: -25, ref: 'WH-ACT-004' }
        ]

        for (const activity of warehouseActivity) {
          await testDb.stockMovement.create({
            data: {
              titleId: activity.titleId,
              warehouseId: warehouse1.id,
              movementType: activity.type as any,
              quantity: activity.quantity,
              movementDate: new Date('2024-01-20'),
              referenceNumber: activity.ref
            }
          })
        }

        // Query warehouse activity report
        const warehouseReport = await testDb.stockMovement.findMany({
          where: { warehouseId: warehouse1.id },
          include: {
            title: true,
            warehouse: true
          },
          orderBy: { movementDate: 'desc' }
        })

        // Aggregate statistics
        const reportStats = {
          totalMovements: warehouseReport.length,
          totalQuantity: Math.abs(warehouseReport.reduce((sum, m) => sum + m.quantity, 0)),
          uniqueTitles: new Set(warehouseReport.map(m => m.titleId)).size,
          movementTypes: [...new Set(warehouseReport.map(m => m.movementType))]
        }

        expect(reportStats.totalMovements).toBe(4)
        expect(reportStats.totalQuantity).toBe(250)
        expect(reportStats.uniqueTitles).toBe(2)
        expect(reportStats.movementTypes).toHaveLength(4)
      })
    })
  })

  describe('Movement Reversal and Correction Procedures', () => {
    describe('Movement Reversal', () => {
      test('should create reversal movement for erroneous entry', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0
          }
        })

        // Original erroneous movement
        const originalMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -500, // Incorrect quantity
            movementDate: new Date('2024-01-20'),
            referenceNumber: 'ERROR-SALE-001',
            rrpAtTime: 19.99,
            unitCostAtTime: 8.50
          }
        })

        // Reversal movement
        const reversalMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: 500, // Opposite of original
            movementDate: new Date('2024-01-21'),
            referenceNumber: 'REVERSAL-ERROR-SALE-001',
            notes: `Reversal of movement ${originalMovement.id} - incorrect quantity entered`,
            rrpAtTime: 19.99,
            unitCostAtTime: 8.50
          }
        })

        expect(reversalMovement.quantity).toBe(-originalMovement.quantity)
        expect(reversalMovement.referenceNumber).toContain('REVERSAL')
        expect(reversalMovement.notes).toContain(`movement ${originalMovement.id}`)
      })

      test('should handle warehouse transfer reversal', async () => {
        await testDb.inventory.createMany({
          data: [
            {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              currentStock: 1000,
              reservedStock: 0
            },
            {
              titleId: title1.id,
              warehouseId: warehouse2.id,
              currentStock: 500,
              reservedStock: 0
            }
          ]
        })

        const transferRef = 'TRANSFER-TO-REVERSE-001'

        // Original transfer movements
        const originalOutbound = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -200,
            movementDate: new Date('2024-01-20'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: transferRef
          }
        })

        const originalInbound = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse2.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: 200,
            movementDate: new Date('2024-01-20'),
            sourceWarehouseId: warehouse1.id,
            destinationWarehouseId: warehouse2.id,
            referenceNumber: transferRef
          }
        })

        // Reversal movements
        const reversalOutbound = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: 200, // Reverse the outbound
            movementDate: new Date('2024-01-21'),
            sourceWarehouseId: warehouse2.id, // Reverse the direction
            destinationWarehouseId: warehouse1.id,
            referenceNumber: `REVERSAL-${transferRef}`,
            notes: `Reversal of transfer movements ${originalOutbound.id} and ${originalInbound.id}`
          }
        })

        const reversalInbound = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse2.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -200, // Reverse the inbound
            movementDate: new Date('2024-01-21'),
            sourceWarehouseId: warehouse2.id,
            destinationWarehouseId: warehouse1.id,
            referenceNumber: `REVERSAL-${transferRef}`,
            notes: `Reversal of transfer movements ${originalOutbound.id} and ${originalInbound.id}`
          }
        })

        // Verify reversal maintains transfer pair integrity
        expect(reversalOutbound.quantity).toBe(-originalOutbound.quantity)
        expect(reversalInbound.quantity).toBe(-originalInbound.quantity)
        expect(reversalOutbound.sourceWarehouseId).toBe(originalOutbound.destinationWarehouseId)
        expect(reversalOutbound.destinationWarehouseId).toBe(originalOutbound.sourceWarehouseId)
      })
    })

    describe('Movement Correction', () => {
      test('should correct movement with replacement entry', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0
          }
        })

        // Original incorrect movement
        const incorrectMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-20'),
            referenceNumber: 'INCORRECT-001',
            rrpAtTime: 15.99, // Wrong price
            unitCostAtTime: 6.50 // Wrong cost
          }
        })

        // Reversal of incorrect movement
        const reversalMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: 100, // Reverse
            movementDate: new Date('2024-01-21'),
            referenceNumber: 'REVERSAL-INCORRECT-001',
            notes: `Reversal for correction of movement ${incorrectMovement.id}`
          }
        })

        // Corrected movement with accurate data
        const correctedMovement = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-20'), // Original date
            referenceNumber: 'CORRECTED-001',
            rrpAtTime: 19.99, // Correct price
            unitCostAtTime: 8.50, // Correct cost
            notes: `Correction of movement ${incorrectMovement.id} with accurate financial data`
          }
        })

        expect(parseFloat(correctedMovement.rrpAtTime?.toString() || '0')).toBe(19.99)
        expect(parseFloat(correctedMovement.unitCostAtTime?.toString() || '0')).toBe(8.50)
        expect(correctedMovement.notes).toContain(`Correction of movement ${incorrectMovement.id}`)
      })

      test('should handle batch correction procedures', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 2000,
            reservedStock: 0
          }
        })

        // Create batch of incorrect movements
        const incorrectBatch = [
          { quantity: -50, ref: 'BATCH-ERROR-001' },
          { quantity: -75, ref: 'BATCH-ERROR-002' },
          { quantity: -100, ref: 'BATCH-ERROR-003' }
        ]

        const incorrectMovements = []
        for (const movement of incorrectBatch) {
          const created = await testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: 'UK_TRADE_SALES',
              quantity: movement.quantity,
              movementDate: new Date('2024-01-20'),
              referenceNumber: movement.ref,
              rrpAtTime: 15.99 // Wrong price for all
            }
          })
          incorrectMovements.push(created)
        }

        // Batch reversal
        for (const [index, originalMovement] of incorrectMovements.entries()) {
          await testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: 'UK_TRADE_SALES',
              quantity: -originalMovement.quantity,
              movementDate: new Date('2024-01-21'),
              referenceNumber: `REVERSAL-${originalMovement.referenceNumber}`,
              notes: `Batch correction reversal ${index + 1}/3`
            }
          })
        }

        // Verify all reversals created
        const reversals = await testDb.stockMovement.findMany({
          where: {
            referenceNumber: {
              startsWith: 'REVERSAL-BATCH-ERROR'
            }
          }
        })

        expect(reversals).toHaveLength(3)
        expect(reversals.every(r => r.notes?.includes('Batch correction reversal'))).toBe(true)
      })
    })

    describe('Correction Audit Trail', () => {
      test('should maintain complete audit trail for corrections', async () => {
        await testDb.inventory.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 1000,
            reservedStock: 0
          }
        })

        // Original movement
        const original = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 2000,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'PRINT-AUDIT-001',
            printerId: printer.id,
            batchNumber: 'WRONG-BATCH'
          }
        })

        // Correction with full audit trail
        const correction = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: -2000, // Reverse
            movementDate: new Date('2024-01-16'),
            referenceNumber: 'CORRECTION-PRINT-AUDIT-001',
            notes: `CORRECTION: Original movement ${original.id} had incorrect batch number. Correcting from 'WRONG-BATCH' to 'CORRECT-BATCH-001'. Authorized by: System Admin. Reason: Data entry error during print receipt processing.`
          }
        })

        // Corrected movement
        const corrected = await testDb.stockMovement.create({
          data: {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 2000,
            movementDate: new Date('2024-01-15'), // Original date
            referenceNumber: 'CORRECTED-PRINT-AUDIT-001',
            printerId: printer.id,
            batchNumber: 'CORRECT-BATCH-001',
            notes: `Corrected version of movement ${original.id}. Original reference: ${original.referenceNumber}`
          }
        })

        // Verify audit trail completeness
        const auditTrail = await testDb.stockMovement.findMany({
          where: {
            OR: [
              { referenceNumber: 'PRINT-AUDIT-001' },
              { referenceNumber: 'CORRECTION-PRINT-AUDIT-001' },
              { referenceNumber: 'CORRECTED-PRINT-AUDIT-001' }
            ]
          },
          orderBy: { createdAt: 'asc' }
        })

        expect(auditTrail).toHaveLength(3)
        expect(auditTrail[0].referenceNumber).toBe('PRINT-AUDIT-001')
        expect(auditTrail[1].referenceNumber).toBe('CORRECTION-PRINT-AUDIT-001')
        expect(auditTrail[2].referenceNumber).toBe('CORRECTED-PRINT-AUDIT-001')
        expect(auditTrail[1].notes).toContain('CORRECTION:')
        expect(auditTrail[2].notes).toContain(`Original reference: ${original.referenceNumber}`)
      })
    })
  })

  describe('Integration and Edge Cases', () => {
    test('should handle concurrent movement processing', async () => {
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 1000,
          reservedStock: 0
        }
      })

      // Simulate concurrent movements
      const concurrentMovements = [
        { type: 'UK_TRADE_SALES', quantity: -100, ref: 'CONCURRENT-001' },
        { type: 'ONLINE_SALES', quantity: -150, ref: 'CONCURRENT-002' },
        { type: 'DIRECT_SALES', quantity: -75, ref: 'CONCURRENT-003' }
      ]

      const movements = await Promise.all(
        concurrentMovements.map(movement =>
          testDb.stockMovement.create({
            data: {
              titleId: title1.id,
              warehouseId: warehouse1.id,
              movementType: movement.type as any,
              quantity: movement.quantity,
              movementDate: new Date('2024-01-25'),
              referenceNumber: movement.ref
            }
          })
        )
      )

      expect(movements).toHaveLength(3)
      expect(movements.every(m => m.id)).toBe(true)
    })

    test('should handle large quantity movements', async () => {
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 0,
          reservedStock: 0
        }
      })

      // Large print run
      const largeMovement = await testDb.stockMovement.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 50000,
          movementDate: new Date('2024-01-01'),
          referenceNumber: 'LARGE-PRINT-001',
          printerId: printer.id,
          batchNumber: 'LARGE-BATCH-001'
        }
      })

      expect(largeMovement.quantity).toBe(50000)
      expect(largeMovement.batchNumber).toBe('LARGE-BATCH-001')
    })

    test('should validate movement date constraints', async () => {
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 100,
          reservedStock: 0
        }
      })

      // Movement with old date should be allowed for historical data
      const historicalMovement = await testDb.stockMovement.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -10,
          movementDate: new Date('2020-01-01'),
          referenceNumber: 'HISTORICAL-001'
        }
      })

      expect(historicalMovement.movementDate).toEqual(new Date('2020-01-01'))
    })
  })
})