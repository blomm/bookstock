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
      expect(title.rrp.toNumber()).toBe(19.99)
      expect(title.unitCost.toNumber()).toBe(5.50)
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
      expect(title.tradeDiscount?.toNumber()).toBe(40.0)
      expect(title.royaltyRate?.toNumber()).toBe(15.0)
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

      expect(title.rrp.toNumber()).toBe(999999.99)
      expect(title.unitCost.toNumber()).toBe(999999.99)
      expect(title.tradeDiscount?.toNumber()).toBe(999.99)
      expect(title.royaltyRate?.toNumber()).toBe(999.99)
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

      expect(updated.rrp.toNumber()).toBe(24.99)
      expect(updated.unitCost.toNumber()).toBe(6.75)
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

      expect(updated.tradeDiscount?.toNumber()).toBe(40.0)
      expect(updated.royaltyRate?.toNumber()).toBe(15.0)
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

  describe('ISBN Format Validation', () => {
    test('should accept valid ISBN-13 format', async () => {
      const validISBNs = [
        '9781234567890',
        '9780123456789',
        '9789876543210'
      ]

      for (const isbn of validISBNs) {
        const title = await createTestTitle({ isbn })
        expect(title.isbn).toBe(isbn)
      }
    })

    test('should accept valid ISBN-10 format', async () => {
      const validISBNs = [
        '0123456789',
        '1234567890',
        '0987654321'
      ]

      for (const isbn of validISBNs) {
        const title = await createTestTitle({ isbn })
        expect(title.isbn).toBe(isbn)
      }
    })

    test('should store ISBN values as provided', async () => {
      // Note: Database-level validation not yet implemented
      // These tests verify current behavior and will be updated when validation is added
      const testISBNs = [
        '9781234567890',  // Valid ISBN-13
        '0123456789',     // Valid ISBN-10
        '978123456789'    // Currently accepted but should be validated in future
      ]

      for (const isbn of testISBNs) {
        const title = await createTestTitle({ isbn })
        expect(title.isbn).toBe(isbn)
      }
    })

    test('should prevent duplicate ISBNs across all titles', async () => {
      const isbn = '9781234567890'
      await createTestTitle({ isbn })

      // Attempt to create another title with same ISBN
      await expect(
        createTestTitle({ isbn })
      ).rejects.toThrow()

      // Verify only one title exists with this ISBN
      const titles = await testDb.title.findMany({
        where: { isbn }
      })
      expect(titles).toHaveLength(1)
    })

    test('should handle ISBN uniqueness case sensitivity', async () => {
      await createTestTitle({ isbn: '9781234567890' })

      // ISBN should be case sensitive (though all should be numeric)
      await expect(
        createTestTitle({ isbn: '9781234567890' })
      ).rejects.toThrow()
    })
  })

  describe('Series Relationship Management', () => {
    test('should create title without series relationship', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Standalone Book',
        seriesId: null
      })

      expect(title.seriesId).toBeNull()

      const titleWithSeries = await testDb.title.findUnique({
        where: { id: title.id },
        include: { series: true }
      })

      expect(titleWithSeries?.series).toBeNull()
    })

    test('should create title with series relationship', async () => {
      const series = await createTestSeries({
        name: 'Programming Guides',
        description: 'Comprehensive programming tutorials'
      })

      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'JavaScript Guide',
        seriesId: series.id
      })

      expect(title.seriesId).toBe(series.id)

      const titleWithSeries = await testDb.title.findUnique({
        where: { id: title.id },
        include: { series: true }
      })

      expect(titleWithSeries?.series?.name).toBe('Programming Guides')
      expect(titleWithSeries?.series?.description).toBe('Comprehensive programming tutorials')
    })

    test('should allow multiple titles in same series', async () => {
      const series = await createTestSeries({ name: 'Tech Series' })

      await createTestTitle({
        isbn: '9781111111111',
        title: 'Book 1',
        seriesId: series.id
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Book 2',
        seriesId: series.id
      })

      const seriesWithTitles = await testDb.series.findUnique({
        where: { id: series.id },
        include: { titles: true }
      })

      expect(seriesWithTitles?.titles).toHaveLength(2)
      expect(seriesWithTitles?.titles.map(t => t.title)).toContain('Book 1')
      expect(seriesWithTitles?.titles.map(t => t.title)).toContain('Book 2')
    })

    test('should prevent deletion of series with linked titles', async () => {
      const series = await createTestSeries({ name: 'Protected Series' })
      await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id
      })

      // Should fail due to foreign key constraint
      await expect(
        testDb.series.delete({ where: { id: series.id } })
      ).rejects.toThrow()
    })

    test('should allow updating title series relationship', async () => {
      const series1 = await createTestSeries({ name: 'Series 1' })
      const series2 = await createTestSeries({ name: 'Series 2' })

      const title = await createTestTitle({
        isbn: '9781111111111',
        seriesId: series1.id
      })

      // Move title to different series
      const updatedTitle = await testDb.title.update({
        where: { id: title.id },
        data: { seriesId: series2.id }
      })

      expect(updatedTitle.seriesId).toBe(series2.id)

      // Verify old series no longer has this title
      const oldSeries = await testDb.series.findUnique({
        where: { id: series1.id },
        include: { titles: true }
      })
      expect(oldSeries?.titles).toHaveLength(0)

      // Verify new series has this title
      const newSeries = await testDb.series.findUnique({
        where: { id: series2.id },
        include: { titles: true }
      })
      expect(newSeries?.titles).toHaveLength(1)
    })

    test('should remove title from series by setting seriesId to null', async () => {
      const series = await createTestSeries({ name: 'Removable Series' })
      const title = await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id
      })

      // Remove from series
      const updatedTitle = await testDb.title.update({
        where: { id: title.id },
        data: { seriesId: null }
      })

      expect(updatedTitle.seriesId).toBeNull()

      // Verify series no longer has this title
      const seriesWithTitles = await testDb.series.findUnique({
        where: { id: series.id },
        include: { titles: true }
      })
      expect(seriesWithTitles?.titles).toHaveLength(0)
    })

    test('should handle non-existent series ID', async () => {
      await expect(
        createTestTitle({
          isbn: '9781111111111',
          seriesId: 99999 // Non-existent series ID
        })
      ).rejects.toThrow()
    })

    test('should query titles by series efficiently', async () => {
      const series = await createTestSeries({ name: 'Query Test Series' })

      // Create multiple titles in series
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Series Book 1',
        seriesId: series.id
      })
      await createTestTitle({
        isbn: '9782222222222',
        title: 'Series Book 2',
        seriesId: series.id
      })

      // Create title outside series
      await createTestTitle({
        isbn: '9783333333333',
        title: 'Standalone Book'
      })

      // Query titles in series
      const seriesTitles = await testDb.title.findMany({
        where: { seriesId: series.id },
        orderBy: { title: 'asc' }
      })

      expect(seriesTitles).toHaveLength(2)
      expect(seriesTitles.map(t => t.title)).toEqual(['Series Book 1', 'Series Book 2'])
    })
  })

  describe('Bulk Import Functionality', () => {
    test('should handle successful bulk title creation', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Bulk Book 1',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          title: 'Bulk Book 2',
          author: 'Author 2',
          format: 'HARDCOVER' as const,
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9783333333333',
          title: 'Bulk Book 3',
          author: 'Author 3',
          format: 'DIGITAL' as const,
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      // Simulate bulk import
      const results = await testDb.$transaction(
        titleData.map(data => testDb.title.create({ data }))
      )

      expect(results).toHaveLength(3)
      expect(results.map(t => t.title)).toEqual([
        'Bulk Book 1',
        'Bulk Book 2',
        'Bulk Book 3'
      ])

      // Verify all titles were created
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(3)
    })

    test('should handle bulk import with series relationships', async () => {
      const series1 = await createTestSeries({ name: 'Bulk Series 1' })
      const series2 = await createTestSeries({ name: 'Bulk Series 2' })

      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Series 1 Book 1',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series1.id
        },
        {
          isbn: '9782222222222',
          title: 'Series 1 Book 2',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series1.id
        },
        {
          isbn: '9783333333333',
          title: 'Series 2 Book 1',
          author: 'Author 2',
          format: 'HARDCOVER' as const,
          rrp: 29.99,
          unitCost: 8.75,
          seriesId: series2.id
        }
      ]

      const results = await testDb.$transaction(
        titleData.map(data => testDb.title.create({ data }))
      )

      expect(results).toHaveLength(3)

      // Verify series relationships
      const series1WithTitles = await testDb.series.findUnique({
        where: { id: series1.id },
        include: { titles: true }
      })
      expect(series1WithTitles?.titles).toHaveLength(2)

      const series2WithTitles = await testDb.series.findUnique({
        where: { id: series2.id },
        include: { titles: true }
      })
      expect(series2WithTitles?.titles).toHaveLength(1)
    })

    test('should rollback entire import on validation error', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Valid Book 1',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          title: 'Valid Book 2',
          author: 'Author 2',
          format: 'HARDCOVER' as const,
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9781111111111', // Duplicate ISBN - should cause rollback
          title: 'Invalid Book',
          author: 'Author 3',
          format: 'DIGITAL' as const,
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      // Transaction should fail and rollback all changes
      await expect(
        testDb.$transaction(
          titleData.map(data => testDb.title.create({ data }))
        )
      ).rejects.toThrow()

      // Verify no titles were created
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(0)
    })

    test('should handle partial import with error reporting', async () => {
      // First create a valid title
      await createTestTitle({ isbn: '9781111111111' })

      const titleData = [
        {
          isbn: '9782222222222',
          title: 'Valid New Book',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9781111111111', // Duplicate ISBN
          title: 'Duplicate ISBN Book',
          author: 'Author 2',
          format: 'HARDCOVER' as const,
          rrp: 29.99,
          unitCost: 8.75
        }
      ]

      // Process each title individually to capture errors
      const results = []
      const errors = []

      for (const data of titleData) {
        try {
          const title = await testDb.title.create({ data })
          results.push(title)
        } catch (error) {
          errors.push({ data, error: (error as Error).message })
        }
      }

      expect(results).toHaveLength(1) // Only one successful
      expect(errors).toHaveLength(1)  // One error
      expect(errors[0].data.isbn).toBe('9781111111111')

      // Verify total titles (1 original + 1 new)
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(2)
    })

    test('should validate required fields during bulk import', async () => {
      const invalidTitleData = [
        {
          // Missing ISBN
          title: 'Missing ISBN Book',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          // Missing title
          author: 'Author 2',
          format: 'HARDCOVER' as const,
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9783333333333',
          title: 'Missing Author Book',
          // Missing author
          format: 'DIGITAL' as const,
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      // Each should fail validation
      for (const data of invalidTitleData) {
        await expect(
          testDb.title.create({ data: data as any })
        ).rejects.toThrow()
      }

      // Verify no titles were created
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(0)
    })

    test('should handle large bulk import efficiently', async () => {
      // Generate larger dataset
      const batchSize = 50
      const titleData = Array.from({ length: batchSize }, (_, i) => ({
        isbn: `978${i.toString().padStart(10, '0')}`,
        title: `Bulk Book ${i + 1}`,
        author: `Author ${i + 1}`,
        format: 'PAPERBACK' as const,
        rrp: 19.99,
        unitCost: 5.50
      }))

      const startTime = Date.now()

      // Use transaction for atomic bulk insert
      const results = await testDb.$transaction(
        titleData.map(data => testDb.title.create({ data }))
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(batchSize)
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds

      // Verify all titles exist
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(batchSize)
    })

    test('should handle bulk import with mixed metadata complexity', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Simple Book',
          author: 'Author 1',
          format: 'PAPERBACK' as const,
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          title: 'Complex Book',
          author: 'Author 2',
          format: 'HARDCOVER' as const,
          rrp: 34.99,
          unitCost: 8.75,
          pageCount: 456,
          publicationDate: new Date('2024-03-15'),
          publisher: 'Complex Publishers',
          category: 'Technology',
          subcategory: 'Programming',
          dimensions: '234x156x28',
          weight: 650,
          bindingType: 'Perfect bound',
          coverFinish: 'Matte',
          tradeDiscount: 45.0,
          royaltyRate: 12.5,
          royaltyThreshold: 2000,
          printRunSize: 3000,
          reprintThreshold: 600,
          description: 'A complex book with all metadata',
          keywords: 'technology, programming, complex',
          language: 'en-GB',
          territoryRights: 'UK, Ireland, Europe'
        }
      ]

      const results = await testDb.$transaction(
        titleData.map(data => testDb.title.create({ data }))
      )

      expect(results).toHaveLength(2)

      // Verify simple book has minimal data
      const simpleBook = results.find(t => t.title === 'Simple Book')
      expect(simpleBook?.pageCount).toBeNull()
      expect(simpleBook?.publisher).toBeNull()

      // Verify complex book has all metadata
      const complexBook = results.find(t => t.title === 'Complex Book')
      expect(complexBook?.pageCount).toBe(456)
      expect(complexBook?.publisher).toBe('Complex Publishers')
      expect(complexBook?.royaltyRate?.toNumber()).toBe(12.5)
    })
  })
})