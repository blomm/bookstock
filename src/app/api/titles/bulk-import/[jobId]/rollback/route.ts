import { NextRequest, NextResponse } from 'next/server'
import { rollbackImportJob } from '@/services/bulkImportService'

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

    const rolled_back = await rollbackImportJob(jobId)

    if (!rolled_back) {
      return NextResponse.json(
        { error: 'Job cannot be rolled back (not found or no data to rollback)' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      message: 'Import job rolled back successfully',
      jobId
    })

  } catch (error) {
    console.error(`POST /api/titles/bulk-import/${params.jobId}/rollback error:`, error)

    return NextResponse.json(
      { error: 'Failed to rollback import job' },
      { status: 500 }
    )
  }
}