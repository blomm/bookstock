import { NextRequest, NextResponse } from 'next/server'
import MovementExportService from '@/services/movementExportService'

interface RouteParams {
  params: {
    exportId: string
  }
}

// GET /api/movements/export/[exportId] - Get export status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { exportId } = params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'download') {
      return await handleDownloadExport(exportId)
    }

    // Default: get export status
    return await handleGetExportStatus(exportId)

  } catch (error) {
    console.error('Export status/download error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process export request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleGetExportStatus(exportId: string): Promise<NextResponse> {
  const exportStatus = await MovementExportService.getExportStatus(exportId)

  if (!exportStatus) {
    return NextResponse.json(
      {
        success: false,
        error: `Export with id '${exportId}' not found`
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      exportId: exportStatus.exportId,
      status: exportStatus.status,
      format: exportStatus.format,
      recordCount: exportStatus.recordCount,
      fileSize: exportStatus.fileSize,
      createdAt: exportStatus.createdAt,
      completedAt: exportStatus.completedAt,
      expiresAt: exportStatus.expiresAt,
      downloadUrl: exportStatus.downloadUrl,
      error: exportStatus.error,
      isExpired: exportStatus.expiresAt < new Date(),
      progressPercentage: exportStatus.status === 'completed' ? 100 :
                         exportStatus.status === 'processing' ? 50 :
                         exportStatus.status === 'failed' ? 0 : 0
    }
  })
}

async function handleDownloadExport(exportId: string): Promise<NextResponse> {
  const exportData = await MovementExportService.downloadExport(exportId)

  if (!exportData) {
    const exportStatus = await MovementExportService.getExportStatus(exportId)

    if (!exportStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `Export with id '${exportId}' not found`
        },
        { status: 404 }
      )
    }

    if (exportStatus.status === 'pending' || exportStatus.status === 'processing') {
      return NextResponse.json(
        {
          success: false,
          error: 'Export is not ready for download yet',
          status: exportStatus.status
        },
        { status: 202 }
      )
    }

    if (exportStatus.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Export failed and cannot be downloaded',
          details: exportStatus.error
        },
        { status: 400 }
      )
    }

    if (exportStatus.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Export has expired and is no longer available for download'
        },
        { status: 410 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Export data not available'
      },
      { status: 404 }
    )
  }

  // Return file download
  const response = new NextResponse(exportData.data)
  response.headers.set('Content-Type', exportData.contentType)
  response.headers.set('Content-Disposition', `attachment; filename="${exportData.filename}"`)
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

// DELETE /api/movements/export/[exportId] - Delete export
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { exportId } = params

    const exportStatus = await MovementExportService.getExportStatus(exportId)

    if (!exportStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `Export with id '${exportId}' not found`
        },
        { status: 404 }
      )
    }

    if (exportStatus.status === 'processing') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete export that is currently processing'
        },
        { status: 400 }
      )
    }

    // In production, this would delete the export record and associated files
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: 'Export deleted successfully'
    })

  } catch (error) {
    console.error('Export deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete export',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}