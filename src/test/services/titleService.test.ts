import { describe, test, expect, beforeEach, vi } from 'vitest'
import { titleService } from '@/services/titleService'
import { prisma } from '@/lib/database'
import { Format } from '@prisma/client'

// Mock Prisma
vi.mock('@/lib/database', () => ({
  prisma: {
    title: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    priceHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn()
    },
    inventory: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

describe('TitleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    test('should create title with valid ISBN-13', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      }

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            create: vi.fn().mockResolvedValue(mockTitle)
          },
          priceHistory: {
            create: vi.fn().mockResolvedValue({})
          }
        })
      })

      // Mock findUnique to return null (no duplicate)
      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      const result = await titleService.create({
        isbn: '978-0-306-40615-7',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      expect(result).toEqual(mockTitle)
      expect(prisma.title.findUnique).toHaveBeenCalledWith({
        where: { isbn: '9780306406157' }
      })
    })

    test('should create title with valid ISBN-10 (converted to ISBN-13)', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            create: vi.fn().mockResolvedValue(mockTitle)
          },
          priceHistory: {
            create: vi.fn().mockResolvedValue({})
          }
        })
      })

      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      const result = await titleService.create({
        isbn: '0-306-40615-2', // ISBN-10
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      expect(result.isbn).toBe('9780306406157')
    })

    test('should reject invalid ISBN', async () => {
      await expect(
        titleService.create({
          isbn: 'invalid-isbn',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        })
      ).rejects.toThrow('Invalid ISBN format')
    })

    test('should reject duplicate ISBN', async () => {
      const existingTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Existing Book',
        author: 'Existing Author'
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(existingTitle as any)

      await expect(
        titleService.create({
          isbn: '978-0-306-40615-7',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        })
      ).rejects.toThrow('Title with ISBN 9780306406157 already exists')
    })

    test('should create price history on title creation', async () => {
      const createPriceHistory = vi.fn()

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            create: vi.fn().mockResolvedValue({
              id: 1,
              isbn: '9780306406157'
            })
          },
          priceHistory: {
            create: createPriceHistory
          }
        })
      })

      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      await titleService.create({
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50
      })

      expect(createPriceHistory).toHaveBeenCalled()
    })

    test('should handle optional fields', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        publisher: 'Test Publisher',
        seriesId: 1,
        category: 'Fiction'
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            create: vi.fn().mockResolvedValue(mockTitle)
          },
          priceHistory: {
            create: vi.fn().mockResolvedValue({})
          }
        })
      })

      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      const result = await titleService.create({
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK' as Format,
        rrp: 29.99,
        unitCost: 8.50,
        publisher: 'Test Publisher',
        seriesId: 1,
        category: 'Fiction'
      })

      expect(result.publisher).toBe('Test Publisher')
      expect(result.seriesId).toBe(1)
      expect(result.category).toBe('Fiction')
    })
  })

  describe('update', () => {
    test('should update title without price change', async () => {
      const existingTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Old Title',
        rrp: { toNumber: () => 29.99 },
        unitCost: { toNumber: () => 8.50 },
        tradeDiscount: null
      }

      const updatedTitle = {
        ...existingTitle,
        title: 'New Title'
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(existingTitle as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            update: vi.fn().mockResolvedValue(updatedTitle)
          },
          priceHistory: {
            updateMany: vi.fn(),
            create: vi.fn()
          }
        })
      })

      const result = await titleService.update(1, {
        title: 'New Title'
      })

      expect(result.title).toBe('New Title')
    })

    test('should create price history when price changes', async () => {
      const existingTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        rrp: { toNumber: () => 29.99 },
        unitCost: { toNumber: () => 8.50 },
        tradeDiscount: null
      }

      const updatedTitle = {
        ...existingTitle,
        rrp: { toNumber: () => 34.99 }
      }

      const updateMany = vi.fn()
      const createPriceHistory = vi.fn()

      vi.mocked(prisma.title.findUnique).mockResolvedValue(existingTitle as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            update: vi.fn().mockResolvedValue(updatedTitle)
          },
          priceHistory: {
            updateMany,
            create: createPriceHistory
          }
        })
      })

      await titleService.update(1, {
        rrp: 34.99,
        priceChangeReason: 'Price increase'
      })

      expect(updateMany).toHaveBeenCalled()
      expect(createPriceHistory).toHaveBeenCalled()
    })

    test('should reject update with invalid ISBN', async () => {
      const existingTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        rrp: { toNumber: () => 29.99 },
        unitCost: { toNumber: () => 8.50 },
        tradeDiscount: null
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(existingTitle as any)

      await expect(
        titleService.update(1, {
          isbn: 'invalid-isbn'
        })
      ).rejects.toThrow('Invalid ISBN format')
    })

    test('should reject update with duplicate ISBN', async () => {
      const existingTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        rrp: { toNumber: () => 29.99 },
        unitCost: { toNumber: () => 8.50 },
        tradeDiscount: null
      }

      const duplicateTitle = {
        id: 2,
        isbn: '9781234567897',
        title: 'Other Book'
      }

      vi.mocked(prisma.title.findUnique)
        .mockResolvedValueOnce(existingTitle as any)
        .mockResolvedValueOnce(duplicateTitle as any)

      await expect(
        titleService.update(1, {
          isbn: '978-1-234567-89-7'
        })
      ).rejects.toThrow('ISBN 9781234567897 already exists')
    })

    test('should throw error if title not found', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      await expect(
        titleService.update(999, {
          title: 'New Title'
        })
      ).rejects.toThrow('Title not found')
    })
  })

  describe('findById', () => {
    test('should return title with relationships', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        series: {
          id: 1,
          name: 'Test Series'
        },
        priceHistory: [
          {
            id: 1,
            rrp: 29.99,
            effectiveFrom: new Date()
          }
        ],
        inventory: [
          {
            id: 1,
            warehouseId: 1,
            currentStock: 100,
            warehouse: {
              id: 1,
              name: 'Test Warehouse'
            }
          }
        ]
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(mockTitle as any)

      const result = await titleService.findById(1)

      expect(result).toEqual(mockTitle)
      expect(result.series).toBeDefined()
      expect(result.priceHistory).toHaveLength(1)
      expect(result.inventory).toHaveLength(1)
    })

    test('should throw error if title not found', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      await expect(titleService.findById(999)).rejects.toThrow('Title not found')
    })
  })

  describe('findByISBN', () => {
    test('should find title by ISBN-13', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author'
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(mockTitle as any)

      const result = await titleService.findByISBN('978-0-306-40615-7')

      expect(result).toEqual(mockTitle)
    })

    test('should find title by ISBN-10 (converted to ISBN-13)', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author'
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(mockTitle as any)

      const result = await titleService.findByISBN('0-306-40615-2')

      expect(result).toEqual(mockTitle)
      expect(prisma.title.findUnique).toHaveBeenCalledWith({
        where: { isbn: '9780306406157' },
        include: expect.any(Object)
      })
    })

    test('should return null for invalid ISBN', async () => {
      const result = await titleService.findByISBN('invalid-isbn')

      expect(result).toBeNull()
      expect(prisma.title.findUnique).not.toHaveBeenCalled()
    })

    test('should return null if title not found', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      const result = await titleService.findByISBN('9780306406157')

      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    test('should return paginated list of titles', async () => {
      const mockTitles = [
        { id: 1, isbn: '9780306406157', title: 'Book 1', author: 'Author 1' },
        { id: 2, isbn: '9781234567897', title: 'Book 2', author: 'Author 2' }
      ]

      vi.mocked(prisma.title.findMany).mockResolvedValue(mockTitles as any)
      vi.mocked(prisma.title.count).mockResolvedValue(25)

      const result = await titleService.list({
        page: 1,
        limit: 20
      })

      expect(result.data).toEqual(mockTitles)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 25,
        totalPages: 2
      })
    })

    test('should handle search parameter', async () => {
      vi.mocked(prisma.title.findMany).mockResolvedValue([])
      vi.mocked(prisma.title.count).mockResolvedValue(0)

      await titleService.list({
        search: 'react'
      })

      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.any(Object) }),
              expect.objectContaining({ author: expect.any(Object) }),
              expect.objectContaining({ isbn: expect.any(Object) })
            ])
          })
        })
      )
    })

    test('should handle format filter', async () => {
      vi.mocked(prisma.title.findMany).mockResolvedValue([])
      vi.mocked(prisma.title.count).mockResolvedValue(0)

      await titleService.list({
        format: 'PAPERBACK' as Format
      })

      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            format: 'PAPERBACK'
          })
        })
      )
    })

    test('should handle series filter', async () => {
      vi.mocked(prisma.title.findMany).mockResolvedValue([])
      vi.mocked(prisma.title.count).mockResolvedValue(0)

      await titleService.list({
        seriesId: 1
      })

      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            seriesId: 1
          })
        })
      )
    })

    test('should handle sorting', async () => {
      vi.mocked(prisma.title.findMany).mockResolvedValue([])
      vi.mocked(prisma.title.count).mockResolvedValue(0)

      await titleService.list({
        sortBy: 'author',
        sortOrder: 'desc'
      })

      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            author: 'desc'
          }
        })
      )
    })
  })

  describe('delete', () => {
    test('should delete title without inventory', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book'
      }

      vi.mocked(prisma.inventory.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.title.delete).mockResolvedValue(mockTitle as any)

      const result = await titleService.delete(1)

      expect(result).toEqual(mockTitle)
      expect(prisma.inventory.findFirst).toHaveBeenCalledWith({
        where: {
          titleId: 1,
          currentStock: { gt: 0 }
        }
      })
    })

    test('should reject delete if title has inventory', async () => {
      const mockInventory = {
        id: 1,
        titleId: 1,
        warehouseId: 1,
        currentStock: 100
      }

      vi.mocked(prisma.inventory.findFirst).mockResolvedValue(mockInventory as any)

      await expect(titleService.delete(1)).rejects.toThrow(
        'Cannot delete title with existing inventory'
      )

      expect(prisma.title.delete).not.toHaveBeenCalled()
    })
  })

  describe('getPriceHistory', () => {
    test('should return price history ordered by date', async () => {
      const mockHistory = [
        {
          id: 2,
          titleId: 1,
          rrp: 34.99,
          effectiveFrom: new Date('2025-02-01')
        },
        {
          id: 1,
          titleId: 1,
          rrp: 29.99,
          effectiveFrom: new Date('2025-01-01')
        }
      ]

      vi.mocked(prisma.priceHistory.findMany).mockResolvedValue(mockHistory as any)

      const result = await titleService.getPriceHistory(1)

      expect(result).toEqual(mockHistory)
      expect(prisma.priceHistory.findMany).toHaveBeenCalledWith({
        where: { titleId: 1 },
        orderBy: {
          effectiveFrom: 'desc'
        }
      })
    })
  })

  describe('getCategories', () => {
    test('should return sorted list of unique categories', async () => {
      const mockCategories = [
        { category: 'Fiction' },
        { category: 'Non-Fiction' },
        { category: 'Biography' }
      ]

      vi.mocked(prisma.title.findMany).mockResolvedValue(mockCategories as any)

      const result = await titleService.getCategories()

      expect(result).toEqual(['Biography', 'Fiction', 'Non-Fiction'])
    })

    test('should filter out null categories', async () => {
      const mockCategories = [
        { category: 'Fiction' },
        { category: null },
        { category: 'Biography' }
      ]

      vi.mocked(prisma.title.findMany).mockResolvedValue(mockCategories as any)

      const result = await titleService.getCategories()

      expect(result).toEqual(['Biography', 'Fiction'])
    })
  })

  describe('getPublishers', () => {
    test('should return sorted list of unique publishers', async () => {
      const mockPublishers = [
        { publisher: 'O\'Reilly' },
        { publisher: 'Penguin' },
        { publisher: 'Apress' }
      ]

      vi.mocked(prisma.title.findMany).mockResolvedValue(mockPublishers as any)

      const result = await titleService.getPublishers()

      expect(result).toEqual(['Apress', 'O\'Reilly', 'Penguin'])
    })
  })

  describe('bulkImport', () => {
    test('should import all valid titles', async () => {
      const titles = [
        {
          isbn: '9780306406157',
          title: 'Book 1',
          author: 'Author 1',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: '9781234567897',
          title: 'Book 2',
          author: 'Author 2',
          format: 'HARDCOVER' as Format,
          rrp: 39.99,
          unitCost: 12.50
        }
      ]

      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            create: vi.fn().mockResolvedValue({})
          },
          priceHistory: {
            create: vi.fn().mockResolvedValue({})
          }
        })
      })

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle partial failures', async () => {
      const titles = [
        {
          isbn: '9780306406157',
          title: 'Book 1',
          author: 'Author 1',
          format: 'PAPERBACK' as Format,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: 'invalid-isbn',
          title: 'Book 2',
          author: 'Author 2',
          format: 'HARDCOVER' as Format,
          rrp: 39.99,
          unitCost: 12.50
        }
      ]

      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            create: vi.fn().mockResolvedValue({})
          },
          priceHistory: {
            create: vi.fn().mockResolvedValue({})
          }
        })
      })

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].isbn).toBe('invalid-isbn')
      expect(result.errors[0].row).toBe(2)
    })
  })

  describe('bulkUpdatePrices', () => {
    test('should update all prices successfully', async () => {
      const updates = [
        { id: 1, rrp: 34.99 },
        { id: 2, rrp: 44.99 }
      ]

      const existingTitle = {
        id: 1,
        isbn: '9780306406157',
        title: 'Test Book',
        rrp: { toNumber: () => 29.99 },
        unitCost: { toNumber: () => 8.50 },
        tradeDiscount: null
      }

      vi.mocked(prisma.title.findUnique).mockResolvedValue(existingTitle as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            update: vi.fn().mockResolvedValue({})
          },
          priceHistory: {
            updateMany: vi.fn(),
            create: vi.fn()
          }
        })
      })

      const results = await titleService.bulkUpdatePrices(updates, 'Annual price review')

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })

    test('should handle update failures', async () => {
      const updates = [
        { id: 1, rrp: 34.99 },
        { id: 999, rrp: 44.99 } // Non-existent
      ]

      vi.mocked(prisma.title.findUnique)
        .mockResolvedValueOnce({
          id: 1,
          isbn: '9780306406157',
          title: 'Test Book',
          rrp: { toNumber: () => 29.99 },
          unitCost: { toNumber: () => 8.50 },
          tradeDiscount: null
        } as any)
        .mockResolvedValueOnce(null)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          title: {
            update: vi.fn().mockResolvedValue({})
          },
          priceHistory: {
            updateMany: vi.fn(),
            create: vi.fn()
          }
        })
      })

      const results = await titleService.bulkUpdatePrices(updates, 'Annual price review')

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBe('Title not found')
    })
  })
})
