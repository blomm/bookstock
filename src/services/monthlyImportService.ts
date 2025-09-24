import { PrismaClient, MovementType, Prisma } from '@prisma/client'
import { parse as parseCSV } from 'csv-parse/sync'
import StockMovementService, { MovementRequest, BatchMovementRequest } from './stockMovementService'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces
export interface MonthlyImportData {
  // Core Fields
  isbn: string
  warehouseCode: string
  movementType: string
  quantity: number
  movementDate: string | Date
  referenceNumber?: string

  // Financial Fields
  rrp?: number
  unitCost?: number
  tradeDiscount?: number

  // Additional Fields
  customerName?: string
  orderNumber?: string
  batchNumber?: string
  notes?: string

  // Warehouse Transfer Fields
  sourceWarehouseCode?: string
  destinationWarehouseCode?: string

  // Print Fields
  printerName?: string
  printRunDate?: string | Date
}

export interface ImportJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  summary: ImportSummary
  errors: ImportError[]
  warnings: ImportError[]
  processedMovements: any[]
  options: ImportOptions
  metadata: ImportMetadata
  createdAt: Date
  updatedAt: Date
}

export interface ImportSummary {
  totalRecords: number
  successfulMovements: number
  failedMovements: number
  skippedRecords: number
  totalQuantity: number
  duration: number
  startTime: Date
  endTime?: Date
  movementsByType: Record<string, number>
  warehouseSummary: Record<string, { inbound: number; outbound: number }>
}

export interface ImportError {
  row: number
  isbn?: string
  warehouseCode?: string
  movementType?: string
  field?: string
  error: string
  data: any
  severity: 'warning' | 'error' | 'critical'
}

export interface ImportOptions {
  validateFirst?: boolean
  continueOnError?: boolean
  batchSize?: number
  dryRun?: boolean
  allowFutureMovements?: boolean
  autoCreateInventoryRecords?: boolean
  reconcileInventory?: boolean
  notificationEmail?: string
  scheduledTime?: Date
  retryAttempts?: number
}

export interface ImportMetadata {
  fileName: string
  fileSize: number
  uploadedBy: string
  warehouse?: string
  period: {
    year: number
    month: number
  }
  source: 'manual' | 'scheduled' | 'api'
  format: 'csv' | 'excel' | 'json'
}

export interface ImportValidationResult {
  isValid: boolean
  errors: ImportError[]
  warnings: ImportError[]
  summary: {
    totalRecords: number
    validRecords: number
    invalidRecords: number
    duplicateRecords: number
  }
}

export interface ReconciliationResult {
  success: boolean
  discrepancies: Array<{
    titleId: number
    warehouseId: number
    expectedStock: number
    actualStock: number
    difference: number
    lastMovementDate: Date
  }>
  adjustmentsNeeded: Array<{
    titleId: number
    warehouseId: number
    adjustmentQuantity: number
    reason: string
  }>
}

export interface ImportSchedule {
  id: string
  name: string
  warehouseCode: string
  cronExpression: string
  isActive: boolean
  lastRun?: Date
  nextRun: Date
  importOptions: ImportOptions
  createdAt: Date
  updatedAt: Date
}

export interface NotificationSettings {
  onSuccess: boolean
  onFailure: boolean
  onWarnings: boolean
  emailRecipients: string[]
  slackWebhook?: string
  includeDetailedReport: boolean
}

class MonthlyImportService {

  // Job Management
  private static activeJobs: Map<string, ImportJob> = new Map()
  private static jobHistory: ImportJob[] = []

  // Automated Monthly Import Processing
  static async processMonthlyImport(
    csvData: string,
    metadata: ImportMetadata,
    options: ImportOptions = {}
  ): Promise<ImportJob> {
    const jobId = this.generateJobId()
    const startTime = new Date()

    const job: ImportJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      summary: {
        totalRecords: 0,
        successfulMovements: 0,
        failedMovements: 0,
        skippedRecords: 0,
        totalQuantity: 0,
        duration: 0,
        startTime,
        movementsByType: {},
        warehouseSummary: {}
      },
      errors: [],
      warnings: [],
      processedMovements: [],
      options,
      metadata,
      createdAt: startTime,
      updatedAt: startTime
    }

    this.activeJobs.set(jobId, job)

