import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { titleService } from '@/services/titleService'
import { prisma } from '@/lib/database'
import { Format } from '@prisma/client'

/**
 * Integration tests for TitleService
 *
 * These tests use a real test database and verify:
 * - Database operations work correctly
 * - Transactions are atomic
 * - Price history is managed properly
 * - Business logic constraints are enforced
 */

describe('TitleService Integration Tests', () => {
  let testSeriesId: number

  beforeAll(async () => {
    // Create test series for relationship testing
    const series = await prisma.series.create({
      data: {
        name: 'Test Series for Titles',
        description: 'Test series'
      }
    })
    testSeriesId = series.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.title.deleteMany({
      where: {
        isbn: {
          startsWith: '978999'
        }
      }
    })
    await prisma.series.delete({
      where: { id: testSeriesId }
    }).catch(() => {})
  })

  beforeEach(async () => {
    // Clean up test titles before each test
    await prisma.title.deleteMany({
      where: {
        isbn: {
          startsWith: '978999'
        }
      }
    })
  })

  describe('create', () => {
    test('should create title and price history in database', async () => {
      const title = await titleService.create({
        isbn: '9789990000009',
        title: 'Integration Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        publisher: 'Test Publisher',
        seriesId: testSeriesId
      })

      expect(title.id).toBeDefined()
      expect(title.isbn).toBe('9789990000009')
      expect(title.title).toBe('Integration Test Book')
      expect(title.series).toBeDefined()
      expect(title.series?.id).toBe(testSeriesId)

      // Verify price history was created
      const priceHistory = await prisma.priceHistory.findMany({
        where: { titleId: title.id }
      })

      expect(priceHistory).toHaveLength(1)
      expect(priceHistory[0].rrp.toNumber()).toBe(29.99)
      expect(priceHistory[0].unitCost?.toNumber()).toBe(8.50)
      expect(priceHistory[0].effectiveTo).toBeNull()
      expect(priceHistory[0].reason).toBe('Initial price')
    })

    test('should normalize ISBN on creation', async () => {
      const title = await titleService.create({
        isbn: '978-9990000-00-9',
        title: 'ISBN Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      expect(title.isbn).toBe('9789990000009')

      // Verify it's stored without hyphens
      const dbTitle = await prisma.title.findUnique({
        where: { id: title.id }
      })

      expect(dbTitle?.isbn).toBe('9789990000009')
    })

    test('should convert ISBN-10 to ISBN-13', async () => {
      const title = await titleService.create({
        isbn: '0306406152', // ISBN-10
        title: 'ISBN-10 Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      expect(title.isbn).toBe('9780306406157')
    })

    test('should prevent duplicate ISBN', async () => {
      await titleService.create({
        isbn: '9789990000016',
        title: 'First Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      await expect(
        titleService.create({
          isbn: '9789990000016',
          title: 'Second Book',
          author: 'Another Author',
          format: 'HARDCOVER' as Format,
          rrp: 39.99,
          unitCost: 12.50
        })
      ).rejects.toThrow('already exists')
    })

    test('should handle all optional fields', async () => {
      const title = await titleService.create({
        isbn: '9789990000023',
        title: 'Complete Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        publisher: 'Test Publisher',
        publicationDate: new Date('2025-01-01'),
        pageCount: 350,
        description: 'A comprehensive test book',
        category: 'Technology',
        subcategory: 'Programming',
        dimensions: '229x152x19',
        weight: 450,
        bindingType: 'Perfect Bound',
        coverFinish: 'Matte',
        tradeDiscount: 40.0,
        royaltyRate: 10.0,
        royaltyThreshold: 1000,
        printRunSize: 2000,
        reprintThreshold: 500,
        keywords: 'test, programming, technology',
        language: 'en',
        territoryRights: 'World English',
        seriesId: testSeriesId
      })

      expect(title.publisher).toBe('Test Publisher')
      expect(title.pageCount).toBe(350)
      expect(title.category).toBe('Technology')
      expect(title.tradeDiscount?.toNumber()).toBe(40.0)
      expect(title.royaltyRate?.toNumber()).toBe(10.0)
    })
  })

  describe('update', () => {
    test('should update title without creating price history', async () => {
      const title = await titleService.create({
        isbn: '9789990000030',
        title: 'Original Title',
        author: 'Original Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      const updated = await titleService.update(title.id, {
        title: 'Updated Title',
        author: 'Updated Author'
      })

      expect(updated.title).toBe('Updated Title')
      expect(updated.author).toBe('Updated Author')

      // Should still have only 1 price history record
      const priceHistory = await prisma.priceHistory.findMany({
        where: { titleId: title.id }
      })

      expect(priceHistory).toHaveLength(1)
    })

    test('should create price history when RRP changes', async () => {
      const title = await titleService.create({
        isbn: '9789990000047',
        title: 'Price Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      const updated = await titleService.update(title.id, {
        rrp: 34.99,
        priceChangeReason: 'Price increase due to costs'
      })

      expect(updated.rrp.toNumber()).toBe(34.99)

      // Should have 2 price history records
      const priceHistory = await prisma.priceHistory.findMany({
        where: { titleId: title.id },
        orderBy: { effectiveFrom: 'asc' }
      })

      expect(priceHistory).toHaveLength(2)

      // First record should be closed
      expect(priceHistory[0].rrp.toNumber()).toBe(29.99)
      expect(priceHistory[0].effectiveTo).not.toBeNull()

      // Second record should be current
      expect(priceHistory[1].rrp.toNumber()).toBe(34.99)
      expect(priceHistory[1].effectiveTo).toBeNull()
      expect(priceHistory[1].reason).toBe('Price increase due to costs')
    })

    test('should create price history when unit cost changes', async () => {
      const title = await titleService.create({
        isbn: '9789990000054',
        title: 'Cost Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      await titleService.update(title.id, {
        unitCost: 9.50,
        priceChangeReason: 'Printing cost increase'
      })

      const priceHistory = await prisma.priceHistory.findMany({
        where: { titleId: title.id },
        orderBy: { effectiveFrom: 'desc' }
      })

      expect(priceHistory).toHaveLength(2)
      expect(priceHistory[0].unitCost?.toNumber()).toBe(9.50)
      expect(priceHistory[0].reason).toBe('Printing cost increase')
    })

    test('should create price history when trade discount changes', async () => {
      const title = await titleService.create({
        isbn: '9789990000061',
        title: 'Discount Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        tradeDiscount: 40.0
      })

      await titleService.update(title.id, {
        tradeDiscount: 45.0,
        priceChangeReason: 'Promotional discount increase'
      })

      const priceHistory = await prisma.priceHistory.findMany({
        where: { titleId: title.id },
        orderBy: { effectiveFrom: 'desc' }
      })

      expect(priceHistory).toHaveLength(2)
      expect(priceHistory[0].tradeDiscount?.toNumber()).toBe(45.0)
    })

    test('should allow ISBN change if not duplicate', async () => {
      const title = await titleService.create({
        isbn: '9789990000078',
        title: 'ISBN Change Test',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      const updated = await titleService.update(title.id, {
        isbn: '9789990000085'
      })

      expect(updated.isbn).toBe('9789990000085')
    })

    test('should prevent ISBN change to duplicate', async () => {
      await titleService.create({
        isbn: '9789990000092',
        title: 'First Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      const secondTitle = await titleService.create({
        isbn: '9789990000108',
        title: 'Second Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      await expect(
        titleService.update(secondTitle.id, {
          isbn: '9789990000092'
        })
      ).rejects.toThrow('already exists')
    })
  })

  describe('findById', () => {
    test('should find title with all relationships', async () => {
      const title = await titleService.create({
        isbn: '9789990000115',
        title: 'Relationship Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        seriesId: testSeriesId
      })

      const found = await titleService.findById(title.id)

      expect(found.id).toBe(title.id)
      expect(found.series).toBeDefined()
      expect(found.series?.id).toBe(testSeriesId)
      expect(found.priceHistory).toBeDefined()
      expect(found.priceHistory.length).toBeGreaterThan(0)
      expect(found.inventory).toBeDefined()
    })

    test('should throw error for non-existent title', async () => {
      await expect(titleService.findById(999999)).rejects.toThrow('Title not found')
    })
  })

  describe('findByISBN', () => {
    test('should find title by normalized ISBN', async () => {
      await titleService.create({
        isbn: '9789990000122',
        title: 'ISBN Lookup Test',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      const found = await titleService.findByISBN('978-9990000-12-2')

      expect(found).not.toBeNull()
      expect(found?.title).toBe('ISBN Lookup Test')
    })

    test('should find title by ISBN-10', async () => {
      await titleService.create({
        isbn: '9780306406157',
        title: 'ISBN-10 Lookup Test',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      const found = await titleService.findByISBN('0306406152')

      expect(found).not.toBeNull()
      expect(found?.title).toBe('ISBN-10 Lookup Test')
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create test titles
      await titleService.create({
        isbn: '9789990000139',
        title: 'React Basics',
        author: 'Alice Smith',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        category: 'Technology',
        publisher: 'TechBooks'
      })

      await titleService.create({
        isbn: '9789990000146',
        title: 'Advanced React',
        author: 'Bob Johnson',
        format: 'HARDCOVER' as Format,
        rrp: 39.99,
        unitCost: 12.50,
        category: 'Technology',
        publisher: 'TechBooks'
      })

      await titleService.create({
        isbn: '9789990000153',
        title: 'Python Essentials',
        author: 'Charlie Brown',
        format: 'PAPERBACK' as Format,
        rrp: 34.99,
        unitCost: 10.00,
        category: 'Programming',
        publisher: 'CodePress'
      })
    })

    test('should return paginated results', async () => {
      const result = await titleService.list({
        page: 1,
        limit: 2
      })

      expect(result.data.length).toBeLessThanOrEqual(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(2)
      expect(result.pagination.total).toBeGreaterThanOrEqual(3)
    })

    test('should search by title', async () => {
      const result = await titleService.list({
        search: 'React'
      })

      expect(result.data.length).toBe(2)
      expect(result.data.every(t => t.title.includes('React'))).toBe(true)
    })

    test('should search by author', async () => {
      const result = await titleService.list({
        search: 'Alice'
      })

      expect(result.data.length).toBe(1)
      expect(result.data[0].author).toBe('Alice Smith')
    })

    test('should filter by format', async () => {
      const result = await titleService.list({
        format: 'PAPERBACK' as Format
      })

      expect(result.data.length).toBe(2)
      expect(result.data.every(t => t.format === 'PAPERBACK')).toBe(true)
    })

    test('should filter by category', async () => {
      const result = await titleService.list({
        category: 'Technology'
      })

      expect(result.data.length).toBe(2)
      expect(result.data.every(t => t.category === 'Technology')).toBe(true)
    })

    test('should filter by publisher', async () => {
      const result = await titleService.list({
        publisher: 'TechBooks'
      })

      expect(result.data.length).toBe(2)
    })

    test('should sort by title ascending', async () => {
      const result = await titleService.list({
        sortBy: 'title',
        sortOrder: 'asc'
      })

      const titles = result.data.map(t => t.title)
      const sortedTitles = [...titles].sort()
      expect(titles).toEqual(sortedTitles)
    })

    test('should sort by author descending', async () => {
      const result = await titleService.list({
        sortBy: 'author',
        sortOrder: 'desc'
      })

      const authors = result.data.map(t => t.author)
      const sortedAuthors = [...authors].sort().reverse()
      expect(authors).toEqual(sortedAuthors)
    })
  })

  describe('delete', () => {
    test('should delete title without inventory', async () => {
      const title = await titleService.create({
        isbn: '9789990000160',
        title: 'Delete Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      await titleService.delete(title.id)

      const found = await prisma.title.findUnique({
        where: { id: title.id }
      })

      expect(found).toBeNull()
    })

    test('should delete price history with title', async () => {
      const title = await titleService.create({
        isbn: '9789990000177',
        title: 'Cascade Delete Test',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      await titleService.delete(title.id)

      const priceHistory = await prisma.priceHistory.findMany({
        where: { titleId: title.id }
      })

      expect(priceHistory).toHaveLength(0)
    })

    test('should prevent delete if title has inventory', async () => {
      const title = await titleService.create({
        isbn: '9789990000184',
        title: 'Inventory Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      // Create warehouse
      const warehouse = await prisma.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TST',
          location: 'Test Location',
          fulfillsChannels: ['ONLINE_SALES']
        }
      })

      // Create inventory
      await prisma.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100
        }
      })

      await expect(titleService.delete(title.id)).rejects.toThrow(
        'Cannot delete title with existing inventory'
      )

      // Cleanup
      await prisma.inventory.deleteMany({ where: { titleId: title.id } })
      await prisma.warehouse.delete({ where: { id: warehouse.id } })
      await prisma.title.delete({ where: { id: title.id } })
    })
  })

  describe('getPriceHistory', () => {
    test('should return price history in chronological order', async () => {
      const title = await titleService.create({
        isbn: '9789990000191',
        title: 'Price History Test',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      // Update price twice
      await titleService.update(title.id, {
        rrp: 34.99,
        priceChangeReason: 'First increase'
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      await titleService.update(title.id, {
        rrp: 39.99,
        priceChangeReason: 'Second increase'
      })

      const history = await titleService.getPriceHistory(title.id)

      expect(history).toHaveLength(3)
      expect(history[0].rrp.toNumber()).toBe(39.99) // Most recent
      expect(history[1].rrp.toNumber()).toBe(34.99)
      expect(history[2].rrp.toNumber()).toBe(29.99) // Original
    })
  })

  describe('getCategories and getPublishers', () => {
    beforeEach(async () => {
      await titleService.create({
        isbn: '9789990000207',
        title: 'Category Test 1',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        category: 'Fiction',
        publisher: 'Publisher A'
      })

      await titleService.create({
        isbn: '9789990000214',
        title: 'Category Test 2',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        category: 'Non-Fiction',
        publisher: 'Publisher B'
      })
    })

    test('should return unique categories', async () => {
      const categories = await titleService.getCategories()

      expect(categories).toContain('Fiction')
      expect(categories).toContain('Non-Fiction')
      expect(categories).toEqual([...new Set(categories)]) // No duplicates
    })

    test('should return unique publishers', async () => {
      const publishers = await titleService.getPublishers()

      expect(publishers).toContain('Publisher A')
      expect(publishers).toContain('Publisher B')
      expect(publishers).toEqual([...new Set(publishers)]) // No duplicates
    })
  })
})
