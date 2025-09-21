import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  suggestSearchTerms,
  getPopularSearches
} from '@/services/searchService'

const suggestionsQuerySchema = z.object({
  q: z.string().min(1, 'Query is required for suggestions'),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)).optional()
})

const popularQuerySchema = z.object({
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)).optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)

    // Check if this is a request for popular searches
    if (searchParams.get('type') === 'popular') {
      const validatedQuery = popularQuerySchema.parse(query)
      const popularSearches = await getPopularSearches(validatedQuery.limit || 10)

      return NextResponse.json({
        data: popularSearches,
        type: 'popular'
      })
    }

    // Handle search suggestions
    const validatedQuery = suggestionsQuerySchema.parse(query)
    const suggestions = await suggestSearchTerms(
      validatedQuery.q,
      validatedQuery.limit || 10
    )

    return NextResponse.json({
      data: suggestions,
      type: 'suggestions',
      query: validatedQuery.q
    })

  } catch (error) {
    console.error('GET /api/search/suggestions error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Suggestions service error' },
      { status: 500 }
    )
  }
}