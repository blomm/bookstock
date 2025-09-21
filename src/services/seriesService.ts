import { PrismaClient, Prisma, Series } from '@prisma/client'

const prisma = new PrismaClient()

// Types for series operations
export interface CreateSeriesData {
  name: string
  description?: string
  parentId?: number
  sortOrder?: number
  level?: number
  isActive?: boolean
}

export interface UpdateSeriesData extends Partial<CreateSeriesData> {}

export interface SeriesWithRelations extends Series {
  parent?: Series
  children?: Series[]
  titles?: any[]
  _count?: {
    titles: number
    children: number
  }
}

export interface SeriesAnalytics {
  totalTitles: number
  activeTitles: number
  completionRate: number
  averageRrp?: number
  averageUnitCost?: number
  totalInventory?: number
  totalSales?: number
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

// Validation functions
export function validateSeriesName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Series name is required', 'name')
  }
  if (name.length > 255) {
    throw new ValidationError('Series name must be 255 characters or less', 'name')
  }
}

export function validateSeriesHierarchy(parentId?: number, level?: number): void {
  if (parentId && !level) {
    throw new ValidationError('Level must be specified when parentId is provided', 'level')
  }
  if (level && level < 0) {
    throw new ValidationError('Level must be non-negative', 'level')
  }
  if (level && level > 10) {
    throw new ValidationError('Maximum hierarchy level is 10', 'level')
  }
}

export function validateSortOrder(sortOrder?: number): void {
  if (sortOrder && sortOrder < 0) {
    throw new ValidationError('Sort order must be non-negative', 'sortOrder')
  }
}

// CRUD Operations
export async function createSeries(data: CreateSeriesData): Promise<Series> {
  validateSeriesName(data.name)
  validateSeriesHierarchy(data.parentId, data.level)
  validateSortOrder(data.sortOrder)

  // If parentId is provided, verify parent exists and calculate level
  if (data.parentId) {
    const parent = await prisma.series.findUnique({
      where: { id: data.parentId }
    })

    if (!parent) {
      throw new BusinessRuleError('Parent series not found', 'PARENT_NOT_FOUND')
    }

    // Auto-calculate level if not provided
    if (!data.level) {
      data.level = (parent.level || 0) + 1
    }
  }

  // Auto-assign sort order if not provided
  if (!data.sortOrder && data.parentId) {
    const maxSortOrder = await prisma.series.aggregate({
      where: { parentId: data.parentId },
      _max: { sortOrder: true }
    })
    data.sortOrder = (maxSortOrder._max.sortOrder || 0) + 1
  }

  try {
    return await prisma.series.create({
      data: {
        ...data,
        level: data.level || 0,
        sortOrder: data.sortOrder || 0
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ValidationError('Series name must be unique', 'name')
      }
    }
    throw error
  }
}

export async function getSeries(
  id: number,
  options: {
    includeTitles?: boolean
    includeChildren?: boolean
    includeParent?: boolean
    includeAnalytics?: boolean
  } = {}
): Promise<SeriesWithRelations> {
  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      parent: options.includeParent,
      children: options.includeChildren ? {
        orderBy: { sortOrder: 'asc' }
      } : false,
      titles: options.includeTitles,
      _count: options.includeAnalytics ? {
        select: {
          titles: true,
          children: true
        }
      } : false
    }
  })

  if (!series) {
    throw new BusinessRuleError('Series not found', 'NOT_FOUND')
  }

  return series
}

export async function getAllSeries(options: {
  includeInactive?: boolean
  parentId?: number | null
  level?: number
  page?: number
  limit?: number
  orderBy?: 'name' | 'createdAt' | 'sortOrder'
  orderDirection?: 'asc' | 'desc'
} = {}): Promise<{
  series: SeriesWithRelations[]
  total: number
  page: number
  totalPages: number
}> {
  const {
    includeInactive = false,
    parentId,
    level,
    page = 1,
    limit = 50,
    orderBy = 'name',
    orderDirection = 'asc'
  } = options

  const where: Prisma.SeriesWhereInput = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(level !== undefined ? { level } : {})
  }

  const orderByClause = {
    [orderBy]: orderDirection
  }

  const [series, total] = await Promise.all([
    prisma.series.findMany({
      where,
      orderBy: orderByClause,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            titles: true,
            children: true
          }
        }
      }
    }),
    prisma.series.count({ where })
  ])

  return {
    series,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  }
}

