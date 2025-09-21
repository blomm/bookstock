import { NextRequest, NextResponse } from 'next/server'
import {
  getImportJob,
  cancelImportJob,
  retryImportJob,
  rollbackImportJob
} from '@/services/bulkImportService'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const job = getImportJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }

    // Include different levels of detail based on query params
    const { searchParams } = new URL(request.url)
    const includeErrors = searchParams.get('includeErrors') === 'true'
    const includeCreated = searchParams.get('includeCreated') === 'true'

    const response: any = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      summary: job.summary,
      options: job.options,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }

    if (includeErrors) {
      response.errors = job.errors
    } else {
      response.errorCount = job.errors.length
      response.sampleErrors = job.errors.slice(0, 5) // First 5 errors
    }

    if (includeCreated) {
      response.created = job.created
    } else {
      response.createdCount = job.created.length
      response.sampleCreated = job.created.slice(0, 5) // First 5 created items
    }

    return NextResponse.json({ data: response })

  } catch (error) {
    console.error(`GET /api/titles/bulk-import/${params.jobId} error:`, error)

    return NextResponse.json(
      { error: 'Failed to retrieve import job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const cancelled = await cancelImportJob(jobId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job cannot be cancelled (not found or already completed)' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      message: 'Import job cancelled successfully',
      jobId
    })

  } catch (error) {
    console.error(`DELETE /api/titles/bulk-import/${params.jobId} error:`, error)

    return NextResponse.json(
      { error: 'Failed to cancel import job' },
      { status: 500 }
    )
  }
}