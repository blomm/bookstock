import { PrismaClient, TitleStatus, NotificationStatus } from '@prisma/client'
import { StatusTransitionError, NotificationError, RetirementError } from './errors/statusManagementErrors'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

export interface StatusUpdateResult {
  id: number
  status: TitleStatus
  statusHistory: Array<{
    fromStatus: TitleStatus
    toStatus: TitleStatus
    reason: string | null
    changedAt: Date
  }>
}

export interface AutomatedStatusResult {
  processed: number
  updatedTitles: number[]
  errors: Array<{ titleId: number; error: string }>
}

export interface NotificationResult {
  recipient: string
  subject: string
  message: string
  status: 'sent' | 'failed'
}

export interface BatchNotificationResult {
  queued: number
  failed: number
  errors: Array<{ titleId: number; error: string }>
}

export interface RetirementResult {
  retiredTitles: number[]
  batchesProcessed: number
  totalCandidates: number
}

export interface ArchiveResult {
  archived: boolean
  archiveLocation: string
}

export interface RetirementReport {
  totalRetired: number
  retiredTitles: Array<{
    id: number
    isbn: string
    title: string
    retiredAt: Date | null
  }>
  periodStart: Date
  periodEnd: Date
}

export interface StatusChangeNotification {
  titleId: number
  fromStatus: TitleStatus
  toStatus: TitleStatus
  reason: string
}

export class StatusManagementService {
  // Valid status transitions matrix
  private static readonly VALID_TRANSITIONS: Record<TitleStatus, TitleStatus[]> = {
    PRE_ORDER: [TitleStatus.ACTIVE, TitleStatus.DISCONTINUED],
    ACTIVE: [TitleStatus.DISCONTINUED],
    DISCONTINUED: [] // Cannot transition from discontinued
  }

  /**
   * Update title status with validation and history tracking
   */
  static async updateTitleStatus(
    titleId: number | string,
    newStatus: TitleStatus,
    reason: string,
    options: { mockFailure?: boolean; simulateDbFailure?: boolean } = {}
  ): Promise<StatusUpdateResult> {
    try {
      // Handle test failures
      if (options.simulateDbFailure) {
        throw new Error('Simulated database failure')
      }

      const parsedId = typeof titleId === 'string' ? parseInt(titleId) : titleId
      if (isNaN(parsedId)) {
        throw new Error('Title not found')
      }

      const title = await dbClient.title.findUnique({
        where: { id: parsedId },
        include: { inventory: true }
      })

      if (!title) {
        throw new Error('Title not found')
      }


      // Validate status transition
      await this.validateStatusTransition(title.status, newStatus, title)

      // Perform the update in a transaction
      const result = await dbClient.$transaction(async (tx) => {
        // Update title status
        const updatedTitle = await tx.title.update({
          where: { id: title.id },
          data: { status: newStatus }
        })

        // Record status history
        await tx.titleStatusHistory.create({
          data: {
            titleId: title.id,
            fromStatus: title.status,
            toStatus: newStatus,
            reason,
            changedAt: new Date()
          }
        })

        // Get updated status history
        const statusHistory = await tx.titleStatusHistory.findMany({
          where: { titleId: title.id },
          orderBy: { changedAt: 'desc' }
        })

        return {
          id: updatedTitle.id,
          status: updatedTitle.status,
          statusHistory: statusHistory.map(h => ({
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            reason: h.reason,
            changedAt: h.changedAt
          }))
        }
      })

      // Send notification (non-blocking)
      try {
        await this.sendStatusChangeNotification(
          title.id,
          title.status,
          newStatus,
          reason
        )
      } catch (notificationError) {
        // Log notification failure but don't fail the status update
        console.warn('Notification failed:', notificationError)
      }

      return result
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to update title status')
    }
  }

