import { PrismaClient, Prisma } from '@prisma/client'
import { isISBN } from 'isbn3'

const prisma = new PrismaClient()

// Types for title operations
export interface CreateTitleData {
  title: string
  subtitle?: string
  author: string
  isbn: string
  publicationYear: number
  publisher?: string
  seriesId?: string
  description?: string
  format: 'HARDCOVER' | 'PAPERBACK' | 'DIGITAL' | 'AUDIOBOOK'
  rrp: number
  unitCost: number
  category?: string
  subcategory?: string
  pageCount?: number
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
}

export interface UpdateTitleData extends Partial<CreateTitleData> {
  status?: 'ACTIVE' | 'DISCONTINUED' | 'PRE_ORDER'
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}

export class TitleService {
  // Publishing industry business rules validation
  static async validatePublishingRules(data: CreateTitleData | UpdateTitleData): Promise<void> {
    // Rule 1: ISBN format and uniqueness
    if (data.isbn) {
      const normalizedISBN = this.normalizeISBN(data.isbn)

      if (!isISBN(normalizedISBN)) {
        throw new ValidationError('Invalid ISBN format', 'isbn')
      }
    }

    // Rule 2: Publication year validation
    if (data.publicationYear) {
      const currentYear = new Date().getFullYear()
      const futureLimit = currentYear + 2 // Allow 2 years in future for pre-orders

      if (data.publicationYear < 1000) {
        throw new ValidationError('Publication year must be 1000 or later', 'publicationYear')
      }

      if (data.publicationYear > futureLimit) {
        throw new ValidationError(`Publication year cannot be more than 2 years in the future (${futureLimit})`, 'publicationYear')
      }
    }

    // Rule 3: Pricing validation (industry standards)
    if (data.rrp && data.unitCost) {
      const profitMargin = ((data.rrp - data.unitCost) / data.rrp) * 100

      if (profitMargin < 0) {
        throw new BusinessRuleError('Unit cost cannot exceed RRP', 'NEGATIVE_MARGIN')
      }

      if (profitMargin < 10) {
        console.warn(`Low profit margin detected: ${profitMargin.toFixed(2)}%`)
      }
    }

    // Rule 4: Trade discount validation
    if (data.tradeDiscount !== undefined) {
      if (data.tradeDiscount < 0 || data.tradeDiscount > 70) {
        throw new ValidationError('Trade discount must be between 0% and 70%', 'tradeDiscount')
      }
    }

    // Rule 5: Royalty rate validation
    if (data.royaltyRate !== undefined) {
      if (data.royaltyRate < 0 || data.royaltyRate > 50) {
        throw new ValidationError('Royalty rate must be between 0% and 50%', 'royaltyRate')
      }
    }

    // Rule 6: Page count validation by format
    if (data.pageCount && data.format) {
      const minPages = this.getMinimumPages(data.format)
      const maxPages = this.getMaximumPages(data.format)

      if (data.pageCount < minPages) {
        throw new ValidationError(`${data.format} must have at least ${minPages} pages`, 'pageCount')
      }

      if (data.pageCount > maxPages) {
        throw new ValidationError(`${data.format} cannot exceed ${maxPages} pages`, 'pageCount')
      }
    }

    // Rule 7: Weight and dimensions validation
    if (data.weight && data.format) {
      const maxWeight = this.getMaximumWeight(data.format)
      if (data.weight > maxWeight) {
        throw new ValidationError(`${data.format} cannot exceed ${maxWeight}g`, 'weight')
      }
    }

    // Rule 8: Print run size validation
    if (data.printRunSize && data.format) {
      const minPrintRun = this.getMinimumPrintRun(data.format)
      if (data.printRunSize < minPrintRun) {
        throw new ValidationError(`${data.format} minimum print run is ${minPrintRun} copies`, 'printRunSize')
      }
    }
  }

  // Create title with full business rule validation
  static async createTitle(data: CreateTitleData): Promise<any> {
    // Apply business rules validation
    await this.validatePublishingRules(data)

    const normalizedISBN = this.normalizeISBN(data.isbn)

    // Check for duplicate ISBN
    const existingTitle = await prisma.title.findUnique({
      where: { isbn: normalizedISBN }
    })

    if (existingTitle) {
      throw new BusinessRuleError('ISBN already exists in catalog', 'DUPLICATE_ISBN')
    }

    // Validate series exists if provided
    if (data.seriesId) {
      const series = await prisma.series.findUnique({
        where: { id: data.seriesId }
      })

      if (!series) {
        throw new ValidationError('Series not found', 'seriesId')
      }
    }

    // Create title with transaction
    return await prisma.$transaction(async (tx) => {
      const title = await tx.title.create({
        data: {
          ...data,
          isbn: normalizedISBN,
          status: 'ACTIVE'
        },
        include: {
          series: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create initial price history record
      await tx.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: data.rrp,
          unitCost: data.unitCost,
          tradeDiscount: data.tradeDiscount,
          effectiveFrom: new Date(),
          reason: 'Initial pricing on title creation'
        }
      })

      return title
    })
  }

