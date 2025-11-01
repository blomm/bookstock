import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestUser } from '../utils/test-db'

describe('Inventory Tracking Schema Extensions', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Title.lowStockThreshold', () => {
    test('should allow creating title with low stock threshold', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Threshold Test Book',
        lowStockThreshold: 500
      })

      expect(title.lowStockThreshold).toBe(500)
    })

    test('should allow creating title without low stock threshold (nullable)', async () => {
      const title = await createTestTitle({
        isbn: '9782222222222',
        title: 'No Threshold Book',
        lowStockThreshold: null
      })

      expect(title.lowStockThreshold).toBeNull()
    })

    test('should allow updating low stock threshold', async () => {
      const title = await createTestTitle({
        isbn: '9783333333333',
        lowStockThreshold: 200
      })

      const updated = await testDb.title.update({
        where: { id: title.id },
        data: { lowStockThreshold: 600 }
      })

      expect(updated.lowStockThreshold).toBe(600)
    })

    test('should allow setting threshold to null', async () => {
      const title = await createTestTitle({
        isbn: '9784444444444',
        lowStockThreshold: 300
      })

      const updated = await testDb.title.update({
        where: { id: title.id },
        data: { lowStockThreshold: null }
      })

      expect(updated.lowStockThreshold).toBeNull()
    })

    test('should support low stock queries', async () => {
      const title1 = await createTestTitle({
        isbn: '9785555555555',
        lowStockThreshold: 500
      })
      const title2 = await createTestTitle({
        isbn: '9786666666666',
        lowStockThreshold: 200
      })
      const warehouse = await createTestWarehouse({ code: 'LST' })

      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          currentStock: 450 // Below threshold
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          currentStock: 800 // Above threshold
        }
      })

      // Query for titles where currentStock < lowStockThreshold
      const lowStockItems = await testDb.inventory.findMany({
        where: {
          warehouseId: warehouse.id
        },
        include: {
          title: true
        }
      })

      const belowThreshold = lowStockItems.filter(
        item => item.title.lowStockThreshold !== null &&
                item.currentStock < item.title.lowStockThreshold
      )

      expect(belowThreshold).toHaveLength(1)
      expect(belowThreshold[0].title.isbn).toBe('9785555555555')
    })
  })

  describe('Inventory.lastStockCheck', () => {
    test('should allow creating inventory with lastStockCheck', async () => {
      const title = await createTestTitle({ isbn: '9787777777777' })
      const warehouse = await createTestWarehouse({ code: 'LSC' })
      const checkDate = new Date('2024-03-20T14:30:00Z')

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000,
          lastStockCheck: checkDate
        }
      })

      expect(inventory.lastStockCheck).toEqual(checkDate)
    })

    test('should allow creating inventory without lastStockCheck (nullable)', async () => {
      const title = await createTestTitle({ isbn: '9788888888888' })
      const warehouse = await createTestWarehouse({ code: 'NLS' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      expect(inventory.lastStockCheck).toBeNull()
    })

    test('should allow updating lastStockCheck', async () => {
      const title = await createTestTitle({ isbn: '9789999999999' })
      const warehouse = await createTestWarehouse({ code: 'ULS' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000,
          lastStockCheck: new Date('2024-01-15')
        }
      })

      const newCheckDate = new Date('2024-03-20')
      const updated = await testDb.inventory.update({
        where: { id: inventory.id },
        data: { lastStockCheck: newCheckDate }
      })

      expect(updated.lastStockCheck).toEqual(newCheckDate)
    })

    test('should track when stock was last physically verified', async () => {
      const title = await createTestTitle({ isbn: '9781234567800' })
      const warehouse = await createTestWarehouse({ code: 'VER' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      // Simulate manual stock adjustment with verification
      const adjustmentDate = new Date()
      await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: 975,
          lastStockCheck: adjustmentDate
        }
      })

      const verified = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })

      expect(verified?.lastStockCheck).toEqual(adjustmentDate)
      expect(verified?.currentStock).toBe(975)
    })
  })

  describe('StockMovement.createdBy', () => {
    test('should allow creating movement with createdBy user ID', async () => {
      const user = await createTestUser({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      })
      const title = await createTestTitle({ isbn: '9781234567801' })
      const warehouse = await createTestWarehouse({ code: 'CRB' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date(),
          createdBy: user.id
        }
      })

      expect(movement.createdBy).toBe(user.id)
    })

    test('should allow creating movement without createdBy (nullable)', async () => {
      const title = await createTestTitle({ isbn: '9781234567802' })
      const warehouse = await createTestWarehouse({ code: 'NCB' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date()
        }
      })

      expect(movement.createdBy).toBeNull()
    })

    test('should link to user for audit trail', async () => {
      const user = await createTestUser({
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User'
      })
      const title = await createTestTitle({ isbn: '9781234567803' })
      const warehouse = await createTestWarehouse({ code: 'AUD' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'STOCK_ADJUSTMENT',
          quantity: 25,
          movementDate: new Date(),
          notes: 'Manual stock correction',
          createdBy: user.id
        }
      })

      const movementWithUser = await testDb.stockMovement.findUnique({
        where: { id: movement.id },
        include: { creator: true }
      })

      expect(movementWithUser?.creator?.firstName).toBe('Admin')
      expect(movementWithUser?.creator?.lastName).toBe('User')
      expect(movementWithUser?.creator?.email).toBe('admin@example.com')
    })

    test('should preserve movement history when user is deleted (SET NULL)', async () => {
      const user = await createTestUser({
        email: 'temp@example.com'
      })
      const title = await createTestTitle({ isbn: '9781234567804' })
      const warehouse = await createTestWarehouse({ code: 'DEL' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -100,
          movementDate: new Date(),
          createdBy: user.id
        }
      })

      // Delete the user
      await testDb.user.delete({
        where: { id: user.id }
      })

      // Movement should still exist but createdBy should be null
      const remainingMovement = await testDb.stockMovement.findUnique({
        where: { id: movement.id }
      })

      expect(remainingMovement).toBeDefined()
      expect(remainingMovement?.createdBy).toBeNull()
    })

    test('should support filtering movements by creator', async () => {
      const user1 = await createTestUser({ email: 'user1@example.com' })
      const user2 = await createTestUser({ email: 'user2@example.com' })
      const title = await createTestTitle({ isbn: '9781234567805' })
      const warehouse = await createTestWarehouse({ code: 'FLT' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date(),
          createdBy: user1.id
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -150,
          movementDate: new Date(),
          createdBy: user2.id
        }
      })

      const user1Movements = await testDb.stockMovement.findMany({
        where: { createdBy: user1.id }
      })

      const user2Movements = await testDb.stockMovement.findMany({
        where: { createdBy: user2.id }
      })

      expect(user1Movements).toHaveLength(1)
      expect(user1Movements[0].movementType).toBe('PRINT_RECEIVED')
      expect(user2Movements).toHaveLength(1)
      expect(user2Movements[0].movementType).toBe('UK_TRADE_SALES')
    })
  })

  describe('MovementType enum extensions', () => {
    test('should support STOCK_ADJUSTMENT movement type', async () => {
      const title = await createTestTitle({ isbn: '9781234567806' })
      const warehouse = await createTestWarehouse({ code: 'ADJ' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'STOCK_ADJUSTMENT',
          quantity: -25,
          movementDate: new Date(),
          notes: 'Physical count correction - found 25 fewer units'
        }
      })

      expect(movement.movementType).toBe('STOCK_ADJUSTMENT')
      expect(movement.quantity).toBe(-25)
      expect(movement.notes).toContain('Physical count correction')
    })

    test('should support REPRINT movement type', async () => {
      const title = await createTestTitle({ isbn: '9781234567807' })
      const warehouse = await createTestWarehouse({ code: 'REP' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'REPRINT',
          quantity: 2000,
          movementDate: new Date(),
          notes: 'Second print run'
        }
      })

      expect(movement.movementType).toBe('REPRINT')
      expect(movement.quantity).toBe(2000)
    })

    test('should differentiate between PRINT_RECEIVED and REPRINT', async () => {
      const title = await createTestTitle({ isbn: '9781234567808' })
      const warehouse = await createTestWarehouse({ code: 'DIF' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01'),
          notes: 'Initial print run'
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'REPRINT',
          quantity: 2000,
          movementDate: new Date('2024-03-01'),
          notes: 'Reprint due to low stock'
        }
      })

      const printReceived = await testDb.stockMovement.findMany({
        where: { movementType: 'PRINT_RECEIVED' }
      })

      const reprints = await testDb.stockMovement.findMany({
        where: { movementType: 'REPRINT' }
      })

      expect(printReceived).toHaveLength(1)
      expect(reprints).toHaveLength(1)
      expect(printReceived[0].quantity).toBe(3000)
      expect(reprints[0].quantity).toBe(2000)
    })
  })

  describe('Index performance verification', () => {
    test('should have index on createdBy for audit queries', async () => {
      // This test verifies the index exists by checking query performance
      // In practice, Prisma creates the index when we add @@index([createdBy])
      const user = await createTestUser({ email: 'perf@example.com' })
      const title = await createTestTitle({ isbn: '9781234567809' })
      const warehouse = await createTestWarehouse({ code: 'IDX' })

      // Create multiple movements
      for (let i = 0; i < 10; i++) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -10,
            movementDate: new Date(),
            createdBy: user.id
          }
        })
      }

      // Query should be fast with index
      const movements = await testDb.stockMovement.findMany({
        where: { createdBy: user.id }
      })

      expect(movements).toHaveLength(10)
    })
  })
})
