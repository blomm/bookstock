import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createImportJob,
  parseCSV,
  getImportTemplate,
  getAllImportJobs,
  TitleImportData,
  ImportOptions
} from '@/services/bulkImportService'

// Validation schemas
const importOptionsSchema = z.object({
  useTransaction: z.string().transform(val => val === 'true').optional(),
  validateFirst: z.string().transform(val => val === 'true').optional(),
  continueOnError: z.string().transform(val => val === 'true').optional(),
  batchSize: z.string().transform(val => parseInt(val)).optional(),
  skipDuplicates: z.string().transform(val => val === 'true').optional(),
  updateExisting: z.string().transform(val => val === 'true').optional(),
  dryRun: z.string().transform(val => val === 'true').optional()
})

const querySchema = z.object({
  template: z.string().optional(),
  jobs: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)
    const validatedQuery = querySchema.parse(query)

    // Return CSV template
    if (validatedQuery.template === 'true') {
      const template = getImportTemplate()

      return new NextResponse(template, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="title_import_template.csv"'
        }
      })
    }

    // Return all import jobs
    if (validatedQuery.jobs === 'true') {
      const jobs = getAllImportJobs()
      return NextResponse.json({
        data: jobs,
        total: jobs.length
      })
    }

    // Return API documentation
    return NextResponse.json({
      message: 'Bulk Title Import API',
      endpoints: {
        'POST /api/titles/bulk-import': 'Upload CSV file for bulk import',
        'GET /api/titles/bulk-import?template=true': 'Download CSV template',
        'GET /api/titles/bulk-import?jobs=true': 'List all import jobs',
        'GET /api/titles/bulk-import/[jobId]': 'Get specific import job status',
        'POST /api/titles/bulk-import/[jobId]/cancel': 'Cancel import job',
        'POST /api/titles/bulk-import/[jobId]/retry': 'Retry failed import job',
        'POST /api/titles/bulk-import/[jobId]/rollback': 'Rollback completed import job'
      },
      options: {
        useTransaction: 'boolean - Process entire import as single transaction',
        validateFirst: 'boolean - Validate all data before processing',
        continueOnError: 'boolean - Continue processing after errors',
        batchSize: 'number - Number of titles to process per batch (default: 50)',
        skipDuplicates: 'boolean - Skip titles with duplicate ISBNs',
        updateExisting: 'boolean - Update existing titles instead of skipping',
        dryRun: 'boolean - Validate only, do not create titles'
      }
    })

  } catch (error) {
    console.error('GET /api/titles/bulk-import error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Handle both multipart form data and JSON
    const contentType = request.headers.get('content-type') || ''

    let csvContent: string
    let options: ImportOptions = {}

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      const optionsJson = formData.get('options') as string

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        return NextResponse.json(
          { error: 'File must be CSV format' },
          { status: 400 }
        )
      }

      csvContent = await file.text()

      if (optionsJson) {
        try {
          const parsedOptions = JSON.parse(optionsJson)
          options = importOptionsSchema.parse(parsedOptions)
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid options format' },
            { status: 400 }
          )
        }
      }
    } else {
      // Handle JSON payload
      const body = await request.json()
      csvContent = body.csvContent

      if (!csvContent) {
        return NextResponse.json(
          { error: 'CSV content is required' },
          { status: 400 }
        )
      }

      if (body.options) {
        options = importOptionsSchema.parse(body.options)
      }
    }

    // Parse CSV content
    let titleData: TitleImportData[]
    try {
      titleData = parseCSV(csvContent)
    } catch (error) {
      return NextResponse.json(
        {
          error: 'CSV parsing failed',
          details: error.message
        },
        { status: 400 }
      )
    }

    if (titleData.length === 0) {
      return NextResponse.json(
        { error: 'CSV file contains no data rows' },
        { status: 400 }
      )
    }

    if (titleData.length > 10000) {
      return NextResponse.json(
        {
          error: 'CSV file too large',
          details: `Maximum 10,000 rows allowed, got ${titleData.length}`
        },
        { status: 400 }
      )
    }

    // Create import job
    const jobId = await createImportJob(titleData, options)

    return NextResponse.json(
      {
        jobId,
        message: 'Import job created successfully',
        totalRows: titleData.length,
        options
      },
      { status: 202 }
    )

  } catch (error) {
    console.error('POST /api/titles/bulk-import error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid import options',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Import creation failed' },
      { status: 500 }
    )
  }
}