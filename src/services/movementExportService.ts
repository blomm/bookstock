import { PrismaClient, MovementType } from '@prisma/client'
import { StockMovementAuditService } from './stockMovementAuditService'

export interface ExportRequest {
  format: 'csv' | 'xlsx' | 'json' | 'xml'
  dateFrom: Date
  dateTo: Date
  warehouseIds?: number[]
  movementTypes?: MovementType[]
  titleIds?: number[]
  includeAuditTrail?: boolean
  includeMetadata?: boolean
  groupBy?: 'DAY' | 'WEEK' | 'MONTH' | 'TITLE' | 'WAREHOUSE'
  maxRecords?: number
}

export interface ExportResponse {
  exportId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  format: string
  recordCount: number
  fileSize?: number
  downloadUrl?: string
  createdAt: Date
  completedAt?: Date
  expiresAt: Date
  error?: string
}

export interface SyncConfiguration {
  targetSystem: string
  syncType: 'full' | 'incremental'
  schedule: 'manual' | 'hourly' | 'daily' | 'weekly'
  filters: {
    warehouseIds?: number[]
    movementTypes?: MovementType[]
    dateRange?: {
      from: Date
      to?: Date
    }
  }
  format: 'csv' | 'json' | 'xml'
  destination: {
    type: 'ftp' | 'sftp' | 'webhook' | 's3' | 'api'
    endpoint: string
    credentials: Record<string, any>
  }
  isActive: boolean
  lastSyncAt?: Date
  nextSyncAt?: Date
}

export interface SyncExecution {
  syncId: string
  configurationId: string
  status: 'running' | 'completed' | 'failed'
  recordCount: number
  startedAt: Date
  completedAt?: Date
  error?: string
  metadata?: Record<string, any>
}

class MovementExportService {
  private static db: PrismaClient | null = null
  private static exports = new Map<string, ExportResponse>()
  private static syncConfigurations = new Map<string, SyncConfiguration>()
  private static syncExecutions = new Map<string, SyncExecution>()

  static setDbClient(client: PrismaClient): void {
    this.db = client
  }

  private static getDb(): PrismaClient {
    if (!this.db) {
      throw new Error('Database client not initialized. Call setDbClient() first.')
    }
    return this.db
  }

  static async createExport(request: ExportRequest): Promise<string> {
    this.validateExportRequest(request)

    const exportId = this.generateExportId()
    const exportResponse: ExportResponse = {
      exportId,
      status: 'pending',
      format: request.format,
      recordCount: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }

    this.exports.set(exportId, exportResponse)

    // Process export asynchronously
    this.processExportAsync(exportId, request)

    return exportId
  }

  static async getExportStatus(exportId: string): Promise<ExportResponse | null> {
    return this.exports.get(exportId) || null
  }

  static async downloadExport(exportId: string): Promise<{
    data: string
    contentType: string
    filename: string
  } | null> {
    const exportResponse = this.exports.get(exportId)

    if (!exportResponse || exportResponse.status !== 'completed') {
      return null
    }

    // In production, this would retrieve the actual file content
    // For now, return placeholder content
    const contentType = this.getContentType(exportResponse.format)
    const filename = `movement_export_${exportId}.${exportResponse.format}`

    return {
      data: `Exported movement data (${exportResponse.recordCount} records)`,
      contentType,
      filename
    }
  }

  static async createSyncConfiguration(config: SyncConfiguration): Promise<string> {
    this.validateSyncConfiguration(config)

    const configId = this.generateConfigId()
    const syncConfig = { ...config }

    if (syncConfig.schedule !== 'manual') {
      syncConfig.nextSyncAt = this.calculateNextSyncTime(syncConfig.schedule)
    }

    this.syncConfigurations.set(configId, syncConfig)

    console.log(`Sync configuration created: ${configId} -> ${config.targetSystem}`)
    return configId
  }

  static async updateSyncConfiguration(
    configId: string,
    updates: Partial<SyncConfiguration>
  ): Promise<boolean> {
    const config = this.syncConfigurations.get(configId)

    if (!config) {
      return false
    }

    const updatedConfig = { ...config, ...updates }
    this.validateSyncConfiguration(updatedConfig)

    // Recalculate next sync time if schedule changed
    if (updates.schedule && updates.schedule !== 'manual') {
      updatedConfig.nextSyncAt = this.calculateNextSyncTime(updates.schedule)
    }

    this.syncConfigurations.set(configId, updatedConfig)
    return true
  }

