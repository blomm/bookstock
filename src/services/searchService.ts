import { PrismaClient, Prisma, Title, Series } from '@prisma/client'

const prisma = new PrismaClient()

// Allow dependency injection for testing
let dbClient = prisma

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Search interfaces
export interface SearchQuery {
  query?: string
  filters?: SearchFilters
  pagination?: {
    page?: number
    limit?: number
  }
  sorting?: {
    field?: 'relevance' | 'title' | 'author' | 'publicationDate' | 'rrp' | 'createdAt'
    direction?: 'asc' | 'desc'
  }
}

export interface SearchFilters {
  format?: string[]
  category?: string[]
  subcategory?: string[]
  publisher?: string[]
  seriesId?: number[]
  status?: string[]
  priceRange?: {
    min?: number
    max?: number
  }
  publicationDateRange?: {
    start?: Date
    end?: Date
  }
  isActive?: boolean
  hasInventory?: boolean
}

export interface SearchResult {
  titles: TitleWithSearchScore[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: SearchFilterOptions
  searchMeta: {
    query: string
    executionTime: number
    totalMatches: number
  }
}

export interface TitleWithSearchScore extends Title {
  series?: Series
  searchScore?: number
  matchReasons?: string[]
  _count?: {
    inventory: number
  }
}

export interface SearchFilterOptions {
  availableFormats: string[]
  availableCategories: string[]
  availableSubcategories: string[]
  availablePublishers: string[]
  availableSeries: Array<{ id: number; name: string }>
  priceRange: {
    min: number
    max: number
  }
  publicationDateRange: {
    earliest: Date
    latest: Date
  }
}

// Search functions
export async function searchTitles(searchQuery: SearchQuery): Promise<SearchResult> {
  const startTime = Date.now()

  const {
    query = '',
    filters = {},
    pagination = { page: 1, limit: 50 },
    sorting = { field: 'relevance', direction: 'desc' }
  } = searchQuery

  const { page = 1, limit = 50 } = pagination
  const offset = (page - 1) * limit

  // Build where clause for search
  const where = buildSearchWhereClause(query, filters)

  // Build order by clause
  const orderBy = buildOrderByClause(sorting.field, sorting.direction, query)

  // Execute search with pagination
  const [titles, total, filterOptions] = await Promise.all([
    dbClient.title.findMany({
      where,
      include: {
        series: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            inventory: true
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    }),
    dbClient.title.count({ where }),
    getSearchFilterOptions(filters)
  ])

  // Calculate search scores and match reasons for each title
  const titlesWithScores = titles.map(title => ({
    ...title,
    ...calculateSearchScore(title, query),
  }))

  // Re-sort by relevance if that's the sort field
  const finalTitles = sorting.field === 'relevance' && query
    ? titlesWithScores.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0))
    : titlesWithScores

  const executionTime = Date.now() - startTime

  return {
    titles: finalTitles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    filters: filterOptions,
    searchMeta: {
      query,
      executionTime,
      totalMatches: total
    }
  }
}

function buildSearchWhereClause(query: string, filters: SearchFilters): Prisma.TitleWhereInput {
  const where: Prisma.TitleWhereInput = {}
  const andConditions: Prisma.TitleWhereInput[] = []

  // Full-text search conditions
  if (query && query.trim()) {
    const searchTerms = query.trim().split(/\s+/)
    const searchConditions: Prisma.TitleWhereInput[] = []

    // Search across multiple fields
    for (const term of searchTerms) {
      searchConditions.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { author: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { keywords: { contains: term, mode: 'insensitive' } },
          { publisher: { contains: term, mode: 'insensitive' } },
          { isbn: { contains: term.replace(/[-\s]/g, '') } },
          { series: { name: { contains: term, mode: 'insensitive' } } }
        ]
      })
    }

    andConditions.push({ AND: searchConditions })
  }

  // Format filter
  if (filters.format && filters.format.length > 0) {
    andConditions.push({
      format: { in: filters.format as any[] }
    })
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
    andConditions.push({
      category: { in: filters.category }
    })
  }

  // Subcategory filter
  if (filters.subcategory && filters.subcategory.length > 0) {
    andConditions.push({
      subcategory: { in: filters.subcategory }
    })
  }

  // Publisher filter
  if (filters.publisher && filters.publisher.length > 0) {
    andConditions.push({
      publisher: { in: filters.publisher }
    })
  }

  // Series filter
  if (filters.seriesId && filters.seriesId.length > 0) {
    andConditions.push({
      seriesId: { in: filters.seriesId }
    })
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    andConditions.push({
      status: { in: filters.status as any[] }
    })
  }

  // Price range filter
  if (filters.priceRange) {
    const priceConditions: Prisma.TitleWhereInput = {}
    if (filters.priceRange.min !== undefined) {
      priceConditions.rrp = { gte: filters.priceRange.min }
    }
    if (filters.priceRange.max !== undefined) {
      priceConditions.rrp = {
        ...priceConditions.rrp,
        lte: filters.priceRange.max
      }
    }
    andConditions.push(priceConditions)
  }

  // Publication date range filter
  if (filters.publicationDateRange) {
    const dateConditions: Prisma.TitleWhereInput = {}
    if (filters.publicationDateRange.start) {
      dateConditions.publicationDate = { gte: filters.publicationDateRange.start }
    }
    if (filters.publicationDateRange.end) {
      dateConditions.publicationDate = {
        ...dateConditions.publicationDate,
        lte: filters.publicationDateRange.end
      }
    }
    andConditions.push(dateConditions)
  }

  // Active status filter
  if (filters.isActive !== undefined) {
    andConditions.push({
      status: filters.isActive ? 'ACTIVE' : { not: 'ACTIVE' }
    })
  }

  // Inventory filter
  if (filters.hasInventory) {
    andConditions.push({
      inventory: {
        some: {
          currentStock: { gt: 0 }
        }
      }
    })
  }

  if (andConditions.length > 0) {
    where.AND = andConditions
  }

  return where
}

