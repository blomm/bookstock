import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestSeries } from '../utils/test-db'
import { Decimal } from '@prisma/client/runtime/library'

describe('Title Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create title with required fields only', async () => {
      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      expect(title).toMatchObject({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK'
      })
      expect(title.rrp).toEqual(new Decimal('19.99'))
      expect(title.unitCost).toEqual(new Decimal('5.50'))
      expect(title.id).toBeDefined()
      expect(title.createdAt).toBeInstanceOf(Date)
      expect(title.updatedAt).toBeInstanceOf(Date)
    })

    test('should create title with all publishing metadata', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Complete Book',
        author: 'Full Author',
        format: 'HARDCOVER',
        rrp: 29.99,
        unitCost: 8.75,
        pageCount: 350,
        publicationDate: new Date('2024-01-15'),
        publisher: 'Test Publishing House',
        category: 'Fiction',
        subcategory: 'Science Fiction',
        dimensions: '234x156x24',
        weight: 580,
        bindingType: 'Perfect bound',
        coverFinish: 'Matte',
        tradeDiscount: 40.0,
        royaltyRate: 15.0,
        royaltyThreshold: 2000,
        printRunSize: 5000,
        reprintThreshold: 1000,
        description: 'A comprehensive test book with all metadata fields',
        keywords: 'test, book, metadata, comprehensive',
        language: 'en',
        territoryRights: 'World'
      })

      expect(title.pageCount).toBe(350)
      expect(title.publicationDate).toEqual(new Date('2024-01-15'))
      expect(title.publisher).toBe('Test Publishing House')
      expect(title.category).toBe('Fiction')
      expect(title.subcategory).toBe('Science Fiction')
      expect(title.dimensions).toBe('234x156x24')
      expect(title.weight).toBe(580)
      expect(title.bindingType).toBe('Perfect bound')
      expect(title.coverFinish).toBe('Matte')
      expect(title.tradeDiscount).toEqual(new Decimal('40.0'))
      expect(title.royaltyRate).toEqual(new Decimal('15.0'))
      expect(title.royaltyThreshold).toBe(2000)
      expect(title.printRunSize).toBe(5000)
      expect(title.reprintThreshold).toBe(1000)
      expect(title.description).toBe('A comprehensive test book with all metadata fields')
      expect(title.keywords).toBe('test, book, metadata, comprehensive')
      expect(title.language).toBe('en')
      expect(title.territoryRights).toBe('World')
    })

    test('should enforce unique ISBN constraint', async () => {
      await createTestTitle({ isbn: '9781234567890' })

      await expect(
        createTestTitle({ isbn: '9781234567890' })
      ).rejects.toThrow()
    })

    test('should support all book formats', async () => {
      const formats = ['HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK'] as const

      for (const format of formats) {
        const title = await createTestTitle({
          isbn: `978${format.slice(0, 10).padEnd(10, '0')}`,
          format
        })
        expect(title.format).toBe(format)
      }
    })
  })

  describe('Validation', () => {
    test('should require essential publishing fields', async () => {
      // Missing ISBN
      await expect(
        testDb.title.create({
          data: {
            title: 'No ISBN Book',
            author: 'Test Author',
            format: 'PAPERBACK',
            rrp: 19.99,
            unitCost: 5.50
          } as any
        })
      ).rejects.toThrow()

      // Missing title
      await expect(
        testDb.title.create({
          data: {
            isbn: '9781111111111',
            author: 'Test Author',
            format: 'PAPERBACK',
            rrp: 19.99,
            unitCost: 5.50
          } as any
        })
      ).rejects.toThrow()

      // Missing author
      await expect(
        testDb.title.create({
          data: {
            isbn: '9781111111111',
            title: 'No Author Book',
            format: 'PAPERBACK',
            rrp: 19.99,
            unitCost: 5.50
          } as any
        })
      ).rejects.toThrow()
    })

    test('should enforce field length constraints', async () => {
      // ISBN too long
      await expect(
        createTestTitle({ isbn: '97812345678901' })
      ).rejects.toThrow()

      // Title too long (500 char limit)
      const longTitle = 'a'.repeat(501)
      await expect(
        createTestTitle({ title: longTitle })
      ).rejects.toThrow()

      // Author too long (255 char limit)
      const longAuthor = 'a'.repeat(256)
      await expect(
        createTestTitle({ author: longAuthor })
      ).rejects.toThrow()
    })

    test('should validate decimal precision for financial fields', async () => {
      const title = await createTestTitle({
        rrp: 999999.99,
        unitCost: 999999.99,
        tradeDiscount: 999.99,
        royaltyRate: 999.99
      })

      expect(title.rrp).toEqual(new Decimal('999999.99'))
      expect(title.unitCost).toEqual(new Decimal('999999.99'))
      expect(title.tradeDiscount).toEqual(new Decimal('999.99'))
      expect(title.royaltyRate).toEqual(new Decimal('999.99'))
    })

    test('should handle optional metadata fields', async () => {
      const title = await createTestTitle({
        pageCount: null,
        publicationDate: null,
        publisher: null,
        category: null,
        subcategory: null,
        dimensions: null,
        weight: null,
        bindingType: null,
        coverFinish: null,
        tradeDiscount: null,
        royaltyRate: null,
        royaltyThreshold: null,
        printRunSize: null,
        reprintThreshold: null,
        description: null,
        keywords: null,
        language: null,
        territoryRights: null
      })

      expect(title.pageCount).toBeNull()
      expect(title.publicationDate).toBeNull()
      expect(title.publisher).toBeNull()
      expect(title.category).toBeNull()
    })
  })

  describe('Relationships', () => {
    test('should link title to series', async () => {
      const series = await createTestSeries({ name: 'Test Series' })
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Series Book',
        seriesId: series.id
      })

      const titleWithSeries = await testDb.title.findUnique({
        where: { id: title.id },
        include: { series: true }
      })

      expect(titleWithSeries?.series?.name).toBe('Test Series')
    })

    test('should allow title without series', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Standalone Book',
        seriesId: null
      })

      expect(title.seriesId).toBeNull()
    })

    test('should handle series deletion impact', async () => {
      const series = await createTestSeries({ name: 'Deletable Series' })
      await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id
      })

      // Should fail due to foreign key constraint
      await expect(
        testDb.series.delete({ where: { id: series.id } })
      ).rejects.toThrow()
    })
  })

  describe('Queries', () => {
    test('should find title by ISBN', async () => {
      await createTestTitle({
        isbn: '9781234567890',
        title: 'Findable Book'
      })

      const found = await testDb.title.findUnique({
        where: { isbn: '9781234567890' }
      })

      expect(found?.title).toBe('Findable Book')
    })

    test('should search titles by various fields', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Search Test Book',
        author: 'Search Author',
        category: 'Fiction',
        publisher: 'Search Publisher'
      })

      // Search by title
      const byTitle = await testDb.title.findMany({
        where: { title: { contains: 'Search Test' } }
      })
      expect(byTitle).toHaveLength(1)

      // Search by author
      const byAuthor = await testDb.title.findMany({
        where: { author: { contains: 'Search Author' } }
      })
      expect(byAuthor).toHaveLength(1)

      // Search by category
      const byCategory = await testDb.title.findMany({
        where: { category: 'Fiction' }
      })
      expect(byCategory).toHaveLength(1)

      // Search by publisher
      const byPublisher = await testDb.title.findMany({
        where: { publisher: 'Search Publisher' }
      })
      expect(byPublisher).toHaveLength(1)
    })

    test('should filter by format', async () => {
      await createTestTitle({ isbn: '9781111111111', format: 'HARDCOVER' })
      await createTestTitle({ isbn: '9782222222222', format: 'PAPERBACK' })
      await createTestTitle({ isbn: '9783333333333', format: 'DIGITAL' })

      const hardcovers = await testDb.title.findMany({
        where: { format: 'HARDCOVER' }
      })

      expect(hardcovers).toHaveLength(1)
      expect(hardcovers[0].format).toBe('HARDCOVER')
    })

    test('should filter by publication date range', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        publicationDate: new Date('2023-01-01')
      })
      await createTestTitle({
        isbn: '9782222222222',
        publicationDate: new Date('2024-06-01')
      })

      const recent = await testDb.title.findMany({
        where: {
          publicationDate: {
            gte: new Date('2024-01-01')
          }
        }
      })

      expect(recent).toHaveLength(1)
    })

    test('should order titles by various fields', async () => {
      await createTestTitle({ isbn: '9781111111111', title: 'Zebra Book' })
      await createTestTitle({ isbn: '9782222222222', title: 'Alpha Book' })

      const byTitle = await testDb.title.findMany({
        orderBy: { title: 'asc' }
      })

      expect(byTitle.map(t => t.title)).toEqual(['Alpha Book', 'Zebra Book'])
    })
  })

  describe('Updates', () => {
    test('should update publishing metadata', async () => {
      const title = await createTestTitle({
        rrp: 19.99,
        unitCost: 5.50,
        pageCount: 200
      })

      const updated = await testDb.title.update({
        where: { id: title.id },
        data: {
          rrp: 24.99,
          unitCost: 6.75,
          pageCount: 250,
          category: 'Updated Category'
        }
      })

      expect(updated.rrp).toEqual(new Decimal('24.99'))
      expect(updated.unitCost).toEqual(new Decimal('6.75'))
      expect(updated.pageCount).toBe(250)
      expect(updated.category).toBe('Updated Category')
      expect(updated.updatedAt.getTime()).toBeGreaterThan(title.updatedAt.getTime())
    })

    test('should update commercial fields', async () => {
      const title = await createTestTitle({
        tradeDiscount: 35.0,
        royaltyRate: 12.0,
        royaltyThreshold: 1500
      })

      const updated = await testDb.title.update({
        where: { id: title.id },
        data: {
          tradeDiscount: 40.0,
          royaltyRate: 15.0,
          royaltyThreshold: 2000,
          printRunSize: 5000,
          reprintThreshold: 1200
        }
      })

      expect(updated.tradeDiscount).toEqual(new Decimal('40.0'))
      expect(updated.royaltyRate).toEqual(new Decimal('15.0'))
      expect(updated.royaltyThreshold).toBe(2000)
      expect(updated.printRunSize).toBe(5000)
      expect(updated.reprintThreshold).toBe(1200)
    })
  })

  describe('Deletion', () => {
    test('should delete title without relationships', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })

      await testDb.title.delete({
        where: { id: title.id }
      })

      const found = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(found).toBeNull()
    })
  })

  describe('Business Logic Validation', () => {
    test('should handle realistic publishing data', async () => {
      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'The Art of Programming',
        author: 'Jane Developer',
        format: 'PAPERBACK',
        rrp: 34.99,
        unitCost: 8.75, // 25% of RRP
        pageCount: 456,
        publicationDate: new Date('2024-03-15'),
        publisher: 'Tech Books Ltd',
        category: 'Technology',
        subcategory: 'Programming',
        dimensions: '234x156x28',
        weight: 650,
        bindingType: 'Perfect bound',
        coverFinish: 'Matte',
        tradeDiscount: 45.0, // Standard trade discount
        royaltyRate: 12.5, // Author royalty rate
        royaltyThreshold: 2000, // Royalties start after 2000 sales
        printRunSize: 3000,
        reprintThreshold: 600,
        language: 'en-GB',
        territoryRights: 'UK, Ireland, Europe'
      })

      // Verify profit margin calculation would be:
      // (RRP / 2) - unit_cost = (34.99 / 2) - 8.75 = 17.495 - 8.75 = 8.745
      const expectedWholesalePrice = title.rrp.toNumber() / 2
      const expectedProfitMargin = expectedWholesalePrice - title.unitCost.toNumber()

      expect(expectedProfitMargin).toBeCloseTo(8.745, 2)
      expect(title.royaltyRate?.toNumber()).toBe(12.5)
      expect(title.tradeDiscount?.toNumber()).toBe(45.0)
    })
  })
})