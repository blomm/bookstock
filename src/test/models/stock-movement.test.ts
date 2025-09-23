import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestPrinter } from '../utils/test-db'

describe('StockMovement Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create basic stock movement record', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'STM' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-15')
        }
      })

      expect(movement).toMatchObject({
        titleId: title.id,
        warehouseId: warehouse.id,
        movementType: 'PRINT_RECEIVED',
        quantity: 3000
      })
      expect(movement.movementDate).toEqual(new Date('2024-01-15'))
      expect(movement.id).toBeDefined()
      expect(movement.createdAt).toBeInstanceOf(Date)
      expect(movement.updatedAt).toBeInstanceOf(Date)
    })

    test('should create movement with all optional fields', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const sourceWarehouse = await createTestWarehouse({ code: 'SRC' })
      const destWarehouse = await createTestWarehouse({ code: 'DST' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 500,
          movementDate: new Date('2024-01-20'),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destWarehouse.id,
          referenceNumber: 'TXN-2024-001',
          notes: 'Transfer from UK to US warehouse for increased demand'
        }
      })

      expect(movement.sourceWarehouseId).toBe(sourceWarehouse.id)
      expect(movement.destinationWarehouseId).toBe(destWarehouse.id)
      expect(movement.referenceNumber).toBe('TXN-2024-001')
      expect(movement.notes).toBe('Transfer from UK to US warehouse for increased demand')
    })

    test('should create print received movement with printer relationship', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'PRT' })
      const printer = await createTestPrinter({ name: 'Lightning Source UK' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 4000,
          movementDate: new Date('2024-01-10'),
          printerId: printer.id,
          referenceNumber: 'PRINT-2024-0115'
        },
        include: {
          printer: true
        }
      })

      expect(movement.printerId).toBe(printer.id)
      expect(movement.printer?.name).toBe('Lightning Source UK')
      expect(movement.referenceNumber).toBe('PRINT-2024-0115')
    })
  })

  describe('Movement Types', () => {
    test('should support all inbound movement types', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'INB' })

      const inboundTypes = ['PRINT_RECEIVED', 'WAREHOUSE_TRANSFER'] as const

      for (const movementType of inboundTypes) {
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType,
            quantity: 1000, // Positive for inbound
            movementDate: new Date('2024-01-15')
          }
        })

        expect(movement.movementType).toBe(movementType)
        expect(movement.quantity).toBe(1000)
      }
    })

    test('should support all outbound movement types', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'OUT' })

      const outboundTypes = ['ONLINE_SALES', 'UK_TRADE_SALES', 'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'DAMAGED', 'PULPED'] as const

      for (const movementType of outboundTypes) {
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType,
            quantity: -100, // Negative for outbound
            movementDate: new Date('2024-01-15')
          }
        })

        expect(movement.movementType).toBe(movementType)
        expect(movement.quantity).toBe(-100)
      }
    })
  })

  describe('Validation', () => {
    test('should require essential movement fields', async () => {
      await expect(testDb.stockMovement.create({
        data: {
          // Missing required fields
          quantity: 100,
          movementDate: new Date()
        }
      })).rejects.toThrow()
    })

    test('should enforce field length constraints', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'VAL' })

      // Test reference number length limit (100 chars)
      await expect(testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          referenceNumber: 'a'.repeat(101)
        }
      })).rejects.toThrow()
    })
  })

  describe('Relationships', () => {
    test('should link to title and warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'REL' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 500,
          movementDate: new Date('2024-01-15')
        },
        include: {
          title: true,
          warehouse: true
        }
      })

      expect(movement.title).toBeDefined()
      expect(movement.title.isbn).toBe('9781111111111')
      expect(movement.warehouse).toBeDefined()
      expect(movement.warehouse.code).toBe('REL')
    })

    test('should link to source and destination warehouses for transfers', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const sourceWarehouse = await createTestWarehouse({ code: 'SRC' })
      const destWarehouse = await createTestWarehouse({ code: 'DST' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 200,
          movementDate: new Date('2024-01-15'),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destWarehouse.id
        },
        include: {
          sourceWarehouse: true,
          destinationWarehouse: true
        }
      })

      expect(movement.sourceWarehouse).toBeDefined()
      expect(movement.sourceWarehouse?.code).toBe('SRC')
      expect(movement.destinationWarehouse).toBeDefined()
      expect(movement.destinationWarehouse?.code).toBe('DST')
    })

    test('should handle cascade deletion from title', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'DEL' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date('2024-01-15')
        }
      })

      // Deleting title should cascade delete movements
      await testDb.title.delete({
        where: { id: title.id }
      })

      // Movement should be deleted due to cascade
      const deletedMovement = await testDb.stockMovement.findUnique({
        where: { id: movement.id }
      })

      expect(deletedMovement).toBeNull()
    })
  })

  describe('Queries', () => {
    test('should filter movements by type', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'QRY' })

      // Create different movement types
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 1000,
          movementDate: new Date('2024-01-15')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -50,
          movementDate: new Date('2024-01-16')
        }
      })

      const printMovements = await testDb.stockMovement.findMany({
        where: { movementType: 'PRINT_RECEIVED' }
      })

      const saleMovements = await testDb.stockMovement.findMany({
        where: { movementType: 'UK_TRADE_SALES' }
      })

      expect(printMovements).toHaveLength(1)
      expect(printMovements[0].quantity).toBe(1000)
      expect(saleMovements).toHaveLength(1)
      expect(saleMovements[0].quantity).toBe(-50)
    })

    test('should filter movements by date range', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'DTE' })

      // Create movements on different dates
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 1000,
          movementDate: new Date('2024-01-01')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -50,
          movementDate: new Date('2024-02-15')
        }
      })

      const januaryMovements = await testDb.stockMovement.findMany({
        where: {
          movementDate: {
            gte: new Date('2024-01-01'),
            lt: new Date('2024-02-01')
          }
        }
      })

      expect(januaryMovements).toHaveLength(1)
      expect(januaryMovements[0].movementType).toBe('PRINT_RECEIVED')
    })

    test('should calculate running totals for title', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'TOT' })

      // Create a series of movements
      const movements = [
        { type: 'PRINT_RECEIVED', quantity: 1000, date: '2024-01-01' },
        { type: 'UK_TRADE_SALES', quantity: -100, date: '2024-01-05' },
        { type: 'DIRECT_SALES', quantity: -50, date: '2024-01-10' },
        { type: 'PRINT_RECEIVED', quantity: 500, date: '2024-01-15' }
      ]

      for (const movement of movements) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: movement.type as any,
            quantity: movement.quantity,
            movementDate: new Date(movement.date)
          }
        })
      }

      const allMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id },
        orderBy: { movementDate: 'asc' }
      })

      // Calculate running total
      let runningTotal = 0
      const expectedTotals = [1000, 900, 850, 1350]

      allMovements.forEach((movement, index) => {
        runningTotal += movement.quantity
        expect(runningTotal).toBe(expectedTotals[index])
      })
    })

    test('should get movements for specific warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse1 = await createTestWarehouse({ code: 'WH1' })
      const warehouse2 = await createTestWarehouse({ code: 'WH2' })

      // Create movements in different warehouses
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 1000,
          movementDate: new Date('2024-01-15')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 500,
          movementDate: new Date('2024-01-15')
        }
      })

      const wh1Movements = await testDb.stockMovement.findMany({
        where: { warehouseId: warehouse1.id }
      })

      const wh2Movements = await testDb.stockMovement.findMany({
        where: { warehouseId: warehouse2.id }
      })

      expect(wh1Movements).toHaveLength(1)
      expect(wh1Movements[0].quantity).toBe(1000)
      expect(wh2Movements).toHaveLength(1)
      expect(wh2Movements[0].quantity).toBe(500)
    })

    test('should order movements by date', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'ORD' })

      const dates = ['2024-01-15', '2024-01-10', '2024-01-20', '2024-01-05']

      // Create movements in random order
      for (const date of dates) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date(date)
          }
        })
      }

      const orderedMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id },
        orderBy: { movementDate: 'asc' }
      })

      const expectedOrder = ['2024-01-05', '2024-01-10', '2024-01-15', '2024-01-20']
      orderedMovements.forEach((movement, index) => {
        expect(movement.movementDate).toEqual(new Date(expectedOrder[index]))
      })
    })
  })

  describe('Business Logic Scenarios', () => {
    test('should track monthly warehouse import scenario', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'IMP' })
      const printer = await createTestPrinter({ name: 'Lightning Source UK' })

      // Initial print run received
      const printMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01'),
          printerId: printer.id,
          referenceNumber: 'INITIAL-PRINT-001',
          batchNumber: 'BATCH-2024-001'
        }
      })

      // Sales throughout the month
      const salesData = [
        { date: '2024-01-05', quantity: -100, type: 'UK_TRADE_SALES' },
        { date: '2024-01-12', quantity: -200, type: 'DIRECT_SALES' },
        { date: '2024-01-18', quantity: -150, type: 'UK_TRADE_SALES' },
        { date: '2024-01-25', quantity: -75, type: 'DIRECT_SALES' }
      ]

      for (const sale of salesData) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: sale.type as any,
            quantity: sale.quantity,
            movementDate: new Date(sale.date),
            rrpAtTime: 19.99,
            unitCostAtTime: 5.50,
            tradeDiscountAtTime: 40.00
          }
        })
      }

      // Query all movements for the month
      const monthlyMovements = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          movementDate: {
            gte: new Date('2024-01-01'),
            lt: new Date('2024-02-01')
          }
        },
        orderBy: { movementDate: 'asc' },
        include: {
          printer: true
        }
      })

      expect(monthlyMovements).toHaveLength(5) // 1 print + 4 sales
      expect(monthlyMovements[0].movementType).toBe('PRINT_RECEIVED')
      expect(monthlyMovements[0].printer?.name).toBe('Lightning Source UK')

      // Calculate end of month stock
      const totalQuantity = monthlyMovements.reduce((sum, movement) => sum + movement.quantity, 0)
      expect(totalQuantity).toBe(2475) // 3000 - 525 sold
    })

    test('should track warehouse channel compliance', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const ukWarehouse = await createTestWarehouse({
        code: 'UK',
        fulfillsChannels: ['UK_TRADE', 'UK_DIRECT']
      })
      const rowWarehouse = await createTestWarehouse({
        code: 'ROW',
        fulfillsChannels: ['ROW_TRADE', 'EXPORT']
      })

      // Stock received at UK warehouse
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: ukWarehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 2000,
          movementDate: new Date('2024-01-01')
        }
      })

      // Transfer some stock to ROW warehouse
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: rowWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 500,
          movementDate: new Date('2024-01-05'),
          sourceWarehouseId: ukWarehouse.id,
          destinationWarehouseId: rowWarehouse.id,
          referenceNumber: 'TRANSFER-UK-ROW-001'
        }
      })

      // Corresponding outbound from UK warehouse
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: ukWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -500,
          movementDate: new Date('2024-01-05'),
          sourceWarehouseId: ukWarehouse.id,
          destinationWarehouseId: rowWarehouse.id,
          referenceNumber: 'TRANSFER-UK-ROW-001'
        }
      })

      // Verify movements by warehouse
      const ukMovements = await testDb.stockMovement.findMany({
        where: { warehouseId: ukWarehouse.id },
        include: { warehouse: true }
      })

      const rowMovements = await testDb.stockMovement.findMany({
        where: { warehouseId: rowWarehouse.id },
        include: { warehouse: true }
      })

      expect(ukMovements).toHaveLength(2)
      expect(rowMovements).toHaveLength(1)

      // Calculate current stock levels
      const ukStock = ukMovements.reduce((sum, m) => sum + m.quantity, 0)
      const rowStock = rowMovements.reduce((sum, m) => sum + m.quantity, 0)

      expect(ukStock).toBe(1500)
      expect(rowStock).toBe(500)
    })

    test('should support reprint workflow tracking', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'RPT' })
      const printer = await createTestPrinter({ name: 'Lightning Source UK' })

      // Initial print run
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01'),
          printerId: printer.id,
          referenceNumber: 'INITIAL-PRINT-001',
          batchNumber: 'BATCH-2024-001',
          manufacturingDate: new Date('2024-01-01')
        }
      })

      // Heavy sales bringing stock low
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -2800,
          movementDate: new Date('2024-03-15'),
          referenceNumber: 'BULK-SALE-001'
        }
      })

      // Reprint ordered when stock hits threshold
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 5000,
          movementDate: new Date('2024-04-01'),
          printerId: printer.id,
          referenceNumber: 'REPRINT-001',
          batchNumber: 'BATCH-2024-002',
          manufacturingDate: new Date('2024-04-01')
        }
      })

      // Track all print receipts
      const printReceipts = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          movementType: 'PRINT_RECEIVED'
        },
        orderBy: { movementDate: 'asc' },
        include: { printer: true }
      })

      expect(printReceipts).toHaveLength(2)
      expect(printReceipts[0].batchNumber).toBe('BATCH-2024-001')
      expect(printReceipts[1].batchNumber).toBe('BATCH-2024-002')
      expect(printReceipts[1].quantity).toBe(5000)

      // Calculate total printed vs sold
      const allMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id }
      })

      const totalPrinted = allMovements
        .filter(m => m.movementType === 'PRINT_RECEIVED')
        .reduce((sum, m) => sum + m.quantity, 0)

      const totalSold = Math.abs(allMovements
        .filter(m => m.movementType === 'UK_TRADE_SALES')
        .reduce((sum, m) => sum + m.quantity, 0))

      expect(totalPrinted).toBe(8000)
      expect(totalSold).toBe(2800)
    })
  })
})