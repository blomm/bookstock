import { NextRequest, NextResponse } from 'next/server'
import MovementExportService, {
  ExportRequest,
  SyncConfiguration
} from '@/services/movementExportService'
import { MovementType } from '@prisma/client'

// POST /api/movements/export - Create new export
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.format || !body.dateFrom || !body.dateTo) {
      return NextResponse.json(
        {
          success: false,
          error: 'format, dateFrom, and dateTo are required'
        },
        { status: 400 }
      )
    }

    // Validate format
    if (!['csv', 'xlsx', 'json', 'xml'].includes(body.format)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid format. Supported formats: csv, xlsx, json, xml'
        },
        { status: 400 }
      )
    }

    // Validate dates
    const dateFrom = new Date(body.dateFrom)
    const dateTo = new Date(body.dateTo)

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
        },
        { status: 400 }
      )
    }

    if (dateFrom >= dateTo) {
      return NextResponse.json(
        {
          success: false,
          error: 'dateFrom must be before dateTo'
        },
        { status: 400 }
      )
    }

    // Parse optional filters
    const exportRequest: ExportRequest = {
      format: body.format,
      dateFrom,
      dateTo,
      includeAuditTrail: body.includeAuditTrail || false,
      includeMetadata: body.includeMetadata || false,
      maxRecords: body.maxRecords
    }

    // Parse warehouse IDs
    if (body.warehouseIds) {
      if (!Array.isArray(body.warehouseIds)) {
        return NextResponse.json(
          {
            success: false,
            error: 'warehouseIds must be an array'
          },
          { status: 400 }
        )
      }

      exportRequest.warehouseIds = body.warehouseIds.map((id: any) => {
        const num = parseInt(id)
        if (isNaN(num)) {
          throw new Error(`Invalid warehouse ID: ${id}`)
        }
        return num
      })
    }

    // Parse movement types
    if (body.movementTypes) {
      if (!Array.isArray(body.movementTypes)) {
        return NextResponse.json(
          {
            success: false,
            error: 'movementTypes must be an array'
          },
          { status: 400 }
        )
      }

      const validTypes = [
        'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
        'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
      ]

      exportRequest.movementTypes = body.movementTypes.map((type: any) => {
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid movement type: ${type}`)
        }
        return type as MovementType
      })
    }

    // Parse title IDs
    if (body.titleIds) {
      if (!Array.isArray(body.titleIds)) {
        return NextResponse.json(
          {
            success: false,
            error: 'titleIds must be an array'
          },
          { status: 400 }
        )
      }

      exportRequest.titleIds = body.titleIds.map((id: any) => {
        const num = parseInt(id)
        if (isNaN(num)) {
          throw new Error(`Invalid title ID: ${id}`)
        }
        return num
      })
    }

    // Parse groupBy
    if (body.groupBy) {
      if (!['DAY', 'WEEK', 'MONTH', 'TITLE', 'WAREHOUSE'].includes(body.groupBy)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid groupBy value. Valid values: DAY, WEEK, MONTH, TITLE, WAREHOUSE'
          },
          { status: 400 }
        )
      }
      exportRequest.groupBy = body.groupBy
    }

    const exportId = await MovementExportService.createExport(exportRequest)

    return NextResponse.json({
      success: true,
      message: 'Export created successfully',
      exportId,
      statusUrl: `/api/movements/export/${exportId}`,
      estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes estimate
    })

  } catch (error) {
    console.error('Export creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create export',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/movements/export - List exports or get export status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'sync-configs':
        return await handleListSyncConfigurations()

      case 'sync-status':
        const syncId = searchParams.get('syncId')
        if (!syncId) {
          return NextResponse.json(
            { error: 'syncId is required for sync status' },
            { status: 400 }
          )
        }
        return await handleGetSyncStatus(syncId)

      case 'scheduled-syncs':
        return await handleGetScheduledSyncs()

      case 'list':
      default:
        // In production, this would list all exports for the current user/organization
        return NextResponse.json({
          success: true,
          message: 'Export listing would be implemented here',
          data: {
            exports: [],
            total: 0
          }
        })
    }

  } catch (error) {
    console.error('Export listing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list exports',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT /api/movements/export - Create or update sync configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'create-sync-config':
        return await handleCreateSyncConfig(params)

      case 'update-sync-config':
        return await handleUpdateSyncConfig(params)

      case 'execute-sync':
        return await handleExecuteSync(params)

      case 'run-scheduled':
        return await handleRunScheduledSyncs()

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid action: ${action}. Valid actions: create-sync-config, update-sync-config, execute-sync, run-scheduled`
          },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Export operation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute export operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/movements/export - Delete sync configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    if (!configId) {
      return NextResponse.json(
        {
          success: false,
          error: 'configId parameter is required'
        },
        { status: 400 }
      )
    }

    const success = await MovementExportService.deleteSyncConfiguration(configId)

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync configuration with id '${configId}' not found`
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sync configuration deleted successfully'
    })

  } catch (error) {
    console.error('Sync config deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete sync configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleListSyncConfigurations(): Promise<NextResponse> {
  try {
    const configs = await MovementExportService.listSyncConfigurations()

    return NextResponse.json({
      success: true,
      data: {
        configurations: configs.map(config => ({
          targetSystem: config.targetSystem,
          syncType: config.syncType,
          schedule: config.schedule,
          format: config.format,
          isActive: config.isActive,
          lastSyncAt: config.lastSyncAt,
          nextSyncAt: config.nextSyncAt,
          destination: {
            type: config.destination.type,
            endpoint: config.destination.endpoint
          }
        })),
        total: configs.length
      }
    })

  } catch (error) {
    console.error('List sync configs error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list sync configurations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleGetSyncStatus(syncId: string): Promise<NextResponse> {
  try {
    const execution = await MovementExportService.getSyncExecutionStatus(syncId)

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync execution with id '${syncId}' not found`
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: execution
    })

  } catch (error) {
    console.error('Get sync status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleGetScheduledSyncs(): Promise<NextResponse> {
  try {
    const dueConfigs = await MovementExportService.getDueSyncConfigurations()

    return NextResponse.json({
      success: true,
      data: {
        dueConfigurations: dueConfigs.length,
        configurations: dueConfigs.map(config => ({
          targetSystem: config.targetSystem,
          schedule: config.schedule,
          nextSyncAt: config.nextSyncAt,
          lastSyncAt: config.lastSyncAt
        }))
      }
    })

  } catch (error) {
    console.error('Get scheduled syncs error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get scheduled syncs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleCreateSyncConfig(params: any): Promise<NextResponse> {
  try {
    // Validate required fields
    if (!params.targetSystem || !params.destination) {
      return NextResponse.json(
        {
          success: false,
          error: 'targetSystem and destination are required'
        },
        { status: 400 }
      )
    }

    const config: SyncConfiguration = {
      targetSystem: params.targetSystem,
      syncType: params.syncType || 'incremental',
      schedule: params.schedule || 'manual',
      filters: params.filters || {},
      format: params.format || 'json',
      destination: params.destination,
      isActive: params.isActive !== undefined ? params.isActive : true
    }

    const configId = await MovementExportService.createSyncConfiguration(config)

    return NextResponse.json({
      success: true,
      message: 'Sync configuration created successfully',
      configId
    })

  } catch (error) {
    console.error('Create sync config error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create sync configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleUpdateSyncConfig(params: any): Promise<NextResponse> {
  try {
    if (!params.configId) {
      return NextResponse.json(
        {
          success: false,
          error: 'configId is required'
        },
        { status: 400 }
      )
    }

    const { configId, ...updates } = params
    const success = await MovementExportService.updateSyncConfiguration(configId, updates)

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync configuration with id '${configId}' not found`
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sync configuration updated successfully'
    })

  } catch (error) {
    console.error('Update sync config error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update sync configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleExecuteSync(params: any): Promise<NextResponse> {
  try {
    if (!params.configId) {
      return NextResponse.json(
        {
          success: false,
          error: 'configId is required'
        },
        { status: 400 }
      )
    }

    const syncId = await MovementExportService.executeSyncConfiguration(params.configId)

    return NextResponse.json({
      success: true,
      message: 'Sync execution started',
      syncId,
      statusUrl: `/api/movements/export?action=sync-status&syncId=${syncId}`
    })

  } catch (error) {
    console.error('Execute sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleRunScheduledSyncs(): Promise<NextResponse> {
  try {
    await MovementExportService.runScheduledSyncs()

    return NextResponse.json({
      success: true,
      message: 'Scheduled syncs executed'
    })

  } catch (error) {
    console.error('Run scheduled syncs error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run scheduled syncs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}