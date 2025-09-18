import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse } from '../utils/test-db'

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

    test('should create print received movement with printer name', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'PRT' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 4000,
          movementDate: new Date('2024-01-10'),
          printerName: 'Lightning Source UK',
          referenceNumber: 'PRINT-2024-0115'
        }
      })

      expect(movement.printerName).toBe('Lightning Source UK')
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
            movementDate: new Date()
          }
        })

        expect(movement.movementType).toBe(movementType)
        expect(movement.quantity).toBeGreaterThan(0)
      }
    })

    test('should support all sales channel movement types', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'SLS' })

      const salesTypes = [
        'ONLINE_SALES',
        'UK_TRADE_SALES',
        'US_TRADE_SALES',
        'ROW_TRADE_SALES',
        'DIRECT_SALES'
      ] as const

      for (const movementType of salesTypes) {
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType,
            quantity: -250, // Negative for outbound sales
            movementDate: new Date(`2024-01-${10 + salesTypes.indexOf(movementType)}`)
          }
        })

        expect(movement.movementType).toBe(movementType)
        expect(movement.quantity).toBeLessThan(0)
      }
    })

    test('should support other outbound movement types', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'OUT' })

      const otherTypes = ['PULPED', 'DAMAGED', 'FREE_COPIES'] as const

      for (const movementType of otherTypes) {
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType,
            quantity: -50, // Negative for outbound
            movementDate: new Date()
          }
        })

        expect(movement.movementType).toBe(movementType)
        expect(movement.quantity).toBeLessThan(0)
      }
    })
  })

  describe('Validation', () => {
    test('should require essential movement fields', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'REQ' })

      // Missing movementType
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            quantity: 100,
            movementDate: new Date()
          } as any
        })
      ).rejects.toThrow()

      // Missing quantity
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            movementDate: new Date()
          } as any
        })
      ).rejects.toThrow()

      // Missing movementDate
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100
          } as any
        })
      ).rejects.toThrow()
    })

    test('should enforce field length constraints', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'LEN' })

      // Printer name too long
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date(),
            printerName: 'a'.repeat(101)
          }
        })
      ).rejects.toThrow()

      // Reference number too long
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date(),
            referenceNumber: 'a'.repeat(101)
          }
        })
      ).rejects.toThrow()
    })

    test('should allow zero quantity movements', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'ZER' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'DAMAGED',
          quantity: 0, // Zero quantity for adjustments
          movementDate: new Date(),
          notes: 'Stock count adjustment - no actual change'
        }
      })

      expect(movement.quantity).toBe(0)
    })
  })

  describe('Relationships', () => {
    test('should link to title and warehouse', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Movement Test Book'
      })
      const warehouse = await createTestWarehouse({
        name: 'Movement Warehouse',
        code: 'MVT'
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 2000,
          movementDate: new Date()
        }
      })

      const movementWithRelations = await testDb.stockMovement.findUnique({
        where: { id: movement.id },
        include: {
          title: true,
          warehouse: true
        }
      })

      expect(movementWithRelations?.title.title).toBe('Movement Test Book')
      expect(movementWithRelations?.warehouse.name).toBe('Movement Warehouse')
    })

    test('should link to source and destination warehouses for transfers', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const sourceWarehouse = await createTestWarehouse({
        name: 'Source Warehouse',
        code: 'SRC'
      })
      const destWarehouse = await createTestWarehouse({
        name: 'Destination Warehouse',
        code: 'DST'
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 300,
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destWarehouse.id
        }
      })

      const movementWithAll = await testDb.stockMovement.findUnique({
        where: { id: movement.id },
        include: {
          warehouse: true,
          sourceWarehouse: true,
          destinationWarehouse: true
        }
      })

      expect(movementWithAll?.sourceWarehouse?.name).toBe('Source Warehouse')
      expect(movementWithAll?.destinationWarehouse?.name).toBe('Destination Warehouse')
      expect(movementWithAll?.warehouse.name).toBe('Destination Warehouse')
    })

    test('should handle cascade deletion from title', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'CAS' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 1000,
          movementDate: new Date()
        }
      })

      await testDb.title.delete({
        where: { id: title.id }
      })

      const remainingMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id }
      })

      expect(remainingMovements).toHaveLength(0)
    })
  })

  describe('Queries', () => {
    test('should filter movements by type', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'FLT' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'ONLINE_SALES',
          quantity: -150,
          movementDate: new Date('2024-01-02')
        }
      })

      const printMovements = await testDb.stockMovement.findMany({
        where: { movementType: 'PRINT_RECEIVED' }
      })

      const salesMovements = await testDb.stockMovement.findMany({
        where: { movementType: 'ONLINE_SALES' }
      })

      expect(printMovements).toHaveLength(1)
      expect(printMovements[0].quantity).toBe(3000)
      expect(salesMovements).toHaveLength(1)
      expect(salesMovements[0].quantity).toBe(-150)
    })

    test('should filter movements by date range', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'DTE' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 2000,
          movementDate: new Date('2024-01-15')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -100,
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

      // Initial print run
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01')
        }
      })

      // Various sales
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'ONLINE_SALES',
          quantity: -200,
          movementDate: new Date('2024-01-15')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -500,
          movementDate: new Date('2024-01-20')
        }
      })

      const allMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id },
        orderBy: { movementDate: 'asc' }
      })

      const runningTotal = allMovements.reduce((total, movement) => total + movement.quantity, 0)
      expect(runningTotal).toBe(2300) // 3000 - 200 - 500
    })

    test('should get movements for specific warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse1 = await createTestWarehouse({ code: 'WH1' })
      const warehouse2 = await createTestWarehouse({ code: 'WH2' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 2000,
          movementDate: new Date()
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 1000,
          movementDate: new Date()
        }
      })

      const warehouse1Movements = await testDb.stockMovement.findMany({
        where: { warehouseId: warehouse1.id }
      })

      expect(warehouse1Movements).toHaveLength(1)
      expect(warehouse1Movements[0].quantity).toBe(2000)
    })

    test('should order movements by date', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'ORD' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -100,
          movementDate: new Date('2024-01-20')
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-10')
        }
      })

      const chronologicalMovements = await testDb.stockMovement.findMany({
        orderBy: { movementDate: 'asc' }
      })

      expect(chronologicalMovements[0].movementType).toBe('PRINT_RECEIVED')
      expect(chronologicalMovements[1].movementType).toBe('UK_TRADE_SALES')
    })
  })

  describe('Business Logic Scenarios', () => {
    test('should track monthly warehouse import scenario', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({
        name: 'Turnaround',
        code: 'TRN',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      // Simulate monthly data import from Turnaround
      const monthlyMovements = [
        { type: 'UK_TRADE_SALES', quantity: -45 },
        { type: 'ROW_TRADE_SALES', quantity: -23 },
        { type: 'DAMAGED', quantity: -2 },
        { type: 'FREE_COPIES', quantity: -5 }
      ] as const

      for (let index = 0; index < monthlyMovements.length; index++) {
        const movement = monthlyMovements[index];
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: movement.type,
            quantity: movement.quantity,
            movementDate: new Date(`2024-01-${15 + index}`),
            referenceNumber: `TRN-2024-01-${index + 1}`,
            notes: 'Monthly warehouse data import'
          }
        })
      }

      const monthlyTotal = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementDate: {
            gte: new Date('2024-01-01'),
            lt: new Date('2024-02-01')
          }
        }
      })

      const totalSold = monthlyTotal.reduce((sum, movement) => sum + movement.quantity, 0)
      expect(totalSold).toBe(-75) // -45 - 23 - 2 - 5

      const salesByChannel = {
        UK_TRADE: monthlyTotal.filter(m => m.movementType === 'UK_TRADE_SALES').reduce((s, m) => s + m.quantity, 0),
        ROW_TRADE: monthlyTotal.filter(m => m.movementType === 'ROW_TRADE_SALES').reduce((s, m) => s + m.quantity, 0)
      }

      expect(salesByChannel.UK_TRADE).toBe(-45)
      expect(salesByChannel.ROW_TRADE).toBe(-23)
    })

    test('should track warehouse channel compliance', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })

      // Test Turnaround warehouse
      const turnaround = await createTestWarehouse({
        name: 'Turnaround',
        code: 'TRN',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      // Test ACC warehouse
      const acc = await createTestWarehouse({
        name: 'ACC',
        code: 'ACC',
        fulfillsChannels: ['US_TRADE_SALES']
      })

      // Test Flostream warehouse
      const flostream = await createTestWarehouse({
        name: 'Flostream',
        code: 'FLS',
        fulfillsChannels: ['ONLINE_SALES']
      })

      // Create appropriate movements for each warehouse
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: turnaround.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -100,
          movementDate: new Date()
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: acc.id,
          movementType: 'US_TRADE_SALES',
          quantity: -75,
          movementDate: new Date()
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: flostream.id,
          movementType: 'ONLINE_SALES',
          quantity: -50,
          movementDate: new Date()
        }
      })

      const movementsByWarehouse = await testDb.stockMovement.findMany({
        include: { warehouse: true }
      })

      // Verify each warehouse only handles its designated channels
      const turnaroundMovement = movementsByWarehouse.find(m => m.warehouse.code === 'TRN')
      const accMovement = movementsByWarehouse.find(m => m.warehouse.code === 'ACC')
      const flostreamMovement = movementsByWarehouse.find(m => m.warehouse.code === 'FLS')

      expect(turnaroundMovement?.movementType).toBe('UK_TRADE_SALES')
      expect(accMovement?.movementType).toBe('US_TRADE_SALES')
      expect(flostreamMovement?.movementType).toBe('ONLINE_SALES')
    })

    test('should support reprint workflow tracking', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        printRunSize: 3000,
        reprintThreshold: 1000
      })
      const warehouse = await createTestWarehouse({ code: 'RPT' })

      // Initial print run
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01'),
          printerName: 'Lightning Source UK',
          referenceNumber: 'INITIAL-PRINT-001'
        }
      })

      // Sales over time bringing stock below reprint threshold
      const salesMovements = [
        { date: '2024-01-15', quantity: -500 },
        { date: '2024-02-01', quantity: -800 },
        { date: '2024-02-15', quantity: -900 }
      ]

      for (const sale of salesMovements) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: sale.quantity,
            movementDate: new Date(sale.date)
          }
        })
      }

      // Calculate current stock from movements
      const allMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id, warehouseId: warehouse.id }
      })

      const currentStock = allMovements.reduce((total, movement) => total + movement.quantity, 0)
      expect(currentStock).toBe(800) // 3000 - 500 - 800 - 900

      const titleWithThreshold = await testDb.title.findUnique({
        where: { id: title.id }
      })

      const needsReprint = currentStock <= (titleWithThreshold?.reprintThreshold || 0)
      expect(needsReprint).toBe(true)

      // Reprint order
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-03-01'),
          printerName: 'Lightning Source UK',
          referenceNumber: 'REPRINT-001',
          notes: 'Reprint triggered by low stock alert'
        }
      })

      const finalMovements = await testDb.stockMovement.findMany({
        where: { titleId: title.id, warehouseId: warehouse.id }
      })

      const finalStock = finalMovements.reduce((total, movement) => total + movement.quantity, 0)
      expect(finalStock).toBe(3800) // 800 + 3000
    })
  })
})