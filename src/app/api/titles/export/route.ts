import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'
import { Parser } from 'json2csv'

/**
 * GET /api/titles/export
 *
 * Export titles to CSV format
 *
 * Query Parameters (same as GET /api/titles for filtering):
 * - search: string (searches title, author, ISBN)
 * - format: Format enum (PAPERBACK, HARDCOVER, DIGITAL, AUDIOBOOK)
 * - seriesId: number
 * - category: string
 * - publisher: string
 * - sortBy: 'title' | 'author' | 'publicationDate' | 'createdAt' (default: 'title')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 *
 * Returns: CSV file download
 *
 * Errors:
 * - 401: Unauthorized
 * - 403: Forbidden
 * - 500: Internal server error
 */
async function exportTitlesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Parse filters (same as list endpoint)
    const search = searchParams.get('search') || undefined
    const format = searchParams.get('format') as Format | undefined
    const seriesId = searchParams.get('seriesId')
      ? parseInt(searchParams.get('seriesId')!)
      : undefined
    const category = searchParams.get('category') || undefined
    const publisher = searchParams.get('publisher') || undefined

    // Parse sorting
    const sortBy = (searchParams.get('sortBy') || 'title') as 'title' | 'author' | 'publicationDate' | 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'

    // Fetch all titles (no pagination for export)
    const result = await titleService.list({
      page: 1,
      limit: 10000, // Large limit to export all
      search,
      format,
      seriesId,
      category,
      publisher,
      sortBy,
      sortOrder
    })

    // Define CSV fields
    const fields = [
      { label: 'ISBN', value: 'isbn' },
      { label: 'Title', value: 'title' },
      { label: 'Author', value: 'author' },
      { label: 'Format', value: 'format' },
      { label: 'RRP', value: (row: any) => row.rrp.toString() },
      { label: 'Unit Cost', value: (row: any) => row.unitCost.toString() },
      { label: 'Trade Discount', value: (row: any) => row.tradeDiscount?.toString() || '' },
      { label: 'Publisher', value: 'publisher' },
      { label: 'Publication Date', value: (row: any) => row.publicationDate ? new Date(row.publicationDate).toISOString().split('T')[0] : '' },
      { label: 'Page Count', value: 'pageCount' },
      { label: 'Category', value: 'category' },
      { label: 'Subcategory', value: 'subcategory' },
      { label: 'Description', value: 'description' },
      { label: 'Dimensions', value: 'dimensions' },
      { label: 'Weight', value: 'weight' },
      { label: 'Binding Type', value: 'bindingType' },
      { label: 'Cover Finish', value: 'coverFinish' },
      { label: 'Royalty Rate', value: (row: any) => row.royaltyRate?.toString() || '' },
      { label: 'Royalty Threshold', value: 'royaltyThreshold' },
      { label: 'Print Run Size', value: 'printRunSize' },
      { label: 'Reprint Threshold', value: 'reprintThreshold' },
      { label: 'Keywords', value: 'keywords' },
      { label: 'Language', value: 'language' },
      { label: 'Territory Rights', value: 'territoryRights' },
      { label: 'Series', value: (row: any) => row.series?.name || '' }
    ]

    // Generate CSV
    const parser = new Parser({ fields })
    const csv = parser.parse(result.data)

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `titles-export-${timestamp}.csv`

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error exporting titles:', error)
    return NextResponse.json(
      {
        error: 'Failed to export titles',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Apply middleware: authentication and authorization
export const GET = requirePermission('title:read', exportTitlesHandler)
