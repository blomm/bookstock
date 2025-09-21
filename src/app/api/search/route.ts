import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  searchTitles,
  SearchQuery,
  SearchFilters
} from '@/services/searchService'

// Validation schemas
const searchQuerySchema = z.object({
  q: z.string().optional(),
  query: z.string().optional(),

  // Pagination
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 50, 100)).optional(),

  // Sorting
  sortBy: z.enum(['relevance', 'title', 'author', 'publicationDate', 'rrp', 'createdAt']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),

  // Filters
  format: z.string().transform(val => val.split(',')).optional(),
  category: z.string().transform(val => val.split(',')).optional(),
  subcategory: z.string().transform(val => val.split(',')).optional(),
  publisher: z.string().transform(val => val.split(',')).optional(),
  seriesId: z.string().transform(val => val.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))).optional(),
  status: z.string().transform(val => val.split(',')).optional(),

  // Price range
  minPrice: z.string().transform(val => parseFloat(val)).optional(),
  maxPrice: z.string().transform(val => parseFloat(val)).optional(),

  // Date range
  startDate: z.string().transform(val => new Date(val)).optional(),
  endDate: z.string().transform(val => new Date(val)).optional(),

  // Boolean filters
  isActive: z.string().transform(val => val === 'true').optional(),
  hasInventory: z.string().transform(val => val === 'true').optional(),

  // Performance options
  includeFilters: z.string().transform(val => val === 'true').optional(),
  includeScore: z.string().transform(val => val === 'true').optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)

    const validatedQuery = searchQuerySchema.parse(query)

    // Build search query object
    const searchQuery: SearchQuery = {
      query: validatedQuery.q || validatedQuery.query || '',
      pagination: {
        page: validatedQuery.page || 1,
        limit: validatedQuery.limit || 50
      },
      sorting: {
        field: validatedQuery.sortBy || 'relevance',
        direction: validatedQuery.sortDirection || 'desc'
      },
      filters: buildFilters(validatedQuery)
    }

    // Execute search
    const results = await searchTitles(searchQuery)

    // Build response
    const response: any = {
      data: results.titles,
      pagination: results.pagination,
      meta: results.searchMeta
    }

    // Include filters if requested
    if (validatedQuery.includeFilters) {
      response.filters = results.filters
    }

    // Remove search scores if not requested
    if (!validatedQuery.includeScore) {
      response.data = results.titles.map(title => {
        const { searchScore, matchReasons, ...titleWithoutScore } = title
        return titleWithoutScore
      })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('GET /api/search error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid search parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Search service error' },
      { status: 500 }
    )
  }
}

function buildFilters(validatedQuery: any): SearchFilters {
  const filters: SearchFilters = {}

  if (validatedQuery.format && validatedQuery.format.length > 0) {
    filters.format = validatedQuery.format
  }

  if (validatedQuery.category && validatedQuery.category.length > 0) {
    filters.category = validatedQuery.category
  }

  if (validatedQuery.subcategory && validatedQuery.subcategory.length > 0) {
    filters.subcategory = validatedQuery.subcategory
  }

  if (validatedQuery.publisher && validatedQuery.publisher.length > 0) {
    filters.publisher = validatedQuery.publisher
  }

  if (validatedQuery.seriesId && validatedQuery.seriesId.length > 0) {
    filters.seriesId = validatedQuery.seriesId
  }

  if (validatedQuery.status && validatedQuery.status.length > 0) {
    filters.status = validatedQuery.status
  }

  // Price range
  if (validatedQuery.minPrice !== undefined || validatedQuery.maxPrice !== undefined) {
    filters.priceRange = {
      min: validatedQuery.minPrice,
      max: validatedQuery.maxPrice
    }
  }

  // Date range
  if (validatedQuery.startDate || validatedQuery.endDate) {
    filters.publicationDateRange = {
      start: validatedQuery.startDate,
      end: validatedQuery.endDate
    }
  }

  if (validatedQuery.isActive !== undefined) {
    filters.isActive = validatedQuery.isActive
  }

  if (validatedQuery.hasInventory !== undefined) {
    filters.hasInventory = validatedQuery.hasInventory
  }

  return filters
}