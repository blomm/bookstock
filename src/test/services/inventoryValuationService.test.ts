import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'
import InventoryValuationService, { setDbClient, StockMovementData, ValuationAdjustment } from '@/services/inventoryValuationService'

describe('InventoryValuationService', () => {
  let warehouse1: any
  let warehouse2: any
  let title: any

  beforeEach(async () => {
    await cleanDatabase()
    setDbClient(testDb)

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

    // Create test title
    title = await createTestTitle({
      isbn: '9781234567890',
      title: 'Valuation Test Book',
      author: 'Test Author',
      rrp: 19.99,
      unitCost: 8.50
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('FIFO Valuation', () => {
    test('should calculate FIFO correctly with multiple cost layers', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 100,
          unitCostAtTime: 8.00,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 2,
          quantity: 50,
          unitCostAtTime: 9.00,
          movementDate: new Date('2024-02-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 3,
          quantity: 75,
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-03-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateFIFO(movements, 120)

      expect(result.method).toBe('FIFO')
      expect(result.remainingStock).toBe(120)
      expect(result.breakdown).toHaveLength(2) // Should use oldest layers first

      // First layer: 100 units at £8.00
      expect(result.breakdown[0].quantity).toBe(100)
      expect(result.breakdown[0].unitCost).toBe(8.00)
      expect(result.breakdown[0].totalCost).toBe(800.00)

      // Second layer: 20 units at £9.00
      expect(result.breakdown[1].quantity).toBe(20)
      expect(result.breakdown[1].unitCost).toBe(9.00)
      expect(result.breakdown[1].totalCost).toBe(180.00)

      // Total value: £800 + £180 = £980
      expect(result.totalValue).toBe(980.00)
      expect(result.unitCost).toBeCloseTo(8.17, 2) // £980 / 120 units
    })

    test('should handle zero inventory correctly', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 100,
          unitCostAtTime: 8.00,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateFIFO(movements, 0)

      expect(result.totalValue).toBe(0)
      expect(result.unitCost).toBe(0)
      expect(result.breakdown).toHaveLength(0)
      expect(result.remainingStock).toBe(0)
    })

    test('should handle insufficient movement history', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 50,
          unitCostAtTime: 8.00,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateFIFO(movements, 100)

      expect(result.breakdown).toHaveLength(1)
      expect(result.breakdown[0].quantity).toBe(50)
      expect(result.totalValue).toBe(400.00) // Only 50 units valued
      expect(result.unitCost).toBe(4.00) // £400 / 100 units
    })
  })

  describe('LIFO Valuation', () => {
    test('should calculate LIFO correctly with multiple cost layers', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 100,
          unitCostAtTime: 8.00,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 2,
          quantity: 50,
          unitCostAtTime: 9.00,
          movementDate: new Date('2024-02-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 3,
          quantity: 75,
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-03-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateLIFO(movements, 120)

      expect(result.method).toBe('LIFO')
      expect(result.remainingStock).toBe(120)
      expect(result.breakdown).toHaveLength(2) // Should use newest layers first

      // First layer: 75 units at £8.50 (newest)
      expect(result.breakdown[0].quantity).toBe(75)
      expect(result.breakdown[0].unitCost).toBe(8.50)
      expect(result.breakdown[0].totalCost).toBe(637.50)

      // Second layer: 45 units at £9.00 (second newest)
      expect(result.breakdown[1].quantity).toBe(45)
      expect(result.breakdown[1].unitCost).toBe(9.00)
      expect(result.breakdown[1].totalCost).toBe(405.00)

      // Total value: £637.50 + £405 = £1042.50
      expect(result.totalValue).toBe(1042.50)
      expect(result.unitCost).toBeCloseTo(8.69, 2) // £1042.50 / 120 units
    })
  })

  describe('Weighted Average Valuation', () => {
    test('should calculate weighted average correctly', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 100,
          unitCostAtTime: 8.00,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 2,
          quantity: 50,
          unitCostAtTime: 9.00,
          movementDate: new Date('2024-02-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 3,
          quantity: 75,
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-03-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateWeightedAverage(movements, 120)

      expect(result.method).toBe('WEIGHTED_AVERAGE')
      expect(result.remainingStock).toBe(120)
      expect(result.breakdown).toHaveLength(1) // Single weighted average layer

      // Total received: 100*8.00 + 50*9.00 + 75*8.50 = 800 + 450 + 637.50 = 1887.50
      // Total quantity: 225
      // Weighted average: 1887.50 / 225 = 8.3889 rounds to 8.39
      const expectedUnitCost = 8.39 // Rounded to 2 decimal places

      expect(result.unitCost).toBe(expectedUnitCost)
      expect(result.totalValue).toBeCloseTo(1006.80, 0) // Allow for rounding differences
      expect(result.breakdown[0].batchReference).toBe('WEIGHTED_AVERAGE')
    })

    test('should handle single cost layer', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 150,
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateWeightedAverage(movements, 100)

      expect(result.unitCost).toBe(8.50)
      expect(result.totalValue).toBe(850.00)
      expect(result.breakdown).toHaveLength(1)
    })
  })

  describe('Warehouse Valuation Integration', () => {
    test('should calculate complete warehouse valuation', async () => {
      // Create inventory record
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 120,
        reservedStock: 0,
        averageCost: 8.00,
        totalValue: 960.00
      })

      // Create stock movements
      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-01'),
            unitCostAtTime: 8.00
          },
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 50,
            movementDate: new Date('2024-02-01'),
            unitCostAtTime: 9.00
          }
        ]
      })

      const valuation = await InventoryValuationService.calculateTitleWarehouseValuation(
        title.id,
        warehouse1.id
      )

      expect(valuation).toBeDefined()
      expect(valuation!.titleId).toBe(title.id)
      expect(valuation!.warehouseId).toBe(warehouse1.id)
      expect(valuation!.currentStock).toBe(120)
      expect(valuation!.recommendedMethod).toBe('FIFO')

      // All three methods should be calculated
      expect(valuation!.fifoValuation.method).toBe('FIFO')
      expect(valuation!.lifoValuation.method).toBe('LIFO')
      expect(valuation!.weightedAverageValuation.method).toBe('WEIGHTED_AVERAGE')
    })

    test('should return null for non-existent inventory', async () => {
      const valuation = await InventoryValuationService.calculateTitleWarehouseValuation(
        999999, // Non-existent title
        warehouse1.id
      )

      expect(valuation).toBeNull()
    })
  })

  describe('Inventory Valuation Updates', () => {
    test('should update inventory with FIFO valuation', async () => {
      // Create inventory record
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 100,
        reservedStock: 0,
        averageCost: 0,
        totalValue: 0
      })

      // Create stock movement
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date('2024-01-01'),
          unitCostAtTime: 8.50
        }
      })

      const result = await InventoryValuationService.updateInventoryValuation(
        title.id,
        warehouse1.id,
        'FIFO'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('FIFO method')
      expect(result.valuation).toBeDefined()
      expect(result.valuation!.unitCost).toBe(8.50)
      expect(result.valuation!.totalValue).toBe(850.00)

      // Verify database update
      const updatedInventory = await testDb.inventory.findFirst({
        where: {
          titleId: title.id,
          warehouseId: warehouse1.id
        }
      })

      expect(Number(updatedInventory!.averageCost)).toBe(8.50)
      expect(Number(updatedInventory!.totalValue)).toBe(850.00)
      expect(updatedInventory!.lastCostUpdate).toBeDefined()
    })

    test('should fail to update non-existent inventory', async () => {
      const result = await InventoryValuationService.updateInventoryValuation(
        999999,
        warehouse1.id,
        'FIFO'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })
  })

  describe('Aging Report', () => {
    test('should generate aging report with risk assessment', async () => {
      // Create inventory items with different ages
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 100,
        reservedStock: 0,
        averageCost: 8.50,
        totalValue: 850.00
      })

      // Create old stock movement (3 years ago - CRITICAL risk)
      const oldDate = new Date()
      oldDate.setFullYear(oldDate.getFullYear() - 3)

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: oldDate,
          unitCostAtTime: 8.50
        }
      })

      const agingReport = await InventoryValuationService.generateAgingReport(warehouse1.id)

      expect(agingReport).toHaveLength(1)
      expect(agingReport[0].titleId).toBe(title.id)
      expect(agingReport[0].warehouseId).toBe(warehouse1.id)
      expect(agingReport[0].ageInDays).toBeGreaterThan(1000) // About 3 years
      expect(agingReport[0].obsolescenceRisk).toBe('CRITICAL')
      expect(agingReport[0].recommendedAction).toBe('WRITE_OFF')
      expect(agingReport[0].quantity).toBe(100)
      expect(agingReport[0].unitCost).toBe(8.50)
      expect(agingReport[0].totalValue).toBe(850.00)
    })

    test('should generate aging report for all warehouses when no filter provided', async () => {
      // Create inventory in multiple warehouses
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 50,
        reservedStock: 0,
        averageCost: 8.50,
        totalValue: 425.00
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse2.id,
        currentStock: 30,
        reservedStock: 0,
        averageCost: 9.00,
        totalValue: 270.00
      })

      // Create stock movements for both warehouses
      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 50,
            movementDate: new Date('2022-01-01'), // About 2 years - HIGH risk
            unitCostAtTime: 8.50
          },
          {
            titleId: title.id,
            warehouseId: warehouse2.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 30,
            movementDate: new Date(), // Current date - LOW risk
            unitCostAtTime: 9.00
          }
        ]
      })

      const agingReport = await InventoryValuationService.generateAgingReport()

      expect(agingReport).toHaveLength(2)

      // Should be sorted by age (oldest first)
      expect(agingReport[0].warehouseId).toBe(warehouse1.id)
      expect(agingReport[0].obsolescenceRisk).toBe('CRITICAL') // 2022 data is over 3 years old
      expect(agingReport[0].recommendedAction).toBe('WRITE_OFF')

      expect(agingReport[1].warehouseId).toBe(warehouse2.id)
      expect(agingReport[1].obsolescenceRisk).toBe('LOW')
      expect(agingReport[1].recommendedAction).toBe('NONE')
    })
  })

  describe('Valuation Adjustments', () => {
    test('should create write-down adjustment', async () => {
      // Create inventory record
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 100,
        reservedStock: 0,
        averageCost: 8.50,
        totalValue: 850.00
      })

      const adjustment: ValuationAdjustment = {
        titleId: title.id,
        warehouseId: warehouse1.id,
        adjustmentType: 'WRITE_DOWN',
        originalValue: 850.00,
        adjustedValue: 600.00,
        adjustmentAmount: -250.00,
        reason: 'Market value decline',
        approvedBy: 'manager@test.com',
        effectiveDate: new Date()
      }

      const result = await InventoryValuationService.createValuationAdjustment(adjustment)

      expect(result.success).toBe(true)
      expect(result.message).toContain('WRITE_DOWN')
      expect(result.adjustmentId).toBeDefined()

      // Verify inventory was updated
      const updatedInventory = await testDb.inventory.findFirst({
        where: {
          titleId: title.id,
          warehouseId: warehouse1.id
        }
      })

      expect(Number(updatedInventory!.totalValue)).toBe(600.00)
      expect(Number(updatedInventory!.averageCost)).toBe(6.00) // £600 / 100 units
    })

    test('should create write-off adjustment', async () => {
      // Create inventory record
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 50,
        reservedStock: 0,
        averageCost: 8.50,
        totalValue: 425.00
      })

      const adjustment: ValuationAdjustment = {
        titleId: title.id,
        warehouseId: warehouse1.id,
        adjustmentType: 'WRITE_OFF',
        originalValue: 425.00,
        adjustedValue: 0.00,
        adjustmentAmount: -425.00,
        reason: 'Obsolete inventory',
        approvedBy: 'manager@test.com',
        effectiveDate: new Date()
      }

      const result = await InventoryValuationService.createValuationAdjustment(adjustment)

      expect(result.success).toBe(true)
      expect(result.message).toContain('WRITE_OFF')

      // Verify inventory was written off
      const updatedInventory = await testDb.inventory.findFirst({
        where: {
          titleId: title.id,
          warehouseId: warehouse1.id
        }
      })

      expect(Number(updatedInventory!.totalValue)).toBe(0.00)
      expect(Number(updatedInventory!.averageCost)).toBe(0.00)
      expect(updatedInventory!.currentStock).toBe(0) // Stock written off
    })

    test('should fail adjustment for non-existent inventory', async () => {
      const adjustment: ValuationAdjustment = {
        titleId: 999999,
        warehouseId: warehouse1.id,
        adjustmentType: 'WRITE_DOWN',
        originalValue: 100.00,
        adjustedValue: 80.00,
        adjustmentAmount: -20.00,
        reason: 'Test',
        approvedBy: 'test@test.com',
        effectiveDate: new Date()
      }

      const result = await InventoryValuationService.createValuationAdjustment(adjustment)

      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })
  })

  describe('Title Valuation Summary', () => {
    test('should generate complete title valuation summary', async () => {
      // Create inventory in multiple warehouses
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 100,
        reservedStock: 0,
        averageCost: 8.50,
        totalValue: 850.00
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse2.id,
        currentStock: 50,
        reservedStock: 0,
        averageCost: 9.00,
        totalValue: 450.00
      })

      // Create stock movements for valuation calculations
      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date('2024-01-01'),
            unitCostAtTime: 8.50
          },
          {
            titleId: title.id,
            warehouseId: warehouse2.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 50,
            movementDate: new Date('2024-01-01'),
            unitCostAtTime: 9.00
          }
        ]
      })

      const summary = await InventoryValuationService.getTitleValuationSummary(title.id)

      expect(summary).toBeDefined()
      expect(summary!.titleId).toBe(title.id)
      expect(summary!.titleName).toBe('Valuation Test Book')
      expect(summary!.isbn).toBe('9781234567890')
      expect(summary!.totalStock).toBe(150)
      expect(summary!.warehouseBreakdown).toHaveLength(2)

      // Total value should be sum of FIFO valuations from both warehouses
      expect(summary!.totalValue).toBeGreaterThan(0)
      expect(summary!.averageUnitCost).toBeGreaterThan(0)
    })

    test('should return null for non-existent title', async () => {
      const summary = await InventoryValuationService.getTitleValuationSummary(999999)
      expect(summary).toBeNull()
    })

    test('should handle title with no inventory', async () => {
      // Title exists but no inventory records
      const summary = await InventoryValuationService.getTitleValuationSummary(title.id)

      expect(summary).toBeDefined()
      expect(summary!.totalStock).toBe(0)
      expect(summary!.totalValue).toBe(0)
      expect(summary!.warehouseBreakdown).toHaveLength(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle movements with zero or negative costs', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 100,
          unitCostAtTime: 0, // Zero cost
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 2,
          quantity: 50,
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-02-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const fifoResult = InventoryValuationService.calculateFIFO(movements, 75)

      // Should only use movement with positive cost
      expect(fifoResult.breakdown).toHaveLength(1)
      expect(fifoResult.breakdown[0].unitCost).toBe(8.50)
      expect(fifoResult.breakdown[0].quantity).toBe(50)
    })

    test('should handle negative quantities (outbound movements)', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 100,
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        },
        {
          id: 2,
          quantity: -30, // Outbound movement
          unitCostAtTime: 8.50,
          movementDate: new Date('2024-02-01'),
          movementType: 'ONLINE_SALES',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateFIFO(movements, 70)

      // Should filter out negative quantities
      expect(result.breakdown).toHaveLength(1)
      expect(result.breakdown[0].quantity).toBe(70)
    })

    test('should handle large quantities and precise decimal calculations', () => {
      const movements: StockMovementData[] = [
        {
          id: 1,
          quantity: 1000000,
          unitCostAtTime: 7.123456,
          movementDate: new Date('2024-01-01'),
          movementType: 'PRINT_RECEIVED',
          warehouseId: warehouse1.id,
          titleId: title.id
        }
      ]

      const result = InventoryValuationService.calculateWeightedAverage(movements, 500000)

      expect(result.unitCost).toBeCloseTo(7.12, 1) // Should be close to 7.12
      expect(result.totalValue).toBeCloseTo(3560000.00, -4) // 500000 * 7.12, allow for floating point differences
    })
  })
})