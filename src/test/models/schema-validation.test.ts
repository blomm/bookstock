import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestSeries, createTestPrinter } from '../utils/test-db'

describe('Prisma Schema Validation', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Field Type Validation', () => {
    test('should validate ISBN format constraints', async () => {
      // Valid 13-digit ISBN
      const validTitle = await createTestTitle({ isbn: '9781234567890' })
      expect(validTitle.isbn).toBe('9781234567890')

      // ISBN too short should fail
      await expect(
        createTestTitle({ isbn: '978123456789' }) // 12 digits
      ).rejects.toThrow()

      // ISBN too long should fail
      await expect(
        createTestTitle({ isbn: '97812345678901' }) // 14 digits
      ).rejects.toThrow()
    })

    test('should validate decimal precision for financial fields', async () => {
      const title = await createTestTitle({
        rrp: 999999.99,
        unitCost: 999999.99,
        tradeDiscount: 999.99,
        royaltyRate: 999.99
      })

      expect(title.rrp.toNumber()).toBe(999999.99)
      expect(title.unitCost.toNumber()).toBe(999999.99)
      expect(title.tradeDiscount?.toNumber()).toBe(999.99)
      expect(title.royaltyRate?.toNumber()).toBe(999.99)
    })

    test('should validate string length constraints', async () => {
      // Title field (500 chars max)
      const validTitle = 'A'.repeat(500)
      const title = await createTestTitle({ title: validTitle })
      expect(title.title).toBe(validTitle)

      // Title too long should fail
      const tooLongTitle = 'A'.repeat(501)
      await expect(
        createTestTitle({ title: tooLongTitle })
      ).rejects.toThrow()

      // Author field (255 chars max)
      const validAuthor = 'B'.repeat(255)
      const authorTitle = await createTestTitle({ author: validAuthor, isbn: '9781111111111' })
      expect(authorTitle.author).toBe(validAuthor)

      // Author too long should fail
      const tooLongAuthor = 'B'.repeat(256)
      await expect(
        createTestTitle({ author: tooLongAuthor, isbn: '9782222222222' })
      ).rejects.toThrow()
    })

    test('should validate warehouse code constraints', async () => {
      // Valid warehouse code
      const warehouse = await createTestWarehouse({ code: 'TST123' })
      expect(warehouse.code).toBe('TST123')

      // Code too long should fail (10 chars max)
      await expect(
        createTestWarehouse({ code: 'TOOLONGCODE' }) // 11 chars
      ).rejects.toThrow()
    })

    test('should validate JSON fields for warehouse channels', async () => {
      const warehouse = await createTestWarehouse({
        code: 'JSON1',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES', 'ONLINE_SALES']
      })

      expect(Array.isArray(warehouse.fulfillsChannels)).toBe(true)
      expect(warehouse.fulfillsChannels).toContain('UK_TRADE_SALES')
      expect(warehouse.fulfillsChannels).toHaveLength(3)
    })

    test('should validate printer specialties JSON field', async () => {
      const printer = await createTestPrinter({
        code: 'JSON1',
        specialties: [
          { type: 'Digital', capabilities: ['POD', 'Short Run'] },
          { type: 'Offset', minQuantity: 1000 }
        ]
      })

      expect(Array.isArray(printer.specialties)).toBe(true)
      expect(printer.specialties).toHaveLength(2)
    })
  })

  describe('Enum Validation', () => {
    test('should validate Format enum values', async () => {
      const formats = ['HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK'] as const

      for (const format of formats) {
        const title = await createTestTitle({
          isbn: `978${format.slice(0, 10).padEnd(10, '0')}`,
          format
        })
        expect(title.format).toBe(format)
      }

      // Invalid format should fail
      await expect(
        testDb.title.create({
          data: {
            isbn: '9781111111111',
            title: 'Test Book',
            author: 'Test Author',
            format: 'INVALID_FORMAT' as any,
            rrp: 19.99,
            unitCost: 5.50
          }
        })
      ).rejects.toThrow()
    })

    test('should validate MovementType enum values', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const warehouse = await createTestWarehouse({ code: 'TST1' })

      const validMovementTypes = [
        'PRINT_RECEIVED',
        'WAREHOUSE_TRANSFER',
        'ONLINE_SALES',
        'UK_TRADE_SALES',
        'US_TRADE_SALES',
        'ROW_TRADE_SALES',
        'DIRECT_SALES',
        'PULPED',
        'DAMAGED',
        'FREE_COPIES'
      ] as const

      for (const movementType of validMovementTypes) {
        const movement = await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType,
            quantity: movementType.includes('SALES') || movementType === 'PULPED' || movementType === 'DAMAGED' ? -10 : 10,
            movementDate: new Date()
          }
        })
        expect(movement.movementType).toBe(movementType)
      }

      // Invalid movement type should fail
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'INVALID_TYPE' as any,
            quantity: 10,
            movementDate: new Date()
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Index Performance', () => {
    test('should efficiently query by indexed fields', async () => {
      // Create multiple titles to test index performance
      const titles = []
      for (let i = 0; i < 10; i++) {
        titles.push(await createTestTitle({
          isbn: `97812345678${i.toString().padStart(2, '0')}`,
          title: `Test Book ${i}`,
          author: `Author ${i}`,
          category: i % 2 === 0 ? 'Fiction' : 'Non-Fiction',
          publisher: i % 3 === 0 ? 'Publisher A' : 'Publisher B'
        }))
      }

      // Test ISBN index (unique)
      const startTime = Date.now()
      const titleByISBN = await testDb.title.findUnique({
        where: { isbn: '9781234567805' }
      })
      const isbnQueryTime = Date.now() - startTime

      expect(titleByISBN?.title).toBe('Test Book 5')
      expect(isbnQueryTime).toBeLessThan(100) // Should be very fast with index

      // Test category index
      const fictionTitles = await testDb.title.findMany({
        where: { category: 'Fiction' }
      })
      expect(fictionTitles).toHaveLength(5) // Every even number (0,2,4,6,8)

      // Test compound filtering
      const publisherATitles = await testDb.title.findMany({
        where: {
          publisher: 'Publisher A',
          category: 'Fiction'
        }
      })
      expect(publisherATitles.length).toBeGreaterThan(0)
    })

    test('should efficiently query warehouse inventory with indexes', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const warehouses = []

      // Create multiple warehouses
      for (let i = 0; i < 5; i++) {
        warehouses.push(await createTestWarehouse({
          code: `WH${i}`,
          name: `Warehouse ${i}`,
          location: i % 2 === 0 ? 'UK' : 'US',
          isActive: i < 4 // Last one inactive
        }))
      }

      // Create inventory records
      for (const warehouse of warehouses) {
        await testDb.inventory.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            currentStock: 100 + warehouse.id * 50,
            reservedStock: 10
          }
        })
      }

      // Test warehouse code index
      const warehouseByCode = await testDb.warehouse.findUnique({
        where: { code: 'WH2' }
      })
      expect(warehouseByCode?.name).toBe('Warehouse 2')

      // Test active warehouse filtering
      const activeWarehouses = await testDb.warehouse.findMany({
        where: { isActive: true }
      })
      expect(activeWarehouses).toHaveLength(4)

      // Test inventory by title (should use titleId index)
      const titleInventory = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })
      expect(titleInventory).toHaveLength(5)
    })
  })

  describe('Data Type Edge Cases', () => {
    test('should handle null values correctly', async () => {
      const title = await createTestTitle({
        isbn: '9781234567890',
        pageCount: null,
        publicationDate: null,
        publisher: null,
        category: null,
        seriesId: null
      })

      expect(title.pageCount).toBeNull()
      expect(title.publicationDate).toBeNull()
      expect(title.publisher).toBeNull()
      expect(title.category).toBeNull()
      expect(title.seriesId).toBeNull()
    })

    test('should handle boolean defaults', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'BOOL1',
          location: 'UK',
          fulfillsChannels: ['ONLINE_SALES']
          // isActive not specified - should default to true
        }
      })

      expect(warehouse.isActive).toBe(true)

      const printer = await testDb.printer.create({
        data: {
          name: 'Test Printer'
          // isActive not specified - should default to true
        }
      })

      expect(printer.isActive).toBe(true)
    })

    test('should handle date precision correctly', async () => {
      const specificDate = new Date('2024-03-15T14:30:45.123Z')

      const title = await createTestTitle({
        isbn: '9781234567890',
        publicationDate: specificDate
      })

      expect(title.publicationDate?.getTime()).toBe(specificDate.getTime())

      // Test created/updated timestamps
      expect(title.createdAt).toBeInstanceOf(Date)
      expect(title.updatedAt).toBeInstanceOf(Date)
      expect(title.updatedAt.getTime()).toBeGreaterThanOrEqual(title.createdAt.getTime())
    })

    test('should handle large text fields', async () => {
      const longDescription = 'A'.repeat(10000) // 10k characters
      const longNotes = 'B'.repeat(5000) // 5k characters

      const title = await createTestTitle({
        isbn: '9781234567890',
        description: longDescription,
        keywords: 'test, long, description, keywords'
      })

      const printer = await createTestPrinter({
        code: 'LONG1',
        notes: longNotes
      })

      expect(title.description).toBe(longDescription)
      expect(printer.notes).toBe(longNotes)
    })
  })

  describe('Database Constraints Edge Cases', () => {
    test('should handle concurrent unique constraint violations', async () => {
      // This would typically be tested with actual concurrent operations
      // but we'll simulate the constraint check
      const isbn = '9781234567890'

      await createTestTitle({ isbn })

      // Attempting to create another title with same ISBN should fail
      await expect(
        createTestTitle({ isbn })
      ).rejects.toThrow()
    })

    test('should handle foreign key constraint edge cases', async () => {
      // Try to create inventory with non-existent title
      await expect(
        testDb.inventory.create({
          data: {
            titleId: 99999, // Non-existent
            warehouseId: 1,
            currentStock: 100,
            reservedStock: 0
          }
        })
      ).rejects.toThrow()

      // Try to create stock movement with non-existent warehouse
      const title = await createTestTitle({ isbn: '9781234567890' })
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: 99999, // Non-existent
            movementType: 'PRINT_RECEIVED',
            quantity: 100,
            movementDate: new Date()
          }
        })
      ).rejects.toThrow()
    })

    test('should validate numeric ranges', async () => {
      // Test integer limits
      const title = await createTestTitle({
        isbn: '9781234567890',
        pageCount: 2147483647, // Max int32
        weight: 2147483647
      })

      expect(title.pageCount).toBe(2147483647)
      expect(title.weight).toBe(2147483647)

      // Test decimal precision
      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: (await createTestWarehouse({ code: 'NUM1' })).id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          rrpAtTime: 99999999.99, // Max for Decimal(8,2)
          unitCostAtTime: 99999999.99
        }
      })

      expect(movement.rrpAtTime?.toNumber()).toBe(99999999.99)
    })
  })
})