export async function updateSeries(id: number, data: UpdateSeriesData): Promise<Series> {
  if (data.name) {
    validateSeriesName(data.name)
  }
  validateSeriesHierarchy(data.parentId, data.level)
  validateSortOrder(data.sortOrder)

  // Check if series exists
  const existingSeries = await prisma.series.findUnique({
    where: { id }
  })

  if (!existingSeries) {
    throw new BusinessRuleError('Series not found', 'NOT_FOUND')
  }

  // If changing parent, validate the new parent exists and prevent circular references
  if (data.parentId !== undefined) {
    if (data.parentId === id) {
      throw new BusinessRuleError('Series cannot be its own parent', 'CIRCULAR_REFERENCE')
    }

    if (data.parentId) {
      const parent = await prisma.series.findUnique({
        where: { id: data.parentId }
      })

      if (!parent) {
        throw new BusinessRuleError('Parent series not found', 'PARENT_NOT_FOUND')
      }

      // Check for circular reference by following parent chain
      const isCircular = await checkCircularReference(data.parentId, id)
      if (isCircular) {
        throw new BusinessRuleError('Circular reference detected', 'CIRCULAR_REFERENCE')
      }

      // Auto-calculate level if not provided
      if (!data.level) {
        data.level = (parent.level || 0) + 1
      }
    }
  }

  try {
    return await prisma.series.update({
      where: { id },
      data
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ValidationError('Series name must be unique', 'name')
      }
    }
    throw error
  }
}

export async function deleteSeries(id: number, options: { force?: boolean } = {}): Promise<void> {
  const series = await getSeries(id, { includeChildren: true })

  // Check if series has children
  if (series.children && series.children.length > 0) {
    if (!options.force) {
      throw new BusinessRuleError(
        'Cannot delete series with child series. Use force option to proceed.',
        'HAS_CHILDREN'
      )
    }
  }

  // Check if series has titles
  const titleCount = await prisma.title.count({
    where: { seriesId: id }
  })

  if (titleCount > 0) {
    throw new BusinessRuleError(
      'Cannot delete series with associated titles',
      'HAS_TITLES'
    )
  }

  await prisma.series.delete({
    where: { id }
  })
}

// Hierarchy management functions
async function checkCircularReference(parentId: number, seriesId: number): Promise<boolean> {
  let currentParentId = parentId
  const visited = new Set<number>()

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return true // Circular reference detected
    }

    if (currentParentId === seriesId) {
      return true // Direct circular reference
    }

    visited.add(currentParentId)

    const parent = await prisma.series.findUnique({
      where: { id: currentParentId },
      select: { parentId: true }
    })

    currentParentId = parent?.parentId || 0
  }

  return false
}

export async function reorderSeries(parentId: number | null, seriesOrders: { id: number, sortOrder: number }[]): Promise<void> {
  const updates = seriesOrders.map(({ id, sortOrder }) =>
    prisma.series.update({
      where: { id },
      data: { sortOrder }
    })
  )

  await prisma.$transaction(updates)
}

export async function moveSeries(seriesId: number, newParentId: number | null, newSortOrder?: number): Promise<Series> {
  // Validate the move
  if (newParentId === seriesId) {
    throw new BusinessRuleError('Series cannot be its own parent', 'CIRCULAR_REFERENCE')
  }

  if (newParentId) {
    const isCircular = await checkCircularReference(newParentId, seriesId)
    if (isCircular) {
      throw new BusinessRuleError('Circular reference detected', 'CIRCULAR_REFERENCE')
    }
  }

  // Calculate new level and sort order
  let newLevel = 0
  let finalSortOrder = newSortOrder

  if (newParentId) {
    const parent = await getSeries(newParentId)
    newLevel = (parent.level || 0) + 1

    if (!finalSortOrder) {
      const maxSortOrder = await prisma.series.aggregate({
        where: { parentId: newParentId },
        _max: { sortOrder: true }
      })
      finalSortOrder = (maxSortOrder._max.sortOrder || 0) + 1
    }
  }

  return await prisma.series.update({
    where: { id: seriesId },
    data: {
      parentId: newParentId,
      level: newLevel,
      sortOrder: finalSortOrder || 0
    }
  })
}