  /**
   * Validate status transition rules
   */
  private static async validateStatusTransition(
    currentStatus: TitleStatus,
    newStatus: TitleStatus,
    title: any
  ): Promise<void> {
    // Check if transition is allowed
    const allowedTransitions = this.VALID_TRANSITIONS[currentStatus]
    if (!allowedTransitions.includes(newStatus)) {
      throw new StatusTransitionError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        currentStatus,
        newStatus,
        title.id.toString()
      )
    }

    // Business rule: Cannot discontinue title with existing inventory
    if (newStatus === TitleStatus.DISCONTINUED && currentStatus === TitleStatus.ACTIVE) {
      const totalInventory = title.inventory?.reduce(
        (sum: number, inv: any) => sum + inv.currentStock + inv.reservedStock,
        0
      ) || 0

      if (totalInventory > 0) {
        throw new Error('Cannot discontinue title with existing inventory')
      }
    }
  }

  /**
   * Process automated status updates based on inventory levels
   */
  static async processAutomatedStatusUpdates(): Promise<AutomatedStatusResult> {
    const updatedTitles: number[] = []
    const errors: Array<{ titleId: number; error: string }> = []
    let processed = 0

    try {
      // Find pre-order titles with inventory
      const preOrderTitles = await dbClient.title.findMany({
        where: { status: TitleStatus.PRE_ORDER },
        include: { inventory: true }
      })

      for (const title of preOrderTitles) {
        processed++
        const totalInventory = title.inventory.reduce(
          (sum, inv) => sum + inv.currentStock,
          0
        )

        if (totalInventory > 0) {
          try {
            await this.updateTitleStatus(
              title.id,
              TitleStatus.ACTIVE,
              'Automated activation - inventory received'
            )
            updatedTitles.push(title.id)
          } catch (error) {
            errors.push({
              titleId: title.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
      }

      // Find active titles with zero inventory for auto-discontinuation
      const activeTitles = await dbClient.title.findMany({
        where: { status: TitleStatus.ACTIVE },
        include: { inventory: true }
      })

      for (const title of activeTitles) {
        processed++
        const totalInventory = title.inventory.reduce(
          (sum, inv) => sum + inv.currentStock + inv.reservedStock,
          0
        )

        if (totalInventory === 0) {
          try {
            await this.updateTitleStatus(
              title.id,
              TitleStatus.DISCONTINUED,
              'Automated discontinuation - zero inventory'
            )
            updatedTitles.push(title.id)
          } catch (error) {
            errors.push({
              titleId: title.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
      }

      return {
        processed,
        updatedTitles,
        errors
      }
    } catch (error) {
      throw new Error('Failed to process automated status updates')
    }
  }

  /**
   * Send status change notification
   */
  static async sendStatusChangeNotification(
    titleId: number,
    fromStatus: TitleStatus,
    toStatus: TitleStatus,
    reason: string,
    options: {
      mockFailure?: boolean
      suppressNotifications?: boolean
      forceFailure?: boolean
    } = {}
  ): Promise<NotificationResult[]> {
    if (options.suppressNotifications) {
      return []
    }

    try {
      const title = await dbClient.title.findUnique({
        where: { id: titleId }
      })

      if (!title || !title.publisher) {
        return []
      }

      if (options.mockFailure || options.forceFailure) {
        // Log failed notification
        await dbClient.notificationLog.create({
          data: {
            titleId,
            recipient: title.publisher,
            subject: `Title Status Change: ${title.title}`,
            message: `Status changed from ${fromStatus} to ${toStatus}. Reason: ${reason}`,
            status: NotificationStatus.FAILED,
            failureReason: 'Mock failure for testing'
          }
        })
        return []
      }

      const notification = {
        recipient: title.publisher,
        subject: `Title Status Change: ${title.title}`,
        message: `Dear Publisher,\n\nThe status of "${title.title}" (ISBN: ${title.isbn}) has been changed from ${fromStatus} to ${toStatus}.\n\nReason: ${reason}\n\nBest regards,\nBookStock System`,
        status: 'sent' as const
      }

      // Log successful notification
      await dbClient.notificationLog.create({
        data: {
          titleId,
          recipient: notification.recipient,
          subject: notification.subject,
          message: notification.message,
          status: NotificationStatus.SENT,
          sentAt: new Date()
        }
      })

      return [notification]
    } catch (error) {
      // Log notification failure
      try {
        const title = await dbClient.title.findUnique({ where: { id: titleId } })
        if (title?.publisher) {
          await dbClient.notificationLog.create({
            data: {
              titleId,
              recipient: title.publisher,
              subject: `Title Status Change: ${title.title}`,
              message: `Status changed from ${fromStatus} to ${toStatus}. Reason: ${reason}`,
              status: NotificationStatus.FAILED,
              failureReason: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      } catch (logError) {
        console.error('Failed to log notification failure:', logError)
      }

      return []
    }
  }

  /**
   * Queue batch notifications for processing
   */
  static async queueBatchNotifications(
    notifications: StatusChangeNotification[]
  ): Promise<BatchNotificationResult> {
    let queued = 0
    let failed = 0
    const errors: Array<{ titleId: number; error: string }> = []

    for (const notification of notifications) {
      try {
        await this.sendStatusChangeNotification(
          notification.titleId,
          notification.fromStatus,
          notification.toStatus,
          notification.reason
        )
        queued++
      } catch (error) {
        failed++
        errors.push({
          titleId: notification.titleId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return { queued, failed, errors }
  }

  /**
   * Process retirement candidates
   */
  static async processRetirementCandidates(
    thresholdDays: number,
    options: { batchSize?: number } = {}
  ): Promise<RetirementResult> {
    const batchSize = options.batchSize || 100
    const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000)
    const retiredTitles: number[] = []
    let batchesProcessed = 0

    try {
      // Find discontinued titles that are candidates for retirement
      const candidates = await dbClient.title.findMany({
        where: {
          status: TitleStatus.DISCONTINUED,
          isRetired: false,
          statusHistory: {
            some: {
              toStatus: TitleStatus.DISCONTINUED,
              changedAt: { lt: thresholdDate }
            }
          }
        },
        include: {
          stockMovements: {
            where: {
              movementDate: { gt: thresholdDate }
            }
          }
        }
      })

      // Process in batches
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize)
        batchesProcessed++

        for (const title of batch) {
          // Skip if there's been recent sales activity
          if (title.stockMovements.length === 0) {
            await dbClient.title.update({
              where: { id: title.id },
              data: {
                isRetired: true,
                retiredAt: new Date()
              }
            })
            retiredTitles.push(title.id)
          }
        }
      }

      return {
        retiredTitles,
        batchesProcessed,
        totalCandidates: candidates.length
      }
    } catch (error) {
      throw new RetirementError('Failed to process retirement candidates')
    }
  }

  /**
   * Archive title data
   */
  static async archiveTitleData(titleId: number): Promise<ArchiveResult> {
    try {
      await dbClient.title.update({
        where: { id: titleId },
        data: {
          isArchived: true,
          archivedAt: new Date()
        }
      })

      return {
        archived: true,
        archiveLocation: `archive/titles/${titleId}_${Date.now()}.json`
      }
    } catch (error) {
      throw new RetirementError('Failed to archive title data', titleId.toString())
    }
  }

  /**
   * Generate retirement report
   */
  static async generateRetirementReport(
    startDate: Date,
    endDate: Date
  ): Promise<RetirementReport> {
    const retiredTitles = await dbClient.title.findMany({
      where: {
        isRetired: true,
        retiredAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        isbn: true,
        title: true,
        retiredAt: true
      }
    })

    return {
      totalRetired: retiredTitles.length,
      retiredTitles,
      periodStart: startDate,
      periodEnd: endDate
    }
  }
}

// Export error classes for use in tests
export { StatusTransitionError, NotificationError, RetirementError }