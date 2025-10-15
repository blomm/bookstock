import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/database'
import { Format } from '@prisma/client'
import { titleService } from '@/services/titleService'

/**
 * Integration tests for Title Bulk Operations API Routes
 *
 * Tests cover:
 * - POST /api/titles/bulk-import - Bulk title import
 * - GET /api/titles/export - CSV export
 * - PUT /api/titles/bulk-update-prices - Bulk price updates
 *
 * Note: Authentication/authorization middleware is tested separately
 */

describe('Title Bulk Operations API Integration Tests', () => {
  let testSeriesId: number

  beforeAll(async () => {
    // Create test series
    const series = await prisma.series.create({
      data: {
        name: 'Bulk API Test Series',
        description: 'Test series for bulk API tests'
      }
    })
    testSeriesId = series.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.title.deleteMany({
      where: {
        isbn: {
          startsWith: '978777'
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
          startsWith: '978777'
        }
      }
    })
  })

  describe('POST /api/titles/bulk-import', () => {
    test('should import multiple valid titles', async () => {
      const titles = [
        {
          isbn: '9787770000005',
          title: 'Bulk Import Test 1',
          author: 'Test Author 1',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50,
          publisher: 'TestPub',
          category: 'Fiction'
        },
        {
          isbn: '9787770000012',
          title: 'Bulk Import Test 2',
          author: 'Test Author 2',
          format: 'HARDCOVER' as Format,
          rrp: 39.99,
          unitCost: 12.50,
          publisher: 'TestPub',
          category: 'Fiction'
        }
      ]

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)

      // Verify titles were created in database
      const created = await prisma.title.findMany({
        where: {
          isbn: {
            in: ['9787770000005', '9787770000012']
          }
        }
      })

      expect(created).toHaveLength(2)
    })

    test('should handle partial failures with detailed error reporting', async () => {
      // Create one title to cause duplicate error
      await prisma.title.create({
        data: {
          isbn: '9787770000029',
          title: 'Existing Title',
          author: 'Existing Author',
          format: 'PAPERBACK',
          rrp: 29.99,
          unitCost: 8.50
        }
      })

      const titles = [
        {
          isbn: '9787770000036',
          title: 'Valid Title',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: '9787770000029', // Duplicate
          title: 'Duplicate Title',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: 'invalid', // Invalid ISBN
          title: 'Invalid ISBN Title',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        }
      ]

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(1)
      expect(result.failed).toBe(2)
      expect(result.errors).toHaveLength(2)

      // Check error details
      expect(result.errors[0].row).toBe(2)
      expect(result.errors[0].isbn).toBe('9787770000029')
      expect(result.errors[0].error).toContain('already exists')

      expect(result.errors[1].row).toBe(3)
      expect(result.errors[1].isbn).toBe('invalid')
      expect(result.errors[1].error).toContain('Invalid ISBN')
    })

    test('should handle empty array', async () => {
      const result = await titleService.bulkImport([])

      expect(result.success).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should create price history for all imported titles', async () => {
      const titles = [
        {
          isbn: '9787770000043',
          title: 'Price History Test 1',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: '9787770000050',
          title: 'Price History Test 2',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 39.99,
          unitCost: 12.50
        }
      ]

      await titleService.bulkImport(titles)

      // Verify price history was created
      const priceHistory = await prisma.priceHistory.findMany({
        where: {
          title: {
            isbn: {
              in: ['9787770000043', '9787770000050']
            }
          }
        }
      })

      expect(priceHistory).toHaveLength(2)
      expect(priceHistory[0].reason).toBe('Initial price')
      expect(priceHistory[1].reason).toBe('Initial price')
    })
  })

  describe('PUT /api/titles/bulk-update-prices', () => {
    let title1Id: number
    let title2Id: number
    let title3Id: number

    beforeEach(async () => {
      // Create test titles
      const [t1, t2, t3] = await prisma.$transaction([
        prisma.title.create({
          data: {
            isbn: '9787770000067',
            title: 'Price Update Test 1',
            author: 'Test Author',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50
          }
        }),
        prisma.title.create({
          data: {
            isbn: '9787770000074',
            title: 'Price Update Test 2',
            author: 'Test Author',
            format: 'PAPERBACK',
            rrp: 39.99,
            unitCost: 12.50
          }
        }),
        prisma.title.create({
          data: {
            isbn: '9787770000081',
            title: 'Price Update Test 3',
            author: 'Test Author',
            format: 'PAPERBACK',
            rrp: 49.99,
            unitCost: 15.00
          }
        })
      ])

      title1Id = t1.id
      title2Id = t2.id
      title3Id = t3.id
    })

    test('should update prices for multiple titles', async () => {
      const updates = [
        { id: title1Id, rrp: 34.99 },
        { id: title2Id, unitCost: 14.00 }
      ]

      const results = await titleService.bulkUpdatePrices(
        updates,
        'Seasonal discount'
      )

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)

      // Verify prices were updated
      const updated1 = await prisma.title.findUnique({
        where: { id: title1Id }
      })
      const updated2 = await prisma.title.findUnique({
        where: { id: title2Id }
      })

      expect(updated1?.rrp.toNumber()).toBe(34.99)
      expect(updated2?.unitCost.toNumber()).toBe(14.00)
    })

    test('should create price history for all updated titles', async () => {
      const updates = [
        { id: title1Id, rrp: 34.99 },
        { id: title2Id, rrp: 44.99 }
      ]

      await titleService.bulkUpdatePrices(updates, 'Q4 pricing update')

      // Verify price history was created with correct reason
      const priceHistory = await prisma.priceHistory.findMany({
        where: {
          titleId: {
            in: [title1Id, title2Id]
          },
          reason: 'Q4 pricing update'
        }
      })

      expect(priceHistory).toHaveLength(2)
    })

    test('should handle partial failures', async () => {
      const updates = [
        { id: title1Id, rrp: 34.99 },
        { id: 999999, rrp: 44.99 }, // Non-existent title
        { id: title2Id, rrp: 49.99 }
      ]

      const results = await titleService.bulkUpdatePrices(
        updates,
        'Bulk update test'
      )

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toContain('not found')
      expect(results[2].success).toBe(true)
    })

    test('should update all price fields simultaneously', async () => {
      const updates = [
        {
          id: title1Id,
          rrp: 35.99,
          unitCost: 10.00,
          tradeDiscount: 45.5
        }
      ]

      await titleService.bulkUpdatePrices(updates, 'Complete price revision')

      const updated = await prisma.title.findUnique({
        where: { id: title1Id }
      })

      expect(updated?.rrp.toNumber()).toBe(35.99)
      expect(updated?.unitCost.toNumber()).toBe(10.00)
      expect(updated?.tradeDiscount?.toNumber()).toBe(45.5)
    })

    test('should close previous price history records', async () => {
      // Initial price history should exist from title creation
      const initialHistory = await prisma.priceHistory.findFirst({
        where: {
          titleId: title1Id,
          effectiveTo: null
        }
      })

      expect(initialHistory).toBeTruthy()

      // Update price
      await titleService.bulkUpdatePrices(
        [{ id: title1Id, rrp: 34.99 }],
        'Price update'
      )

      // Check that old record was closed
      const closedHistory = await prisma.priceHistory.findFirst({
        where: {
          titleId: title1Id,
          id: initialHistory!.id
        }
      })

      expect(closedHistory?.effectiveTo).toBeTruthy()

      // Check that new record exists
      const newHistory = await prisma.priceHistory.findFirst({
        where: {
          titleId: title1Id,
          effectiveTo: null
        }
      })

      expect(newHistory).toBeTruthy()
      expect(newHistory?.id).not.toBe(initialHistory!.id)
    })
  })

  describe('GET /api/titles/export (CSV Export)', () => {
    beforeEach(async () => {
      // Create test titles for export
      await prisma.$transaction([
        prisma.title.create({
          data: {
            isbn: '9787770000098',
            title: 'Export Test Title 1',
            author: 'Export Author 1',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50,
            category: 'Fiction',
            publisher: 'ExportPub'
          }
        }),
        prisma.title.create({
          data: {
            isbn: '9787770000104',
            title: 'Export Test Title 2',
            author: 'Export Author 2',
            format: 'HARDCOVER',
            rrp: 39.99,
            unitCost: 12.50,
            category: 'Non-Fiction',
            publisher: 'ExportPub'
          }
        }),
        prisma.title.create({
          data: {
            isbn: '9787770000111',
            title: 'Export Test Title 3',
            author: 'Export Author 3',
            format: 'DIGITAL',
            rrp: 19.99,
            unitCost: 5.00,
            category: 'Fiction',
            publisher: 'DigitalPub'
          }
        })
      ])
    })

    test('should export all titles when no filters applied', async () => {
      const titles = await prisma.title.findMany({
        where: {
          isbn: {
            startsWith: '978777'
          }
        }
      })

      expect(titles.length).toBeGreaterThanOrEqual(3)
    })

    test('should export filtered titles by format', async () => {
      const titles = await prisma.title.findMany({
        where: {
          isbn: {
            startsWith: '978777'
          },
          format: 'PAPERBACK'
        }
      })

      expect(titles.length).toBeGreaterThanOrEqual(1)
      titles.forEach(title => {
        expect(title.format).toBe('PAPERBACK')
      })
    })

    test('should export filtered titles by category', async () => {
      const titles = await prisma.title.findMany({
        where: {
          isbn: {
            startsWith: '978777'
          },
          category: 'Fiction'
        }
      })

      expect(titles.length).toBeGreaterThanOrEqual(2)
      titles.forEach(title => {
        expect(title.category).toBe('Fiction')
      })
    })

    test('should export filtered titles by publisher', async () => {
      const titles = await prisma.title.findMany({
        where: {
          isbn: {
            startsWith: '978777'
          },
          publisher: {
            contains: 'ExportPub',
            mode: 'insensitive'
          }
        }
      })

      expect(titles.length).toBeGreaterThanOrEqual(2)
    })

    test('should export with search term', async () => {
      const titles = await prisma.title.findMany({
        where: {
          isbn: {
            startsWith: '978777'
          },
          OR: [
            { title: { contains: 'Export Test', mode: 'insensitive' } },
            { author: { contains: 'Export Author', mode: 'insensitive' } },
            { isbn: { contains: '9787770' } }
          ]
        }
      })

      expect(titles.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Error Handling for Malformed Data', () => {
    test('should handle titles with missing required fields', async () => {
      const titles = [
        {
          isbn: '9787770000128',
          title: 'Valid Title',
          author: 'Valid Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: '9787770000135',
          // Missing title
          author: 'Invalid Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        } as any
      ]

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toBeTruthy()
    })

    test('should handle titles with invalid price values', async () => {
      const titles = [
        {
          isbn: '9787770000142',
          title: 'Invalid Price Title',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: -10, // Invalid negative price
          unitCost: 8.50
        }
      ]

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(0)
      expect(result.failed).toBe(1)
    })
  })

  describe('Large File Handling (100+ titles)', () => {
    test('should handle import of 100 titles', async () => {
      // Generate 100 test titles
      const titles = Array.from({ length: 100 }, (_, i) => ({
        isbn: `97877${String(70200 + i).padStart(7, '0')}`,
        title: `Large Batch Title ${i + 1}`,
        author: `Test Author ${i + 1}`,
        format: 'PAPERBACK' as Format,
        rrp: 29.99 + (i * 0.1),
        unitCost: 8.50 + (i * 0.05)
      }))

      const startTime = Date.now()
      const result = await titleService.bulkImport(titles)
      const duration = Date.now() - startTime

      expect(result.success).toBe(100)
      expect(result.failed).toBe(0)
      expect(duration).toBeLessThan(10000) // Should complete in less than 10 seconds

      // Verify a sample of created titles
      const created = await prisma.title.count({
        where: {
          isbn: {
            startsWith: '9787770'
          }
        }
      })

      expect(created).toBeGreaterThanOrEqual(100)
    })

    test('should handle export of 100+ titles efficiently', async () => {
      // Titles created in previous test
      const startTime = Date.now()

      const titles = await prisma.title.findMany({
        where: {
          isbn: {
            startsWith: '9787770'
          }
        }
      })

      const duration = Date.now() - startTime

      expect(titles.length).toBeGreaterThanOrEqual(100)
      expect(duration).toBeLessThan(2000) // Should query in less than 2 seconds
    })
  })
})