// Analytics functions
export async function getSeriesAnalytics(seriesId: number): Promise<SeriesAnalytics> {
  const [titleStats, inventoryStats, salesStats] = await Promise.all([
    // Title statistics
    prisma.title.aggregate({
      where: { seriesId },
      _count: true,
      _avg: {
        rrp: true,
        unitCost: true
      }
    }),

    // Active title count
    prisma.title.count({
      where: {
        seriesId,
        status: 'ACTIVE'
      }
    }),

    // Inventory totals
    prisma.inventory.aggregate({
      where: {
        title: { seriesId }
      },
      _sum: {
        currentStock: true
      }
    })
  ])

  // Sales totals (negative stock movements)
  const salesTotal = await prisma.stockMovement.aggregate({
    where: {
      title: { seriesId },
      movementType: {
        in: ['ONLINE_SALES', 'UK_TRADE_SALES', 'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES']
      }
    },
    _sum: {
      quantity: true
    }
  })

  const totalTitles = titleStats._count
  const activeTitles = inventoryStats
  const completionRate = totalTitles > 0 ? (activeTitles / totalTitles) * 100 : 0

  return {
    totalTitles,
    activeTitles,
    completionRate,
    averageRrp: titleStats._avg.rrp ? Number(titleStats._avg.rrp) : undefined,
    averageUnitCost: titleStats._avg.unitCost ? Number(titleStats._avg.unitCost) : undefined,
    totalInventory: inventoryStats._sum.currentStock || 0,
    totalSales: Math.abs(salesTotal._sum.quantity || 0)
  }
}

export async function getHierarchyAnalytics(parentSeriesId: number): Promise<SeriesAnalytics> {
  const [titleStats, activeCount, inventoryStats, salesStats] = await Promise.all([
    // Title statistics across hierarchy
    prisma.title.aggregate({
      where: {
        series: {
          OR: [
            { id: parentSeriesId },
            { parentId: parentSeriesId }
          ]
        }
      },
      _count: true,
      _avg: {
        rrp: true,
        unitCost: true
      }
    }),

    // Active title count across hierarchy
    prisma.title.count({
      where: {
        series: {
          OR: [
            { id: parentSeriesId },
            { parentId: parentSeriesId }
          ]
        },
        status: 'ACTIVE'
      }
    }),

    // Inventory totals across hierarchy
    prisma.inventory.aggregate({
      where: {
        title: {
          series: {
            OR: [
              { id: parentSeriesId },
              { parentId: parentSeriesId }
            ]
          }
        }
      },
      _sum: {
        currentStock: true
      }
    }),

    // Sales totals across hierarchy
    prisma.stockMovement.aggregate({
      where: {
        title: {
          series: {
            OR: [
              { id: parentSeriesId },
              { parentId: parentSeriesId }
            ]
          }
        },
        movementType: {
          in: ['ONLINE_SALES', 'UK_TRADE_SALES', 'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES']
        }
      },
      _sum: {
        quantity: true
      }
    })
  ])

  const totalTitles = titleStats._count
  const activeTitles = activeCount
  const completionRate = totalTitles > 0 ? (activeTitles / totalTitles) * 100 : 0

  return {
    totalTitles,
    activeTitles,
    completionRate,
    averageRrp: titleStats._avg.rrp ? Number(titleStats._avg.rrp) : undefined,
    averageUnitCost: titleStats._avg.unitCost ? Number(titleStats._avg.unitCost) : undefined,
    totalInventory: inventoryStats._sum.currentStock || 0,
    totalSales: Math.abs(salesStats._sum.quantity || 0)
  }
}

// Series-to-title relationship management
export async function addTitleToSeries(titleId: number, seriesId: number): Promise<void> {
  // Verify both title and series exist
  const [title, series] = await Promise.all([
    prisma.title.findUnique({ where: { id: titleId } }),
    prisma.series.findUnique({ where: { id: seriesId } })
  ])

  if (!title) {
    throw new BusinessRuleError('Title not found', 'TITLE_NOT_FOUND')
  }

  if (!series) {
    throw new BusinessRuleError('Series not found', 'SERIES_NOT_FOUND')
  }

  await prisma.title.update({
    where: { id: titleId },
    data: { seriesId }
  })
}

export async function removeTitleFromSeries(titleId: number): Promise<void> {
  const title = await prisma.title.findUnique({ where: { id: titleId } })

  if (!title) {
    throw new BusinessRuleError('Title not found', 'TITLE_NOT_FOUND')
  }

  await prisma.title.update({
    where: { id: titleId },
    data: { seriesId: null }
  })
}

export async function getSeriesTitles(
  seriesId: number,
  options: {
    includeInactive?: boolean
    page?: number
    limit?: number
    orderBy?: 'title' | 'publicationDate' | 'createdAt'
    orderDirection?: 'asc' | 'desc'
  } = {}
) {
  const {
    includeInactive = false,
    page = 1,
    limit = 50,
    orderBy = 'title',
    orderDirection = 'asc'
  } = options

  const where: Prisma.TitleWhereInput = {
    seriesId,
    ...(includeInactive ? {} : { status: 'ACTIVE' })
  }

  const [titles, total] = await Promise.all([
    prisma.title.findMany({
      where,
      orderBy: { [orderBy]: orderDirection },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.title.count({ where })
  ])

  return {
    titles,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  }
}