  static async deleteSyncConfiguration(configId: string): Promise<boolean> {
    return this.syncConfigurations.delete(configId)
  }

  static async executeSyncConfiguration(configId: string): Promise<string> {
    const config = this.syncConfigurations.get(configId)

    if (!config) {
      throw new Error(`Sync configuration '${configId}' not found`)
    }

    if (!config.isActive) {
      throw new Error(`Sync configuration '${configId}' is not active`)
    }

    const syncId = this.generateSyncId()
    const syncExecution: SyncExecution = {
      syncId,
      configurationId: configId,
      status: 'running',
      recordCount: 0,
      startedAt: new Date()
    }

    this.syncExecutions.set(syncId, syncExecution)

    // Process sync asynchronously
    this.processSyncAsync(syncId, config)

    // Update last sync time
    config.lastSyncAt = new Date()
    if (config.schedule !== 'manual') {
      config.nextSyncAt = this.calculateNextSyncTime(config.schedule)
    }

    return syncId
  }

  static async getSyncExecutionStatus(syncId: string): Promise<SyncExecution | null> {
    return this.syncExecutions.get(syncId) || null
  }

  static async listSyncConfigurations(): Promise<SyncConfiguration[]> {
    return Array.from(this.syncConfigurations.values())
  }

  static async getDueSyncConfigurations(): Promise<SyncConfiguration[]> {
    const now = new Date()
    return Array.from(this.syncConfigurations.values()).filter(
      config => config.isActive &&
               config.nextSyncAt &&
               config.nextSyncAt <= now
    )
  }

  static async runScheduledSyncs(): Promise<void> {
    const dueConfigs = await this.getDueSyncConfigurations()

    for (const config of dueConfigs) {
      try {
        const configId = Array.from(this.syncConfigurations.entries())
          .find(([_, c]) => c === config)?.[0]

        if (configId) {
          await this.executeSyncConfiguration(configId)
        }
      } catch (error) {
        console.error(`Failed to execute scheduled sync:`, error)
      }
    }
  }

  private static async processExportAsync(exportId: string, request: ExportRequest): Promise<void> {
    const exportResponse = this.exports.get(exportId)!

    try {
      exportResponse.status = 'processing'

      // Build query
      const db = this.getDb()
      const whereClause = this.buildWhereClause(request)

      const movements = await db.stockMovement.findMany({
        where: whereClause,
        include: {
          title: {
            select: {
              isbn: true,
              title: true,
              author: true,
              format: true
            }
          },
          warehouse: {
            select: {
              name: true,
              location: true
            }
          },
          ...(request.includeAuditTrail && {
            MovementAuditEntry: {
              orderBy: {
                performedAt: 'desc'
              },
              take: 10 // Limit audit entries per movement
            }
          })
        },
        orderBy: {
          movementDate: 'desc'
        },
        take: request.maxRecords || 10000
      })

      exportResponse.recordCount = movements.length

      // Generate export data based on format
      let exportData: string
      let fileSize: number

      switch (request.format) {
        case 'csv':
          exportData = this.generateCSVExport(movements, request)
          break
        case 'json':
          exportData = this.generateJSONExport(movements, request)
          break
        case 'xml':
          exportData = this.generateXMLExport(movements, request)
          break
        case 'xlsx':
          exportData = this.generateXLSXExport(movements, request)
          break
        default:
          throw new Error(`Unsupported export format: ${request.format}`)
      }

      fileSize = Buffer.byteLength(exportData, 'utf8')

      // In production, this would save to file storage (S3, etc.)
      exportResponse.fileSize = fileSize
      exportResponse.downloadUrl = `/api/movements/export/${exportId}/download`
      exportResponse.status = 'completed'
      exportResponse.completedAt = new Date()

    } catch (error) {
      exportResponse.status = 'failed'
      exportResponse.error = error instanceof Error ? error.message : 'Unknown error'
      exportResponse.completedAt = new Date()

      console.error('Export processing failed:', error)
    }
  }