    try {
      job.status = 'processing'
      job.updatedAt = new Date()

      // Parse CSV data
      const records = this.parseCSVData(csvData)
      job.summary.totalRecords = records.length

      // Validate data
      if (options.validateFirst !== false) {
        const validation = await this.validateImportData(records, options)
        job.errors.push(...validation.errors)
        job.warnings.push(...validation.warnings)

        if (!validation.isValid && !options.continueOnError) {
          job.status = 'failed'
          job.summary.endTime = new Date()
          job.summary.duration = job.summary.endTime.getTime() - startTime.getTime()
          return job
        }
      }

      // Process in dry run mode if requested
      if (options.dryRun) {
        job.summary.endTime = new Date()
        job.summary.duration = job.summary.endTime.getTime() - startTime.getTime()
        job.status = 'completed'
        job.progress = 100
        return job
      }

      // Convert to movement requests
      const movementRequests = await this.convertToMovementRequests(records, job)

      // Process movements using batch processing
      const batchResult = await StockMovementService.processBatchMovements(
        { movements: movementRequests },
        {
          batchSize: options.batchSize || 100,
          validateFirst: false, // Already validated
          continueOnError: options.continueOnError || false
        }
      )

      // Update job with results
      job.summary.successfulMovements = batchResult.successCount
      job.summary.failedMovements = batchResult.failureCount
      job.processedMovements = batchResult.results.filter(r => r.success).map(r => r.movement)

      // Add batch errors to job errors
      batchResult.errors.forEach(error => {
        job.errors.push({
          row: error.index + 1,
          error: error.error,
          data: error.movement,
          severity: 'error'
        })
      })

      // Calculate statistics
      this.calculateImportStatistics(job, movementRequests)

      // Perform inventory reconciliation if requested
      if (options.reconcileInventory) {
        await this.performInventoryReconciliation(job)
      }

      job.status = batchResult.success ? 'completed' : 'failed'
      job.progress = 100
      job.summary.endTime = new Date()
      job.summary.duration = job.summary.endTime.getTime() - startTime.getTime()

      // Send notifications
      await this.sendNotifications(job)

    } catch (error) {
      job.status = 'failed'
      job.errors.push({
        row: 0,
        error: `Import processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {},
        severity: 'critical'
      })
      job.summary.endTime = new Date()
      job.summary.duration = job.summary.endTime.getTime() - startTime.getTime()
    }

    job.updatedAt = new Date()
    this.activeJobs.set(jobId, job)
    this.jobHistory.push({ ...job })

    return job
  }

  // Data Validation and Reconciliation
  static async validateImportData(
    records: MonthlyImportData[],
    options: ImportOptions
  ): Promise<ImportValidationResult> {
    const errors: ImportError[] = []
    const warnings: ImportError[] = []
    const duplicates = new Set<string>()
    let validRecords = 0

    for (const [index, record] of records.entries()) {
      const rowNum = index + 1

      // Required field validation
      if (!record.isbn) {
        errors.push({
          row: rowNum,
          field: 'isbn',
          error: 'ISBN is required',
          data: record,
          severity: 'error'
        })
      }

      if (!record.warehouseCode) {
        errors.push({
          row: rowNum,
          field: 'warehouseCode',
          error: 'Warehouse code is required',
          data: record,
          severity: 'error'
        })
      }

      if (!record.movementType) {
        errors.push({
          row: rowNum,
          field: 'movementType',
          error: 'Movement type is required',
          data: record,
          severity: 'error'
        })
      }

      if (record.quantity === undefined || record.quantity === null || record.quantity === '') {
        errors.push({
          row: rowNum,
          field: 'quantity',
          error: 'Quantity is required',
          data: record,
          severity: 'error'
        })
      }

      if (!record.movementDate) {
        errors.push({
          row: rowNum,
          field: 'movementDate',
          error: 'Movement date is required',
          data: record,
          severity: 'error'
        })
      }

      // Business rule validation
      if (record.isbn) {
        // Validate ISBN format (basic check)
        if (!/^\d{10}$|^\d{13}$/.test(record.isbn.replace(/[-\s]/g, ''))) {
          errors.push({
            row: rowNum,
            field: 'isbn',
            error: 'Invalid ISBN format',
            data: record,
            severity: 'error'
          })
        }

        // Check if title exists
        const title = await dbClient.title.findUnique({
          where: { isbn: record.isbn }
        })
        if (!title) {
          errors.push({
            row: rowNum,
            field: 'isbn',
            error: 'Title not found in catalog',
            data: record,
            severity: 'error'
          })
        }
      }

      if (record.warehouseCode) {
        // Check if warehouse exists
        const warehouse = await dbClient.warehouse.findUnique({
          where: { code: record.warehouseCode }
        })
        if (!warehouse) {
          errors.push({
            row: rowNum,
            field: 'warehouseCode',
            error: 'Warehouse not found',
            data: record,
            severity: 'error'
          })
        }
      }

      // Movement type validation
      if (record.movementType && !Object.values(MovementType).includes(record.movementType as MovementType)) {
        errors.push({
          row: rowNum,
          field: 'movementType',
          error: `Invalid movement type: ${record.movementType}`,
          data: record,
          severity: 'error'
        })
      }

      // Date validation
      if (record.movementDate) {
        const movementDate = new Date(record.movementDate)
        if (isNaN(movementDate.getTime())) {
          errors.push({
            row: rowNum,
            field: 'movementDate',
            error: 'Invalid date format',
            data: record,
            severity: 'error'
          })
        } else if (movementDate > new Date() && !options.allowFutureMovements) {
          errors.push({
            row: rowNum,
            field: 'movementDate',
            error: 'Future movement dates not allowed',
            data: record,
            severity: 'error'
          })
        }
      }

      // Quantity validation
      if (typeof record.quantity === 'number') {
        if (record.quantity === 0) {
          warnings.push({
            row: rowNum,
            field: 'quantity',
            error: 'Zero quantity movement',
            data: record,
            severity: 'warning'
          })
        }

        if (Math.abs(record.quantity) > 100000) {
          warnings.push({
            row: rowNum,
            field: 'quantity',
            error: 'Unusually large quantity',
            data: record,
            severity: 'warning'
          })
        }
      }

      // Duplicate detection
      const duplicateKey = `${record.isbn}-${record.warehouseCode}-${record.movementType}-${record.movementDate}-${record.quantity}`
      if (duplicates.has(duplicateKey)) {
        warnings.push({
          row: rowNum,
          error: 'Potential duplicate record',
          data: record,
          severity: 'warning'
        })
      } else {
        duplicates.add(duplicateKey)
      }

      // Financial validation
      if (record.rrp !== undefined && record.rrp < 0) {
        errors.push({
          row: rowNum,
          field: 'rrp',
          error: 'RRP cannot be negative',
          data: record,
          severity: 'error'
        })
      }

      if (record.unitCost !== undefined && record.unitCost < 0) {
        errors.push({
          row: rowNum,
          field: 'unitCost',
          error: 'Unit cost cannot be negative',
          data: record,
          severity: 'error'
        })
      }

      // Count valid records
      const recordErrors = errors.filter(e => e.row === rowNum)
      if (recordErrors.length === 0) {
        validRecords++
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalRecords: records.length,
        validRecords,
        invalidRecords: records.length - validRecords,
        duplicateRecords: duplicates.size !== records.length ? records.length - duplicates.size : 0
      }
    }
  }

  // Import Scheduling and Retry Mechanisms
  static async scheduleImport(schedule: Omit<ImportSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImportSchedule> {
    const newSchedule: ImportSchedule = {
      id: this.generateJobId(),
      ...schedule,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // In a real implementation, this would be stored in database
    // and integrated with a job scheduler like node-cron
    return newSchedule
  }

  static async retryImport(
    originalJobId: string,
    retryOptions?: Partial<ImportOptions>
  ): Promise<ImportJob | null> {
    const originalJob = this.activeJobs.get(originalJobId) || this.jobHistory.find(job => job.id === originalJobId)
    if (!originalJob) {
      return null
    }

    // Create new import job with retry options
    const retryJob: ImportJob = {
      ...originalJob,
      id: this.generateJobId(),
      status: 'pending',
      progress: 0,
      errors: [],
      warnings: [],
      processedMovements: [],
      options: { ...originalJob.options, ...retryOptions },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // In a real implementation, this would re-process the original data
    return retryJob
  }

  // Notification System
  static async sendNotifications(job: ImportJob): Promise<void> {
    try {
      const { metadata, summary, errors, options } = job

      // Determine notification type
      let notificationType: 'success' | 'warning' | 'failure'
      if (job.status === 'completed' && errors.length === 0) {
        notificationType = 'success'
      } else if (job.status === 'completed' && errors.length > 0) {
        notificationType = 'warning'
      } else {
        notificationType = 'failure'
      }

      // Create notification message
      const notification = {
        jobId: job.id,
        type: notificationType,
        title: `Monthly Import ${notificationType === 'success' ? 'Completed' : notificationType === 'warning' ? 'Completed with Warnings' : 'Failed'}`,
        summary: {
          fileName: metadata.fileName,
          uploadedBy: metadata.uploadedBy,
          totalRecords: summary.totalRecords,
          successfulMovements: summary.successfulMovements,
          failedMovements: summary.failedMovements,
          duration: `${Math.round(summary.duration / 1000)}s`
        },
        errors: errors.filter(e => e.severity === 'error').length,
        warnings: errors.filter(e => e.severity === 'warning').length,
        timestamp: new Date().toISOString()
      }

      // Send email notification if configured
      if (options.notificationEmail) {
        await this.sendEmailNotification(options.notificationEmail, notification, job)
      }

      // Log notification (in real implementation, this might go to a notification service)
      console.log('Import notification:', notification)

    } catch (error) {
      console.error('Failed to send notifications:', error)
    }
  }

  // Helper Methods
  private static parseCSVData(csvData: string): MonthlyImportData[] {
    try {
      const records = parseCSV(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Auto-cast numeric fields
          if (context.column === 'quantity' || context.column === 'rrp' ||
              context.column === 'unitCost' || context.column === 'tradeDiscount') {
            const num = parseFloat(value)
            return isNaN(num) ? value : num
          }
          return value
        }
      })

      return records
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private static async convertToMovementRequests(
    records: MonthlyImportData[],
    job: ImportJob
  ): Promise<MovementRequest[]> {
    const movements: MovementRequest[] = []

    for (const record of records) {
      try {
        // Look up title and warehouse IDs
        const title = await dbClient.title.findUnique({
          where: { isbn: record.isbn }
        })

        const warehouse = await dbClient.warehouse.findUnique({
          where: { code: record.warehouseCode }
        })

        if (!title || !warehouse) {
          continue // Skip invalid records (already caught in validation)
        }

        const movement: MovementRequest = {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: record.movementType as MovementType,
          quantity: record.quantity,
          movementDate: new Date(record.movementDate),
          referenceNumber: record.referenceNumber || `IMPORT-${job.id}-${Date.now()}`,
          notes: record.notes,
          rrpAtTime: record.rrp,
          unitCostAtTime: record.unitCost,
          tradeDiscountAtTime: record.tradeDiscount
        }

        // Add transfer-specific fields if applicable
        if (record.sourceWarehouseCode || record.destinationWarehouseCode) {
          if (record.sourceWarehouseCode) {
            const sourceWarehouse = await dbClient.warehouse.findUnique({
              where: { code: record.sourceWarehouseCode }
            })
            if (sourceWarehouse) {
              movement.sourceWarehouseId = sourceWarehouse.id
            }
          }

          if (record.destinationWarehouseCode) {
            const destWarehouse = await dbClient.warehouse.findUnique({
              where: { code: record.destinationWarehouseCode }
            })
            if (destWarehouse) {
              movement.destinationWarehouseId = destWarehouse.id
            }
          }
        }

        // Add print-specific fields if applicable
        if (record.printerName || record.batchNumber) {
          if (record.printerName) {
            const printer = await dbClient.printer.findFirst({
              where: { name: record.printerName }
            })
            if (printer) {
              movement.printerId = printer.id
            }
          }

          if (record.batchNumber) {
            movement.batchNumber = record.batchNumber
          }

          if (record.printRunDate) {
            movement.manufacturingDate = new Date(record.printRunDate)
          }
        }

        movements.push(movement)
      } catch (error) {
        job.errors.push({
          row: records.indexOf(record) + 1,
          error: `Failed to convert record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: record,
          severity: 'error'
        })
      }
    }

    return movements
  }

  private static calculateImportStatistics(job: ImportJob, movements: MovementRequest[]): void {
    const { summary } = job

    // Calculate total quantity
    summary.totalQuantity = movements.reduce((sum, m) => sum + Math.abs(m.quantity), 0)

    // Group by movement type
    movements.forEach(movement => {
      const type = movement.movementType
      summary.movementsByType[type] = (summary.movementsByType[type] || 0) + 1
    })

    // Group by warehouse
    movements.forEach(movement => {
      const warehouseId = movement.warehouseId.toString()
      if (!summary.warehouseSummary[warehouseId]) {
        summary.warehouseSummary[warehouseId] = { inbound: 0, outbound: 0 }
      }

      if (movement.quantity > 0) {
        summary.warehouseSummary[warehouseId].inbound += movement.quantity
      } else {
        summary.warehouseSummary[warehouseId].outbound += Math.abs(movement.quantity)
      }
    })
  }

  private static async performInventoryReconciliation(job: ImportJob): Promise<ReconciliationResult> {
    // This would implement inventory reconciliation logic
    // For now, return empty result
    return {
      success: true,
      discrepancies: [],
      adjustmentsNeeded: []
    }
  }

  private static async sendEmailNotification(
    email: string,
    notification: any,
    job: ImportJob
  ): Promise<void> {
    // In a real implementation, this would integrate with an email service
    console.log(`Email notification sent to ${email}:`, notification)
  }

  private static generateJobId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Public API Methods
  static async getJobStatus(jobId: string): Promise<ImportJob | null> {
    return this.activeJobs.get(jobId) || this.jobHistory.find(job => job.id === jobId) || null
  }

  static async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId)
    if (job && job.status === 'processing') {
      job.status = 'cancelled'
      job.updatedAt = new Date()
      return true
    }
    return false
  }

  static async getJobHistory(limit: number = 50): Promise<ImportJob[]> {
    return this.jobHistory.slice(-limit)
  }

  static async validateCSV(csvData: string): Promise<ImportValidationResult> {
    const records = this.parseCSVData(csvData)
    return await this.validateImportData(records, {})
  }
}

export default MonthlyImportService