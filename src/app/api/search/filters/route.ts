import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  searchTitles,
  SearchFilters
} from '@/services/searchService'

const filtersQuerySchema = z.object({
  // Current search context to get relevant filters
  q: z.string().optional(),

  // Current filters to exclude from available options
  format: z.string().transform(val => val.split(',')).optional(),
  category: z.string().transform(val => val.split(',')).optional(),
  subcategory: z.string().transform(val => val.split(',')).optional(),
  publisher: z.string().transform(val => val.split(',')).optional(),
  seriesId: z.string().transform(val => val.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))).optional(),
  status: z.string().transform(val => val.split(',')).optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)

    const validatedQuery = filtersQuerySchema.parse(query)

    // Build current filters context
    const currentFilters: SearchFilters = {}

    if (validatedQuery.format) currentFilters.format = validatedQuery.format
    if (validatedQuery.category) currentFilters.category = validatedQuery.category
    if (validatedQuery.subcategory) currentFilters.subcategory = validatedQuery.subcategory
    if (validatedQuery.publisher) currentFilters.publisher = validatedQuery.publisher
    if (validatedQuery.seriesId) currentFilters.seriesId = validatedQuery.seriesId
    if (validatedQuery.status) currentFilters.status = validatedQuery.status

    // Get search results with current context to determine available filters
    const searchResults = await searchTitles({
      query: validatedQuery.q || '',
      filters: currentFilters,
      pagination: { page: 1, limit: 1 } // We only need the filter options
    })

    return NextResponse.json({
      data: searchResults.filters,
      meta: {
        query: validatedQuery.q || '',
        currentFilters: currentFilters
      }
    })

  } catch (error) {
    console.error('GET /api/search/filters error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid filter parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Filter service error' },
      { status: 500 }
    )
  }
}