  private static async processSyncAsync(syncId: string, config: SyncConfiguration): Promise<void> {
    const syncExecution = this.syncExecutions.get(syncId)!

    try {
      // Create export request based on sync config
      const exportRequest: ExportRequest = {
        format: config.format as 'csv' | 'json' | 'xml',
        dateFrom: config.filters.dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dateTo: config.filters.dateRange?.to || new Date(),
        warehouseIds: config.filters.warehouseIds,
        movementTypes: config.filters.movementTypes,
        includeAuditTrail: false,
        includeMetadata: true
      }

      // Generate export data
      const db = this.getDb()
      const whereClause = this.buildWhereClause(exportRequest)

      const movements = await db.stockMovement.findMany({
        where: whereClause,
        include: {
          title: {
            select: {
              isbn: true,
              title: true,
              author: true
            }
          },
          warehouse: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          movementDate: 'desc'
        }
      })

      syncExecution.recordCount = movements.length

      let syncData: string
      switch (config.format) {
        case 'csv':
          syncData = this.generateCSVExport(movements, exportRequest)
          break
        case 'json':
          syncData = this.generateJSONExport(movements, exportRequest)
          break
        case 'xml':
          syncData = this.generateXMLExport(movements, exportRequest)
          break
        default:
          throw new Error(`Unsupported sync format: ${config.format}`)
      }

      // In production, this would send data to the configured destination
      // For now, just log the sync completion
      syncExecution.status = 'completed'
      syncExecution.completedAt = new Date()
      syncExecution.metadata = {
        dataSize: Buffer.byteLength(syncData, 'utf8'),
        destination: config.destination.endpoint
      }

      console.log(`Sync completed: ${syncId} -> ${config.targetSystem} (${movements.length} records)`)

    } catch (error) {
      syncExecution.status = 'failed'
      syncExecution.error = error instanceof Error ? error.message : 'Unknown error'
      syncExecution.completedAt = new Date()

      console.error('Sync processing failed:', error)
    }
  }

  private static buildWhereClause(request: ExportRequest | { warehouseIds?: number[]; movementTypes?: MovementType[]; dateFrom: Date; dateTo: Date }): any {
    const whereClause: any = {
      movementDate: {
        gte: request.dateFrom,
        lte: request.dateTo
      }
    }

    if (request.warehouseIds && request.warehouseIds.length > 0) {
      whereClause.warehouseId = {
        in: request.warehouseIds
      }
    }

    if (request.movementTypes && request.movementTypes.length > 0) {
      whereClause.movementType = {
        in: request.movementTypes
      }
    }

    if ('titleIds' in request && request.titleIds && request.titleIds.length > 0) {
      whereClause.titleId = {
        in: request.titleIds
      }
    }

    return whereClause
  }

