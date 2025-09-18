import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestPriceHistory } from '../utils/test-db'
import { Decimal } from '@prisma/client/runtime/library'

describe('PriceHistory Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create price history record with all fields', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        unitCost: 8.75,
        tradeDiscount: 45.0,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-06-01'),
        reason: 'Launch price'
      })

      expect(priceHistory.titleId).toBe(title.id)
      expect(priceHistory.rrp).toEqual(new Decimal('29.99'))
      expect(priceHistory.unitCost).toEqual(new Decimal('8.75'))
      expect(priceHistory.tradeDiscount).toEqual(new Decimal('45.0'))
      expect(priceHistory.effectiveFrom).toEqual(new Date('2024-01-01'))
      expect(priceHistory.effectiveTo).toEqual(new Date('2024-06-01'))
      expect(priceHistory.reason).toBe('Launch price')
      expect(priceHistory.id).toBeDefined()
      expect(priceHistory.createdAt).toBeInstanceOf(Date)
      expect(priceHistory.updatedAt).toBeInstanceOf(Date)
    })

    test('should create current price with null effectiveTo', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 34.99,
        effectiveFrom: new Date('2024-06-01'),
        effectiveTo: null,
        reason: 'Current price after increase'
      })

      expect(priceHistory.effectiveTo).toBeNull()
      expect(priceHistory.rrp).toEqual(new Decimal('34.99'))
    })

    test('should enforce unique constraint on titleId and effectiveFrom', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const effectiveDate = new Date('2024-01-01')

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: effectiveDate
      })

      await expect(
        createTestPriceHistory({
          titleId: title.id,
          rrp: 34.99,
          effectiveFrom: effectiveDate
        })
      ).rejects.toThrow()
    })

    test('should require titleId and rrp fields', async () => {
      // Missing titleId
      await expect(
        testDb.priceHistory.create({
          data: {
            rrp: 29.99,
            effectiveFrom: new Date('2024-01-01')
          } as any
        })
      ).rejects.toThrow()

      // Missing rrp
      const title = await createTestTitle({ isbn: '9781234567890' })
      await expect(
        testDb.priceHistory.create({
          data: {
            titleId: title.id,
            effectiveFrom: new Date('2024-01-01')
          } as any
        })
      ).rejects.toThrow()
    })
  })

  describe('Relationships', () => {
    test('should link to title correctly', async () => {
      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book with Price History'
      })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-01-01')
      })

      const priceWithTitle = await testDb.priceHistory.findUnique({
        where: { id: priceHistory.id },
        include: { title: true }
      })

      expect(priceWithTitle?.title.title).toBe('Test Book with Price History')
      expect(priceWithTitle?.title.isbn).toBe('9781234567890')
    })

    test('should cascade delete when title is deleted', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-01-01')
      })

      await testDb.title.delete({ where: { id: title.id } })

      const remainingPriceHistory = await testDb.priceHistory.findUnique({
        where: { id: priceHistory.id }
      })

      expect(remainingPriceHistory).toBeNull()
    })
  })

  describe('Price History Queries', () => {
    test('should find current price for title', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      // Create historical prices
      await createTestPriceHistory({
        titleId: title.id,
        rrp: 25.99,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-03-01'),
        reason: 'Initial price'
      })

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-03-01'),
        effectiveTo: new Date('2024-06-01'),
        reason: 'First increase'
      })

      // Current price
      await createTestPriceHistory({
        titleId: title.id,
        rrp: 34.99,
        effectiveFrom: new Date('2024-06-01'),
        effectiveTo: null,
        reason: 'Current price'
      })

      const currentPrice = await testDb.priceHistory.findFirst({
        where: {
          titleId: title.id,
          effectiveTo: null
        }
      })

      expect(currentPrice?.rrp).toEqual(new Decimal('34.99'))
      expect(currentPrice?.reason).toBe('Current price')
    })

    test('should find price effective at specific date', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 25.99,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-03-01')
      })

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-03-01'),
        effectiveTo: new Date('2024-06-01')
      })

      const priceAtDate = await testDb.priceHistory.findFirst({
        where: {
          titleId: title.id,
          effectiveFrom: { lte: new Date('2024-04-15') },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: new Date('2024-04-15') } }
          ]
        },
        orderBy: { effectiveFrom: 'desc' }
      })

      expect(priceAtDate?.rrp).toEqual(new Decimal('29.99'))
    })

    test('should order price history chronologically', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 34.99,
        effectiveFrom: new Date('2024-06-01'),
        effectiveTo: null
      })

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 25.99,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-03-01')
      })

      await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-03-01'),
        effectiveTo: new Date('2024-06-01')
      })

      const priceHistory = await testDb.priceHistory.findMany({
        where: { titleId: title.id },
        orderBy: { effectiveFrom: 'asc' }
      })

      expect(priceHistory).toHaveLength(3)
      expect(priceHistory[0].rrp).toEqual(new Decimal('25.99'))
      expect(priceHistory[1].rrp).toEqual(new Decimal('29.99'))
      expect(priceHistory[2].rrp).toEqual(new Decimal('34.99'))
    })
  })

  describe('Business Logic Validation', () => {
    test('should track realistic price changes over time', async () => {
      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Programming Guide',
        rrp: 34.99,  // Current price in title record
        unitCost: 8.75
      })

      // Launch price
      const launchPrice = await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        unitCost: 8.75,
        tradeDiscount: 45.0,
        effectiveFrom: new Date('2024-01-15'),
        effectiveTo: new Date('2024-05-01'),
        reason: 'Launch pricing strategy'
      })

      // Current price after market validation
      const currentPrice = await createTestPriceHistory({
        titleId: title.id,
        rrp: 34.99,
        unitCost: 8.75,
        tradeDiscount: 45.0,
        effectiveFrom: new Date('2024-05-01'),
        effectiveTo: null,
        reason: 'Price increase due to strong demand and market positioning'
      })

      // Verify profit margins at different price points
      const launchMargin = (launchPrice.rrp.toNumber() - launchPrice.unitCost!.toNumber()) / launchPrice.rrp.toNumber()
      const currentMargin = (currentPrice.rrp.toNumber() - currentPrice.unitCost!.toNumber()) / currentPrice.rrp.toNumber()

      expect(launchMargin).toBeCloseTo(0.708, 2) // ~70.8%
      expect(currentMargin).toBeCloseTo(0.750, 2) // ~75.0%
      expect(currentMargin).toBeGreaterThan(launchMargin)
    })

    test('should handle seasonal pricing adjustments', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      // Regular price
      await createTestPriceHistory({
        titleId: title.id,
        rrp: 24.99,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-11-15'),
        reason: 'Standard retail price'
      })

      // Holiday discount period
      await createTestPriceHistory({
        titleId: title.id,
        rrp: 19.99,
        effectiveFrom: new Date('2024-11-15'),
        effectiveTo: new Date('2025-01-15'),
        reason: 'Holiday promotion pricing'
      })

      // Back to regular price
      await createTestPriceHistory({
        titleId: title.id,
        rrp: 24.99,
        effectiveFrom: new Date('2025-01-15'),
        effectiveTo: null,
        reason: 'Return to standard pricing post-holidays'
      })

      const holidayPrice = await testDb.priceHistory.findFirst({
        where: {
          titleId: title.id,
          effectiveFrom: { lte: new Date('2024-12-01') },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: new Date('2024-12-01') } }
          ]
        },
        orderBy: { effectiveFrom: 'desc' }
      })

      expect(holidayPrice?.rrp).toEqual(new Decimal('19.99'))
      expect(holidayPrice?.reason).toContain('Holiday promotion')
    })

    test('should validate decimal precision for financial fields', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 999999.99,
        unitCost: 999999.99,
        tradeDiscount: 999.99,
        effectiveFrom: new Date('2024-01-01')
      })

      expect(priceHistory.rrp).toEqual(new Decimal('999999.99'))
      expect(priceHistory.unitCost).toEqual(new Decimal('999999.99'))
      expect(priceHistory.tradeDiscount).toEqual(new Decimal('999.99'))
    })
  })

  describe('Updates and Corrections', () => {
    test('should update price history reason', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-01-01'),
        reason: 'Initial reason'
      })

      const updated = await testDb.priceHistory.update({
        where: { id: priceHistory.id },
        data: {
          reason: 'Updated reason with more detail'
        }
      })

      expect(updated.reason).toBe('Updated reason with more detail')
      expect(updated.updatedAt.getTime()).toBeGreaterThan(priceHistory.updatedAt.getTime())
    })

    test('should close price period by setting effectiveTo', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const priceHistory = await createTestPriceHistory({
        titleId: title.id,
        rrp: 29.99,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        reason: 'Current price'
      })

      const updated = await testDb.priceHistory.update({
        where: { id: priceHistory.id },
        data: {
          effectiveTo: new Date('2024-06-01'),
          reason: 'Superseded by new pricing'
        }
      })

      expect(updated.effectiveTo).toEqual(new Date('2024-06-01'))
      expect(updated.reason).toBe('Superseded by new pricing')
    })
  })
})