function buildOrderByClause(
  field: string = 'relevance',
  direction: string = 'desc',
  query?: string
): Prisma.TitleOrderByWithRelationInput | Prisma.TitleOrderByWithRelationInput[] {
  // For relevance scoring, we'll handle sorting in memory after calculating scores
  if (field === 'relevance' && query) {
    return { createdAt: 'desc' } // Default fallback for database query
  }

  const orderDirection = direction === 'desc' ? 'desc' : 'asc'

  switch (field) {
    case 'title':
      return { title: orderDirection }
    case 'author':
      return { author: orderDirection }
    case 'publicationDate':
      return { publicationDate: orderDirection }
    case 'rrp':
      return { rrp: orderDirection }
    case 'createdAt':
      return { createdAt: orderDirection }
    default:
      return { title: 'asc' }
  }
}

function calculateSearchScore(title: Title, query: string): {
  searchScore: number
  matchReasons: string[]
} {
  if (!query || !query.trim()) {
    return { searchScore: 0, matchReasons: [] }
  }

  const searchTerms = query.toLowerCase().trim().split(/\s+/)
  let score = 0
  const matchReasons: string[] = []
  
  // Check for ISBN match first (highest priority)
  const normalizedQuery = query.replace(/[-\s]/g, '').toLowerCase()
  const normalizedISBN = title.isbn.replace(/[-\s]/g, '').toLowerCase()
  
  if (normalizedISBN.includes(normalizedQuery)) {
    score += 500  // Very high weight for ISBN matches
    matchReasons.push(`ISBN matches "${query}"`)
    return { searchScore: score, matchReasons } // Return early for ISBN matches
  }

  for (const term of searchTerms) {
    // Title matches (high weight)
    if (title.title.toLowerCase().includes(term)) {
      score += 100
      matchReasons.push(`Title contains "${term}"`)
    }

    // Author matches (high weight)
    if (title.author.toLowerCase().includes(term)) {
      score += 80
      matchReasons.push(`Author contains "${term}"`)
    }

    // Publisher matches (medium weight)
    if (title.publisher && title.publisher.toLowerCase().includes(term)) {
      score += 50
      matchReasons.push(`Publisher contains "${term}"`)
    }

    // Description matches (lower weight)
    if (title.description && title.description.toLowerCase().includes(term)) {
      score += 30
      matchReasons.push(`Description contains "${term}"`)
    }

    // Keywords matches (lower weight)
    if (title.keywords && title.keywords.toLowerCase().includes(term)) {
      score += 40
      matchReasons.push(`Keywords contain "${term}"`)
    }
  }

  // Boost score for exact phrase matches
  const fullQuery = query.toLowerCase()
  if (title.title.toLowerCase().includes(fullQuery)) {
    score += 200
    matchReasons.push(`Title contains exact phrase "${query}"`)
  }

  if (title.author.toLowerCase().includes(fullQuery)) {
    score += 150
    matchReasons.push(`Author contains exact phrase "${query}"`)
  }

  return { searchScore: score, matchReasons }
}