  private static generateCSVExport(movements: any[], request: ExportRequest): string {
    const headers = [
      'Movement ID', 'Date', 'Title ISBN', 'Title', 'Author', 'Warehouse',
      'Movement Type', 'Quantity', 'Unit Cost', 'Total Value', 'Notes'
    ]

    const rows = movements.map(movement => [
      movement.id,
      movement.movementDate.toISOString().split('T')[0],
      movement.title.isbn,
      `"${movement.title.title.replace(/"/g, '""')}"`,
      `"${movement.title.author.replace(/"/g, '""')}"`,
      `"${movement.warehouse.name.replace(/"/g, '""')}"`,
      movement.movementType,
      movement.quantity,
      movement.unitCost.toFixed(2),
      (movement.quantity * movement.unitCost).toFixed(2),
      movement.notes ? `"${movement.notes.replace(/"/g, '""')}"` : ''
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  private static generateJSONExport(movements: any[], request: ExportRequest): string {
    const exportData = {
      exportMetadata: {
        generatedAt: new Date().toISOString(),
        recordCount: movements.length,
        dateRange: {
          from: request.dateFrom.toISOString(),
          to: request.dateTo.toISOString()
        }
      },
      movements: movements.map(movement => ({
        id: movement.id,
        date: movement.movementDate.toISOString(),
        title: {
          id: movement.titleId,
          isbn: movement.title.isbn,
          title: movement.title.title,
          author: movement.title.author,
          format: movement.title.format
        },
        warehouse: {
          id: movement.warehouseId,
          name: movement.warehouse.name
        },
        movementType: movement.movementType,
        quantity: movement.quantity,
        unitCost: movement.unitCost,
        totalValue: movement.quantity * movement.unitCost,
        notes: movement.notes,
        metadata: request.includeMetadata ? movement.metadata : undefined
      }))
    }

    return JSON.stringify(exportData, null, 2)
  }

  private static generateXMLExport(movements: any[], request: ExportRequest): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<MovementExport>\n'
    xml += `  <Metadata>\n`
    xml += `    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>\n`
    xml += `    <RecordCount>${movements.length}</RecordCount>\n`
    xml += `    <DateFrom>${request.dateFrom.toISOString()}</DateFrom>\n`
    xml += `    <DateTo>${request.dateTo.toISOString()}</DateTo>\n`
    xml += `  </Metadata>\n`
    xml += `  <Movements>\n`

    movements.forEach(movement => {
      xml += `    <Movement>\n`
      xml += `      <ID>${movement.id}</ID>\n`
      xml += `      <Date>${movement.movementDate.toISOString()}</Date>\n`
      xml += `      <Title>\n`
      xml += `        <ID>${movement.titleId}</ID>\n`
      xml += `        <ISBN>${this.escapeXml(movement.title.isbn)}</ISBN>\n`
      xml += `        <Title>${this.escapeXml(movement.title.title)}</Title>\n`
      xml += `        <Author>${this.escapeXml(movement.title.author)}</Author>\n`
      xml += `      </Title>\n`
      xml += `      <Warehouse>\n`
      xml += `        <ID>${movement.warehouseId}</ID>\n`
      xml += `        <Name>${this.escapeXml(movement.warehouse.name)}</Name>\n`
      xml += `      </Warehouse>\n`
      xml += `      <MovementType>${movement.movementType}</MovementType>\n`
      xml += `      <Quantity>${movement.quantity}</Quantity>\n`
      xml += `      <UnitCost>${movement.unitCost}</UnitCost>\n`
      xml += `      <TotalValue>${movement.quantity * movement.unitCost}</TotalValue>\n`
      if (movement.notes) {
        xml += `      <Notes>${this.escapeXml(movement.notes)}</Notes>\n`
      }
      xml += `    </Movement>\n`
    })

    xml += `  </Movements>\n`
    xml += '</MovementExport>'

    return xml
  }

  private static generateXLSXExport(movements: any[], request: ExportRequest): string {
    // In production, this would generate actual XLSX file using a library like ExcelJS
    // For now, return CSV format as placeholder
    return this.generateCSVExport(movements, request)
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private static getContentType(format: string): string {
    switch (format) {
      case 'csv': return 'text/csv'
      case 'json': return 'application/json'
      case 'xml': return 'application/xml'
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      default: return 'application/octet-stream'
    }
  }

  private static validateExportRequest(request: ExportRequest): void {
    if (!request.dateFrom || !request.dateTo) {
      throw new Error('dateFrom and dateTo are required')
    }

    if (request.dateFrom >= request.dateTo) {
      throw new Error('dateFrom must be before dateTo')
    }

    if (!['csv', 'xlsx', 'json', 'xml'].includes(request.format)) {
      throw new Error('Invalid format. Supported: csv, xlsx, json, xml')
    }

    if (request.maxRecords && (request.maxRecords < 1 || request.maxRecords > 100000)) {
      throw new Error('maxRecords must be between 1 and 100,000')
    }
  }

  private static validateSyncConfiguration(config: SyncConfiguration): void {
    if (!config.targetSystem || config.targetSystem.trim() === '') {
      throw new Error('targetSystem is required')
    }

    if (!['full', 'incremental'].includes(config.syncType)) {
      throw new Error('syncType must be full or incremental')
    }

    if (!['manual', 'hourly', 'daily', 'weekly'].includes(config.schedule)) {
      throw new Error('schedule must be manual, hourly, daily, or weekly')
    }

    if (!['csv', 'json', 'xml'].includes(config.format)) {
      throw new Error('format must be csv, json, or xml')
    }

    if (!config.destination.type || !config.destination.endpoint) {
      throw new Error('destination type and endpoint are required')
    }
  }

  private static calculateNextSyncTime(schedule: string): Date {
    const now = new Date()
    const next = new Date(now)

    switch (schedule) {
      case 'hourly':
        next.setHours(next.getHours() + 1)
        break
      case 'daily':
        next.setDate(next.getDate() + 1)
        next.setHours(2, 0, 0, 0) // 2 AM
        break
      case 'weekly':
        next.setDate(next.getDate() + (7 - next.getDay())) // Next Sunday
        next.setHours(2, 0, 0, 0) // 2 AM
        break
    }

    return next
  }

  private static generateExportId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `export_${timestamp}_${random}`
  }

  private static generateConfigId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `sync_config_${timestamp}_${random}`
  }

  private static generateSyncId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `sync_${timestamp}_${random}`
  }
}

export default MovementExportService