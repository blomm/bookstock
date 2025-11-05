// src/services/seriesService.ts

import { prisma } from '@/lib/database'
import { Prisma, Series, SeriesStatus } from '@prisma/client'
import type { CreateSeriesInput, UpdateSeriesInput, SeriesListFilters, BulkUpdateTitlesInput } from '@/lib/validators/series'

/**
 * Series with title count
 */
export interface SeriesWithCount extends Series {
  titleCount: number
}

/**
 * Series with relationships
 */
export interface SeriesWithTitles extends Series {
  titles: Array<{
    id: number
    isbn: string
    title: string
    author: string
    rrp: number
    currentStock?: number
  }>
}

/**
 * Paginated series list response
 */
export interface SeriesListResponse {
  data: SeriesWithCount[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Series metrics aggregation
 */
export interface SeriesMetrics {
  seriesId: number
  titleCount: number
  totalCurrentStock: number
  totalReservedStock: number
  totalAvailableStock: number
  lowStockTitles?: number
}

/**
 * Bulk update result
 */
export interface BulkUpdateResult {
  seriesId: number
  titlesUpdated: number
  updates: Record<string, any>
}

/**
 * Service class for series management operations
 */
export class SeriesService {
  /**
   * Create a new series
   */
  async createSeries(data: CreateSeriesInput): Promise<Series> {
    try {
      return await prisma.series.create({
        data: {
          name: data.name,
          description: data.description || null,
          status: data.status || SeriesStatus.ACTIVE,
          organizationId: data.organizationId,
          createdBy: data.createdBy || null
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('A series with this name already exists in your organization')
        }
      }
      throw error
    }
  }

  /**
   * Get paginated list of series with filters
   */
  async getSeriesList(filters: SeriesListFilters): Promise<SeriesListResponse> {
    const {
      organizationId,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = filters

    // Build where clause
    const where: Prisma.SeriesWhereInput = {
      organizationId
    }

    // Filter by status
    if (status !== undefined) {
      where.status = status
    }

    // Search by name or description
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Build orderBy clause
    const orderBy: Prisma.SeriesOrderByWithRelationInput = {}
    if (sortBy === 'name') {
      orderBy.name = sortOrder
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute queries
    const [series, total] = await Promise.all([
      prisma.series.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { titles: true }
          }
        }
      }),
      prisma.series.count({ where })
    ])

    // Transform to include title count
    const data: SeriesWithCount[] = series.map(s => ({
      ...s,
      titleCount: s._count.titles
    }))

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get series by ID with member titles
   */
  async getSeriesById(seriesId: number, organizationId: string): Promise<SeriesWithTitles> {
    const series = await prisma.series.findFirst({
      where: {
        id: seriesId,
        organizationId
      },
      include: {
        titles: {
          select: {
            id: true,
            isbn: true,
            title: true,
            author: true,
            rrp: true
          },
          orderBy: { title: 'asc' }
        }
      }
    })

    if (!series) {
      throw new Error('Series not found')
    }

    // Convert Decimal to number for rrp
    return {
      ...series,
      titles: series.titles.map(title => ({
        ...title,
        rrp: title.rrp.toNumber()
      }))
    } as SeriesWithTitles
  }

  /**
   * Update series details
   */
  async updateSeries(
    seriesId: number,
    organizationId: string,
    data: UpdateSeriesInput
  ): Promise<Series> {
    // Validate that at least one field is being updated
    if (Object.keys(data).length === 0) {
      throw new Error('No fields to update')
    }

    // Verify series exists and belongs to organization
    const existing = await prisma.series.findFirst({
      where: {
        id: seriesId,
        organizationId
      }
    })

    if (!existing) {
      throw new Error('Series not found')
    }

    try {
      return await prisma.series.update({
        where: { id: seriesId },
        data: {
          name: data.name,
          description: data.description !== undefined ? data.description : undefined,
          status: data.status
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('A series with this name already exists in your organization')
        }
      }
      throw error
    }
  }

  /**
   * Delete a series (hard delete - only allowed if no titles)
   */
  async deleteSeries(seriesId: number, organizationId: string): Promise<void> {
    // Verify series exists and belongs to organization
    const existing = await prisma.series.findFirst({
      where: {
        id: seriesId,
        organizationId
      },
      include: {
        _count: {
          select: { titles: true }
        }
      }
    })

    if (!existing) {
      throw new Error('Series not found')
    }

    // Check if series has any titles
    if (existing._count.titles > 0) {
      throw new Error('Cannot delete series with associated titles. Please remove all titles first or use archive instead.')
    }

    await prisma.series.delete({
      where: { id: seriesId }
    })
  }

  /**
   * Archive a series (soft delete)
   */
  async archiveSeries(seriesId: number, organizationId: string): Promise<Series> {
    // Verify series exists and belongs to organization
    const existing = await prisma.series.findFirst({
      where: {
        id: seriesId,
        organizationId
      }
    })

    if (!existing) {
      throw new Error('Series not found')
    }

    return await prisma.series.update({
      where: { id: seriesId },
      data: { status: SeriesStatus.ARCHIVED }
    })
  }

  /**
   * Get aggregated metrics for a series
   */
  async getSeriesMetrics(seriesId: number, organizationId: string): Promise<SeriesMetrics> {
    // Verify series exists and belongs to organization
    const series = await prisma.series.findFirst({
      where: {
        id: seriesId,
        organizationId
      }
    })

    if (!series) {
      throw new Error('Series not found')
    }

    // Get title count
    const titleCount = await prisma.title.count({
      where: { seriesId }
    })

    // Get inventory aggregations
    const inventoryAggregations = await prisma.inventory.aggregate({
      where: {
        title: { seriesId }
      },
      _sum: {
        currentStock: true,
        reservedStock: true
      }
    })

    const totalCurrentStock = inventoryAggregations._sum.currentStock || 0
    const totalReservedStock = inventoryAggregations._sum.reservedStock || 0
    const totalAvailableStock = totalCurrentStock - totalReservedStock

    // Count low stock titles
    // Note: This is a simplified count - proper comparison would need to be done in application code
    const titlesWithInventory = await prisma.title.findMany({
      where: {
        seriesId,
        lowStockThreshold: { not: null }
      },
      select: {
        id: true,
        lowStockThreshold: true,
        inventory: {
          select: {
            currentStock: true
          }
        }
      }
    })

    const lowStockTitles = titlesWithInventory.filter(title =>
      title.inventory.some(inv => inv.currentStock < (title.lowStockThreshold || 0))
    ).length

    return {
      seriesId,
      titleCount,
      totalCurrentStock,
      totalReservedStock,
      totalAvailableStock,
      lowStockTitles
    }
  }

  /**
   * Bulk update fields across all titles in a series
   */
  async bulkUpdateTitles(
    seriesId: number,
    organizationId: string,
    input: BulkUpdateTitlesInput,
    userId?: string
  ): Promise<BulkUpdateResult> {
    // Verify series exists and belongs to organization
    const series = await prisma.series.findFirst({
      where: {
        id: seriesId,
        organizationId
      }
    })

    if (!series) {
      throw new Error('Series not found')
    }

    // Build update data
    const updateData: Prisma.TitleUpdateInput = {}
    if (input.updates.rrp !== undefined) {
      updateData.rrp = input.updates.rrp
    }
    if (input.updates.lowStockThreshold !== undefined) {
      updateData.lowStockThreshold = input.updates.lowStockThreshold
    }
    if (input.updates.unitCost !== undefined) {
      updateData.unitCost = input.updates.unitCost
    }

    // Perform bulk update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.title.updateMany({
        where: { seriesId },
        data: updateData
      })

      return updateResult.count
    })

    return {
      seriesId,
      titlesUpdated: result,
      updates: input.updates
    }
  }
}

// Export singleton instance
export const seriesService = new SeriesService()