async function getSearchFilterOptions(currentFilters: SearchFilters): Promise<SearchFilterOptions> {
  // Get all available filter options (excluding current filters to show what's available)
  const [
    formats,
    categories,
    subcategories,
    publishers,
    series,
    priceStats,
    dateStats
  ] = await Promise.all([
    // Available formats
    dbClient.title.findMany({
      select: { format: true },
      distinct: ['format'],
      orderBy: { format: 'asc' }
    }),

    // Available categories
    dbClient.title.findMany({
      select: { category: true },
      where: { category: { not: null } },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    }),

    // Available subcategories
    dbClient.title.findMany({
      select: { subcategory: true },
      where: { subcategory: { not: null } },
      distinct: ['subcategory'],
      orderBy: { subcategory: 'asc' }
    }),

    // Available publishers
    dbClient.title.findMany({
      select: { publisher: true },
      where: { publisher: { not: null } },
      distinct: ['publisher'],
      orderBy: { publisher: 'asc' }
    }),

    // Available series
    dbClient.series.findMany({
      select: { id: true, name: true },
      where: { isActive: true },
      orderBy: { name: 'asc' }
    }),

    // Price range stats
    dbClient.title.aggregate({
      _min: { rrp: true },
      _max: { rrp: true }
    }),

    // Publication date range stats
    dbClient.title.aggregate({
      _min: { publicationDate: true },
      _max: { publicationDate: true }
    })
  ])

  return {
    availableFormats: formats.map(f => f.format),
    availableCategories: categories.map(c => c.category).filter(Boolean),
    availableSubcategories: subcategories.map(s => s.subcategory).filter(Boolean),
    availablePublishers: publishers.map(p => p.publisher).filter(Boolean),
    availableSeries: series,
    priceRange: {
      min: Number(priceStats._min.rrp || 0),
      max: Number(priceStats._max.rrp || 999)
    },
    publicationDateRange: {
      earliest: dateStats._min.publicationDate || new Date('1900-01-01'),
      latest: dateStats._max.publicationDate || new Date()
    }
  }
}

// Advanced search functions
export async function searchTitlesByISBN(isbn: string): Promise<Title[]> {
  const normalizedISBN = isbn.replace(/[-\s]/g, '')

  return await dbClient.title.findMany({
    where: {
      isbn: {
        contains: normalizedISBN
      }
    },
    include: {
      series: true
    }
  })
}

export async function suggestSearchTerms(query: string, limit: number = 10): Promise<string[]> {
  if (!query || query.length < 2) {
    return []
  }

  const suggestions = new Set<string>()

  // Get title suggestions
  const titles = await dbClient.title.findMany({
    where: {
      title: {
        contains: query,
        mode: 'insensitive'
      }
    },
    select: { title: true },
    take: limit
  })

  titles.forEach(title => {
    const words = title.title.split(/\s+/)
    words.forEach(word => {
      if (word.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(word)
      }
    })
  })

  // Get author suggestions
  const authors = await dbClient.title.findMany({
    where: {
      author: {
        contains: query,
        mode: 'insensitive'
      }
    },
    select: { author: true },
    distinct: ['author'],
    take: limit
  })

  authors.forEach(author => {
    const words = author.author.split(/\s+/)
    words.forEach(word => {
      if (word.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(word)
      }
    })
  })

  return Array.from(suggestions).slice(0, limit)
}

export async function getPopularSearches(limit: number = 10): Promise<Array<{
  term: string
  count: number
}>> {
  // This would typically come from a search analytics table
  // For now, return popular categories and publishers as "searches"
  const [categories, publishers] = await Promise.all([
    dbClient.title.groupBy({
      by: ['category'],
      where: { category: { not: null } },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
      take: limit / 2
    }),
    dbClient.title.groupBy({
      by: ['publisher'],
      where: { publisher: { not: null } },
      _count: { publisher: true },
      orderBy: { _count: { publisher: 'desc' } },
      take: limit / 2
    })
  ])

  const popular = [
    ...categories.map(c => ({ term: c.category!, count: c._count.category })),
    ...publishers.map(p => ({ term: p.publisher!, count: p._count.publisher }))
  ]

  return popular.sort((a, b) => b.count - a.count).slice(0, limit)
}

// Performance optimization functions
export async function warmSearchCache(): Promise<void> {
  // Pre-warm commonly accessed filter options
  await getSearchFilterOptions({})
}

export async function getSearchPerformanceStats(): Promise<{
  totalTitles: number
  indexedFields: string[]
  recommendedIndexes: string[]
}> {
  const totalTitles = await dbClient.title.count()

  return {
    totalTitles,
    indexedFields: [
      'title', 'author', 'isbn', 'category', 'publisher', 'format', 'status'
    ],
    recommendedIndexes: [
      'title_gin_index', 'author_gin_index', 'isbn_index',
      'category_index', 'publisher_index', 'composite_search_index'
    ]
  }
}