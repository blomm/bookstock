// src/services/titleService.ts

import { prisma } from '@/lib/database'
import { Prisma, Format } from '@prisma/client'
import {
  normalizeISBN,
  validateISBN13,
  toISBN13
} from '@/lib/validators/isbn'

/**
 * Input types for title service operations
 */
export interface CreateTitleInput {
  isbn: string
  title: string
  author: string
  format: Format
  rrp: number
  unitCost: number
  publisher?: string
  publicationDate?: Date | string
  pageCount?: number
  description?: string
  category?: string
  subcategory?: string
  dimensions?: string
  weight?: number
  bindingType?: string
  coverFinish?: string
  tradeDiscount?: number
  royaltyRate?: number
  royaltyThreshold?: number
  printRunSize?: number
  reprintThreshold?: number
  keywords?: string
  language?: string
  territoryRights?: string
  seriesId?: number
}

export interface UpdateTitleInput extends Partial<CreateTitleInput> {
  priceChangeReason?: string // For price history tracking
}

export interface ListTitlesOptions {
  page?: number
  limit?: number
  search?: string
  format?: Format
  seriesId?: number
  category?: string
  publisher?: string
  sortBy?: 'title' | 'author' | 'publicationDate' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ListTitlesResult {
  data: any[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BulkImportResult {
  success: number
  failed: number
  errors: Array<{
    row: number
    isbn: string
    error: string
  }>
}

/**
 * Title Management Service
 *
 * Handles all business logic for title operations including:
 * - CRUD operations with validation
 * - ISBN validation and normalization
 * - Automatic price history tracking
 * - Bulk operations
 */
class TitleService {
  /**
   * Create a new title with validation and price history
   *
   * @param data - Title creation data
   * @returns Created title with relationships
   * @throws Error if ISBN is invalid or duplicate
   */
  async create(data: CreateTitleInput) {
    // Normalize and validate ISBN
    const isbn = normalizeISBN(data.isbn)
    const isbn13 = toISBN13(isbn)

    if (!isbn13) {
      throw new Error(`Invalid ISBN format: ${data.isbn}`)
    }

    // Check for duplicate ISBN
    const existing = await prisma.title.findUnique({
      where: { isbn: isbn13 }
    })

    if (existing) {
      throw new Error(`Title with ISBN ${isbn13} already exists`)
    }

    // Create title with price history in a transaction
    return await prisma.$transaction(async (tx) => {
      const title = await tx.title.create({
        data: {
          ...data,
          isbn: isbn13,
          rrp: new Prisma.Decimal(data.rrp),
          unitCost: new Prisma.Decimal(data.unitCost),
          tradeDiscount: data.tradeDiscount
            ? new Prisma.Decimal(data.tradeDiscount)
            : null,
          royaltyRate: data.royaltyRate
            ? new Prisma.Decimal(data.royaltyRate)
            : null,
          publicationDate: data.publicationDate
            ? new Date(data.publicationDate)
            : null
        },
        include: {
          series: true
        }
      })

      // Create initial price history record
      await tx.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: new Prisma.Decimal(data.rrp),
          unitCost: new Prisma.Decimal(data.unitCost),
          tradeDiscount: data.tradeDiscount
            ? new Prisma.Decimal(data.tradeDiscount)
            : null,
          effectiveFrom: new Date(),
          reason: 'Initial price'
        }
      })

      return title
    })
  }

