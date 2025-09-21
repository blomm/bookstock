import { NextRequest, NextResponse } from 'next/server'
import { retryImportJob } from '@/services/bulkImportService'

export async function POST(
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

    const newJobId = await retryImportJob(jobId)

    return NextResponse.json({
      message: 'Retry job created successfully',
      originalJobId: jobId,
      newJobId
    })

  } catch (error) {
    console.error(`POST /api/titles/bulk-import/${params.jobId}/retry error:`, error)

    if (error.message === 'Job not found') {
      return NextResponse.json(
        { error: 'Original import job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create retry job' },
      { status: 500 }
    )
  }
}