  // Update title with business rule validation
  static async updateTitle(id: string, data: UpdateTitleData): Promise<any> {
    // Get existing title
    const existingTitle = await prisma.title.findUnique({
      where: { id },
      include: {
        inventory: true,
        stockMovements: true
      }
    })

    if (!existingTitle) {
      throw new ValidationError('Title not found')
    }

    // Apply business rules validation
    await this.validatePublishingRules(data)

    // Special rules for updates
    if (data.isbn && data.isbn !== existingTitle.isbn) {
      const normalizedISBN = this.normalizeISBN(data.isbn)

      // Check if new ISBN is already used
      const duplicateTitle = await prisma.title.findUnique({
        where: { isbn: normalizedISBN }
      })

      if (duplicateTitle) {
        throw new BusinessRuleError('ISBN already exists in catalog', 'DUPLICATE_ISBN')
      }

      data.isbn = normalizedISBN
    }

    // Validate status changes
    if (data.status && data.status !== existingTitle.status) {
      this.validateStatusChange(existingTitle.status, data.status, existingTitle)
    }

    // Update title with transaction
    return await prisma.$transaction(async (tx) => {
      const updatedTitle = await tx.title.update({
        where: { id },
        data,
        include: {
          series: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create price history record if pricing changed
      if (data.rrp || data.unitCost || data.tradeDiscount) {
        await tx.priceHistory.create({
          data: {
            titleId: id,
            rrp: data.rrp || existingTitle.rrp,
            unitCost: data.unitCost || existingTitle.unitCost,
            tradeDiscount: data.tradeDiscount !== undefined ? data.tradeDiscount : existingTitle.tradeDiscount,
            effectiveFrom: new Date(),
            reason: 'Pricing update'
          }
        })
      }

      return updatedTitle
    })
  }

  // Business rule helpers
  private static getMinimumPages(format: string): number {
    const minimums = {
      PAPERBACK: 16,
      HARDCOVER: 32,
      DIGITAL: 1,
      AUDIOBOOK: 1
    }
    return minimums[format as keyof typeof minimums] || 1
  }

  private static getMaximumPages(format: string): number {
    const maximums = {
      PAPERBACK: 2000,
      HARDCOVER: 3000,
      DIGITAL: 10000,
      AUDIOBOOK: 10000
    }
    return maximums[format as keyof typeof maximums] || 10000
  }

  private static getMaximumWeight(format: string): number {
    const maximums = {
      PAPERBACK: 2000, // 2kg
      HARDCOVER: 5000, // 5kg
      DIGITAL: 0,
      AUDIOBOOK: 500 // Physical packaging weight
    }
    return maximums[format as keyof typeof maximums] || 5000
  }

  private static getMinimumPrintRun(format: string): number {
    const minimums = {
      PAPERBACK: 500,
      HARDCOVER: 250,
      DIGITAL: 1,
      AUDIOBOOK: 100
    }
    return minimums[format as keyof typeof minimums] || 1
  }

  private static validateStatusChange(
    currentStatus: string,
    newStatus: string,
    title: any
  ): void {
    // Rule: Cannot reactivate a title that has been discontinued if it has no inventory
    if (currentStatus === 'DISCONTINUED' && newStatus === 'ACTIVE') {
      const totalStock = title.inventory.reduce(
        (sum: number, inv: any) => sum + inv.currentStock,
        0
      )

      if (totalStock === 0) {
        throw new BusinessRuleError(
          'Cannot reactivate discontinued title with no inventory',
          'NO_INVENTORY_REACTIVATION'
        )
      }
    }

    // Rule: Cannot discontinue a title with recent stock movements (within 30 days)
    if (currentStatus === 'ACTIVE' && newStatus === 'DISCONTINUED') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentMovements = title.stockMovements.filter(
        (movement: any) => movement.movementDate > thirtyDaysAgo
      )

      if (recentMovements.length > 0) {
        throw new BusinessRuleError(
          'Cannot discontinue title with recent stock movements (within 30 days)',
          'RECENT_ACTIVITY_DISCONTINUATION'
        )
      }
    }
  }

  // Utility functions
  static normalizeISBN(isbn: string): string {
    return isbn.replace(/[-\s]/g, '').toUpperCase()
  }

  static validateISBN(isbn: string): boolean {
    const cleanISBN = isbn.replace(/[-\s]/g, '')
    return isISBN(cleanISBN)
  }

  static formatISBN(isbn: string): string {
    const cleanISBN = isbn.replace(/[-\s]/g, '')

    if (cleanISBN.length === 10) {
      return `${cleanISBN.slice(0, 1)}-${cleanISBN.slice(1, 4)}-${cleanISBN.slice(4, 9)}-${cleanISBN.slice(9)}`
    } else if (cleanISBN.length === 13) {
      return `${cleanISBN.slice(0, 3)}-${cleanISBN.slice(3, 4)}-${cleanISBN.slice(4, 6)}-${cleanISBN.slice(6, 12)}-${cleanISBN.slice(12)}`
    }

    return isbn // Return as-is if format is unknown
  }
}