  /**
   * Update a title with automatic price history management
   *
   * When price fields (rrp, unitCost, tradeDiscount) change:
   * 1. Closes current price history record (sets effectiveTo)
   * 2. Creates new price history record with new prices
   *
   * @param id - Title ID
   * @param data - Update data (partial)
   * @returns Updated title with relationships
   * @throws Error if title not found or ISBN is duplicate
   */
  async update(id: number, data: UpdateTitleInput) {
    const existing = await prisma.title.findUnique({
      where: { id }
    })

    if (!existing) {
      throw new Error('Title not found')
    }

    // Check if ISBN is being changed and validate
    if (data.isbn && data.isbn !== existing.isbn) {
      const normalizedISBN = normalizeISBN(data.isbn)
      const isbn13 = toISBN13(normalizedISBN)

      if (!isbn13) {
        throw new Error(`Invalid ISBN format: ${data.isbn}`)
      }

      // Check for duplicate
      const duplicate = await prisma.title.findUnique({
        where: { isbn: isbn13 }
      })

      if (duplicate && duplicate.id !== id) {
        throw new Error(`ISBN ${isbn13} already exists`)
      }

      data.isbn = isbn13
    }

    // Check if price changed
    const priceChanged =
      (data.rrp !== undefined && data.rrp !== existing.rrp.toNumber()) ||
      (data.unitCost !== undefined && data.unitCost !== existing.unitCost.toNumber()) ||
      (data.tradeDiscount !== undefined &&
        data.tradeDiscount !== existing.tradeDiscount?.toNumber())

    return await prisma.$transaction(async (tx) => {
      // Update title
      const updateData: any = { ...data }

      if (data.rrp !== undefined) {
        updateData.rrp = new Prisma.Decimal(data.rrp)
      }
      if (data.unitCost !== undefined) {
        updateData.unitCost = new Prisma.Decimal(data.unitCost)
      }
      if (data.tradeDiscount !== undefined) {
        updateData.tradeDiscount = data.tradeDiscount
          ? new Prisma.Decimal(data.tradeDiscount)
          : null
      }
      if (data.royaltyRate !== undefined) {
        updateData.royaltyRate = data.royaltyRate
          ? new Prisma.Decimal(data.royaltyRate)
          : null
      }
      if (data.publicationDate !== undefined) {
        updateData.publicationDate = data.publicationDate
          ? new Date(data.publicationDate)
          : null
      }

      // Remove priceChangeReason from update data (not a Title field)
      delete updateData.priceChangeReason

      const updated = await tx.title.update({
        where: { id },
        data: updateData,
        include: {
          series: true,
          priceHistory: {
            where: {
              effectiveTo: null
            }
          }
        }
      })

      // If price changed, create price history
      if (priceChanged) {
        // Close current price record
        await tx.priceHistory.updateMany({
          where: {
            titleId: id,
            effectiveTo: null
          },
          data: {
            effectiveTo: new Date()
          }
        })

        // Create new price record
        await tx.priceHistory.create({
          data: {
            titleId: id,
            rrp: new Prisma.Decimal(data.rrp ?? updated.rrp),
            unitCost: data.unitCost !== undefined
              ? new Prisma.Decimal(data.unitCost)
              : updated.unitCost,
            tradeDiscount: data.tradeDiscount !== undefined
              ? (data.tradeDiscount ? new Prisma.Decimal(data.tradeDiscount) : null)
              : updated.tradeDiscount,
            effectiveFrom: new Date(),
            reason: data.priceChangeReason || 'Price update'
          }
        })
      }

      return updated
    })
  }

  /**
   * Get title by ID with all relationships
   *
   * @param id - Title ID
   * @returns Title with series, price history, and inventory
   * @throws Error if title not found
   */
  async findById(id: number) {
    const title = await prisma.title.findUnique({
      where: { id },
      include: {
        series: true,
        priceHistory: {
          orderBy: {
            effectiveFrom: 'desc'
          }
        },
        inventory: {
          include: {
            warehouse: true
          }
        }
      }
    })

    if (!title) {
      throw new Error('Title not found')
    }

    return title
  }

  /**
   * Get title by ISBN (normalized lookup)
   *
   * @param isbn - ISBN (can be ISBN-10 or ISBN-13, with or without hyphens)
   * @returns Title with relationships or null
   */
  async findByISBN(isbn: string) {
    const normalizedISBN = normalizeISBN(isbn)
    const isbn13 = toISBN13(normalizedISBN)

    if (!isbn13) {
      return null
    }

    return await prisma.title.findUnique({
      where: { isbn: isbn13 },
      include: {
        series: true,
        priceHistory: {
          where: {
            effectiveTo: null
          }
        }
      }
    })
  }

  /**
   * List titles with pagination and filtering
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of titles with metadata
   */
  async list(options: ListTitlesOptions = {}): Promise<ListTitlesResult> {
    const {
      page = 1,
      limit = 20,
      search,
      format,
      seriesId,
      category,
      publisher,
      sortBy = 'title',
      sortOrder = 'asc'
    } = options

    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.TitleWhereInput = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search } }
      ]
    }

    if (format) {
      where.format = format
    }

    if (seriesId) {
      where.seriesId = seriesId
    }

    if (category) {
      where.category = category
    }

    if (publisher) {
      where.publisher = { contains: publisher, mode: 'insensitive' }
    }

    // Execute query with count
    const [titles, total] = await Promise.all([
      prisma.title.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          series: true
        }
      }),
      prisma.title.count({ where })
    ])

    return {
      data: titles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Delete a title (with inventory validation)
   *
   * Cannot delete titles with existing inventory > 0
   *
   * @param id - Title ID
   * @returns Deleted title
   * @throws Error if title has inventory or not found
   */
  async delete(id: number) {
    // Check if title has inventory
    const inventory = await prisma.inventory.findFirst({
      where: {
        titleId: id,
        currentStock: { gt: 0 }
      }
    })

    if (inventory) {
      throw new Error('Cannot delete title with existing inventory')
    }

    // Delete title (will cascade to price history)
    return await prisma.title.delete({
      where: { id }
    })
  }

  /**
   * Get price history for a title
   *
   * @param titleId - Title ID
   * @returns Array of price history records (newest first)
   */
  async getPriceHistory(titleId: number) {
    return await prisma.priceHistory.findMany({
      where: { titleId },
      orderBy: {
        effectiveFrom: 'desc'
      }
    })
  }

  /**
   * Get all unique categories from titles
   *
   * @returns Sorted array of category names
   */
  async getCategories(): Promise<string[]> {
    const categories = await prisma.title.findMany({
      where: {
        category: { not: null }
      },
      select: {
        category: true
      },
      distinct: ['category']
    })

    return categories
      .map(c => c.category)
      .filter((c): c is string => c !== null)
      .sort()
  }

  /**
   * Get all unique publishers from titles
   *
   * @returns Sorted array of publisher names
   */
  async getPublishers(): Promise<string[]> {
    const publishers = await prisma.title.findMany({
      where: {
        publisher: { not: null }
      },
      select: {
        publisher: true
      },
      distinct: ['publisher']
    })

    return publishers
      .map(p => p.publisher)
      .filter((p): p is string => p !== null)
      .sort()
  }

  /**
   * Bulk import titles from array
   *
   * Processes each title individually, collecting successes and errors
   *
   * @param titles - Array of title data to import
   * @returns Result with success/failure counts and error details
   */
  async bulkImport(titles: CreateTitleInput[]): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      errors: []
    }

    for (let i = 0; i < titles.length; i++) {
      try {
        await this.create(titles[i])
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({
          row: i + 1,
          isbn: titles[i].isbn,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  }

  /**
   * Bulk update prices with price history
   *
   * Updates multiple titles atomically with price history tracking
   *
   * @param updates - Array of price updates
   * @param reason - Reason for price changes
   * @returns Array of results (success/error per title)
   */
  async bulkUpdatePrices(
    updates: Array<{
      id: number
      rrp?: number
      unitCost?: number
      tradeDiscount?: number
    }>,
    reason: string
  ) {
    const results = []

    for (const update of updates) {
      try {
        const title = await this.update(update.id, {
          ...update,
          priceChangeReason: reason
        })
        results.push({ success: true, id: update.id, title })
      } catch (error) {
        results.push({
          success: false,
          id: update.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }
}

export const titleService = new TitleService()
