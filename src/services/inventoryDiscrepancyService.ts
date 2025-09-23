import { PrismaClient, Inventory, Prisma } from '@prisma/client'
import RealTimeInventoryService, { InventorySnapshot, InventoryUpdateEvent } from './realTimeInventoryService'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces for Discrepancy Detection
export interface DiscrepancyAlert {
  id: string
  type: 'STOCK_NEGATIVE' | 'STOCK_THRESHOLD' | 'VALUE_ANOMALY' | 'SYNC_MISMATCH' | 'STALE_DATA'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  inventoryId: number
  titleId: number
  warehouseId: number
  expectedValue?: number
  actualValue?: number
  threshold?: number
  detectedAt: Date
  resolvedAt?: Date
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE'
  metadata?: Record<string, any>
}

export interface DiscrepancyThreshold {
  type: 'MIN_STOCK' | 'MAX_STOCK' | 'STOCK_CHANGE_RATE' | 'VALUE_VARIANCE' | 'AGE_THRESHOLD'
  warehouseId?: number
  titleId?: number
  threshold: number
  timeWindow?: number // in minutes
  isActive: boolean
  alertSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface StockAnomalyDetection {
  titleId: number
  warehouseId: number
  anomalyType: 'SUDDEN_SPIKE' | 'SUDDEN_DROP' | 'UNUSUAL_PATTERN' | 'STAGNANT_STOCK'
  confidence: number // 0-1
  detectedAt: Date
  context: {
    timeWindow: number
    averageMovement: number
    currentMovement: number
    standardDeviation: number
  }
}

export interface SynchronizationDiscrepancy {
  titleId: number
  warehousePair: [number, number]
  discrepancyType: 'STOCK_MISMATCH' | 'COST_VARIANCE' | 'TIMESTAMP_SKEW'
  severity: number // 0-1
  details: {
    warehouse1Stock: number
    warehouse2Stock: number
    expectedDifference: number
    actualDifference: number
    lastSyncTime: Date
  }
}

export class InventoryDiscrepancyService {
  private static thresholds: DiscrepancyThreshold[] = []
  private static activeAlerts: Map<string, DiscrepancyAlert> = new Map()
  private static anomalyHistory: StockAnomalyDetection[] = []

  /**
   * Sub-task 4: Build inventory discrepancy detection and alerts
   */

  // Initialize discrepancy monitoring with default thresholds
  static async initializeMonitoring(): Promise<void> {
    try {
      // Set up default monitoring thresholds
      const defaultThresholds: DiscrepancyThreshold[] = [
        {
          type: 'MIN_STOCK',
          threshold: 0,
          isActive: true,
          alertSeverity: 'HIGH'
        },
        {
          type: 'STOCK_CHANGE_RATE',
          threshold: 100, // More than 100 units in 10 minutes
          timeWindow: 10,
          isActive: true,
          alertSeverity: 'MEDIUM'
        },
        {
          type: 'VALUE_VARIANCE',
          threshold: 0.2, // 20% variance in cost
          isActive: true,
          alertSeverity: 'LOW'
        },
        {
          type: 'AGE_THRESHOLD',
          threshold: 24 * 60, // 24 hours without update
          isActive: true,
          alertSeverity: 'LOW'
        }
      ]

      this.thresholds = defaultThresholds

      // Subscribe to real-time inventory updates
      const realTimeService = RealTimeInventoryService.getInstance()
      realTimeService.subscribe({
        subscriberId: 'discrepancy-monitor',
        callback: this.handleInventoryUpdate.bind(this)
      })
    } catch (error) {
      throw new Error('Failed to initialize discrepancy monitoring')
    }
  }

  // Handle real-time inventory updates for discrepancy detection
  private static async handleInventoryUpdate(event: InventoryUpdateEvent): Promise<void> {
    try {
      // Check for negative stock
      await this.checkNegativeStock(event)

      // Check for unusual stock changes
      await this.checkStockChangeAnomaly(event)

      // Check threshold violations
      await this.checkThresholdViolations(event)

      // Update stale data monitoring
      await this.updateStaleDataTracking(event)
    } catch (error) {
      console.error('Error handling inventory update for discrepancy detection:', error)
    }
  }

  // Check for negative stock discrepancies
  private static async checkNegativeStock(event: InventoryUpdateEvent): Promise<void> {
    if (event.newStock < 0) {
      const alert: DiscrepancyAlert = {
        id: `NEG_STOCK_${event.inventoryId}_${Date.now()}`,
        type: 'STOCK_NEGATIVE',
        severity: 'CRITICAL',
        title: 'Negative Stock Alert',
        description: `Stock level has gone negative: ${event.newStock}`,
        inventoryId: event.inventoryId,
        titleId: event.titleId,
        warehouseId: event.warehouseId,
        expectedValue: 0,
        actualValue: event.newStock,
        detectedAt: new Date(),
        status: 'OPEN',
        metadata: {
          previousStock: event.previousStock,
          changeAmount: event.changeAmount,
          reason: event.reason
        }
      }

      this.activeAlerts.set(alert.id, alert)
      await this.sendAlert(alert)
    }
  }

  // Check for stock change anomalies
  private static async checkStockChangeAnomaly(event: InventoryUpdateEvent): Promise<void> {
    try {
      const threshold = this.thresholds.find(t => t.type === 'STOCK_CHANGE_RATE')
      if (!threshold || !threshold.isActive) return

      const timeWindow = threshold.timeWindow || 10
      const changeThreshold = threshold.threshold

      // Get recent stock movements for this inventory
      const recentMovements = await dbClient.stockMovement.findMany({
        where: {
          titleId: event.titleId,
          warehouseId: event.warehouseId,
          movementDate: {
            gte: new Date(Date.now() - timeWindow * 60 * 1000)
          }
        }
      })

      const totalChange = recentMovements.reduce((sum, movement) => sum + Math.abs(movement.quantity), 0)

      if (totalChange > changeThreshold) {
        const alert: DiscrepancyAlert = {
          id: `CHANGE_ANOMALY_${event.inventoryId}_${Date.now()}`,
          type: 'VALUE_ANOMALY',
          severity: threshold.alertSeverity,
          title: 'Unusual Stock Change Rate',
          description: `Stock changed by ${totalChange} units in ${timeWindow} minutes`,
          inventoryId: event.inventoryId,
          titleId: event.titleId,
          warehouseId: event.warehouseId,
          expectedValue: changeThreshold,
          actualValue: totalChange,
          threshold: changeThreshold,
          detectedAt: new Date(),
          status: 'OPEN',
          metadata: {
            timeWindow,
            recentMovements: recentMovements.length,
            averageChangePerMovement: totalChange / recentMovements.length
          }
        }

        this.activeAlerts.set(alert.id, alert)
        await this.sendAlert(alert)
      }
    } catch (error) {
      console.error('Error checking stock change anomaly:', error)
    }
  }

  // Check threshold violations
  private static async checkThresholdViolations(event: InventoryUpdateEvent): Promise<void> {
    try {
      // Check minimum stock threshold
      const minStockThreshold = this.thresholds.find(t =>
        t.type === 'MIN_STOCK' &&
        t.isActive &&
        (!t.warehouseId || t.warehouseId === event.warehouseId) &&
        (!t.titleId || t.titleId === event.titleId)
      )

      if (minStockThreshold && event.newStock <= minStockThreshold.threshold) {
        const alert: DiscrepancyAlert = {
          id: `MIN_STOCK_${event.inventoryId}_${Date.now()}`,
          type: 'STOCK_THRESHOLD',
          severity: minStockThreshold.alertSeverity,
          title: 'Low Stock Alert',
          description: `Stock level ${event.newStock} is at or below minimum threshold ${minStockThreshold.threshold}`,
          inventoryId: event.inventoryId,
          titleId: event.titleId,
          warehouseId: event.warehouseId,
          expectedValue: minStockThreshold.threshold,
          actualValue: event.newStock,
          threshold: minStockThreshold.threshold,
          detectedAt: new Date(),
          status: 'OPEN'
        }

        this.activeAlerts.set(alert.id, alert)
        await this.sendAlert(alert)
      }
    } catch (error) {
      console.error('Error checking threshold violations:', error)
    }
  }

  // Update stale data tracking
  private static async updateStaleDataTracking(event: InventoryUpdateEvent): Promise<void> {
    // This would typically update a tracking system for data freshness
    // For now, we'll just log that the data was updated
    console.log(`Updated stale data tracking for inventory ${event.inventoryId}`)
  }

  // Detect synchronization discrepancies between warehouses
  static async detectSynchronizationDiscrepancies(
    titleId: number,
    warehouseIds?: number[]
  ): Promise<SynchronizationDiscrepancy[]> {
    try {
      const targetWarehouses = warehouseIds || await this.getAllWarehouseIds()
      const discrepancies: SynchronizationDiscrepancy[] = []

      // Get inventory records for the title across warehouses
      const inventoryRecords = await dbClient.inventory.findMany({
        where: {
          titleId,
          warehouseId: { in: targetWarehouses }
        },
        include: {
          warehouse: true
        }
      })

      // Compare each pair of warehouses
      for (let i = 0; i < inventoryRecords.length; i++) {
        for (let j = i + 1; j < inventoryRecords.length; j++) {
          const inv1 = inventoryRecords[i]
          const inv2 = inventoryRecords[j]

          // Check stock level discrepancies
          const stockDifference = Math.abs(inv1.currentStock - inv2.currentStock)
          const avgStock = (inv1.currentStock + inv2.currentStock) / 2
          const stockVariance = avgStock > 0 ? stockDifference / avgStock : 0

          if (stockVariance > 0.1) { // 10% variance threshold
            discrepancies.push({
              titleId,
              warehousePair: [inv1.warehouseId, inv2.warehouseId],
              discrepancyType: 'STOCK_MISMATCH',
              severity: Math.min(stockVariance, 1),
              details: {
                warehouse1Stock: inv1.currentStock,
                warehouse2Stock: inv2.currentStock,
                expectedDifference: 0,
                actualDifference: stockDifference,
                lastSyncTime: new Date(Math.max(inv1.updatedAt.getTime(), inv2.updatedAt.getTime()))
              }
            })
          }

          // Check cost variance
          const cost1 = Number(inv1.averageCost || 0)
          const cost2 = Number(inv2.averageCost || 0)
          const costDifference = Math.abs(cost1 - cost2)
          const avgCost = (cost1 + cost2) / 2
          const costVariance = avgCost > 0 ? costDifference / avgCost : 0

          if (costVariance > 0.05) { // 5% cost variance threshold
            discrepancies.push({
              titleId,
              warehousePair: [inv1.warehouseId, inv2.warehouseId],
              discrepancyType: 'COST_VARIANCE',
              severity: Math.min(costVariance, 1),
              details: {
                warehouse1Stock: cost1,
                warehouse2Stock: cost2,
                expectedDifference: 0,
                actualDifference: costDifference,
                lastSyncTime: new Date(Math.max(inv1.updatedAt.getTime(), inv2.updatedAt.getTime()))
              }
            })
          }
        }
      }

      return discrepancies
    } catch (error) {
      throw new Error('Failed to detect synchronization discrepancies')
    }
  }

  // Perform comprehensive discrepancy scan
  static async performComprehensiveDiscrepancyScan(
    warehouseId?: number
  ): Promise<{
    scanId: string
    scanTime: Date
    totalItemsScanned: number
    discrepanciesFound: number
    alerts: DiscrepancyAlert[]
    anomalies: StockAnomalyDetection[]
    syncIssues: SynchronizationDiscrepancy[]
  }> {
    try {
      const scanId = `SCAN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const scanTime = new Date()
      const alerts: DiscrepancyAlert[] = []
      const anomalies: StockAnomalyDetection[] = []
      const syncIssues: SynchronizationDiscrepancy[] = []

      // Get inventory items to scan
      const inventoryItems = await dbClient.inventory.findMany({
        where: warehouseId ? { warehouseId } : {},
        include: {
          title: true,
          warehouse: true
        }
      })

      let totalItemsScanned = 0
      let discrepanciesFound = 0

      for (const item of inventoryItems) {
        totalItemsScanned++

        // Check for negative stock
        if (item.currentStock < 0) {
          const alert: DiscrepancyAlert = {
            id: `SCAN_NEG_${item.id}_${scanId}`,
            type: 'STOCK_NEGATIVE',
            severity: 'CRITICAL',
            title: 'Negative Stock Detected',
            description: `Inventory item has negative stock: ${item.currentStock}`,
            inventoryId: item.id,
            titleId: item.titleId,
            warehouseId: item.warehouseId,
            actualValue: item.currentStock,
            detectedAt: scanTime,
            status: 'OPEN'
          }
          alerts.push(alert)
          this.activeAlerts.set(alert.id, alert)
          discrepanciesFound++
        }

        // Check for stale data
        const ageThreshold = this.thresholds.find(t => t.type === 'AGE_THRESHOLD')
        if (ageThreshold && ageThreshold.isActive) {
          const ageInMinutes = (scanTime.getTime() - item.updatedAt.getTime()) / (1000 * 60)
          if (ageInMinutes > ageThreshold.threshold) {
            const alert: DiscrepancyAlert = {
              id: `SCAN_STALE_${item.id}_${scanId}`,
              type: 'STALE_DATA',
              severity: ageThreshold.alertSeverity,
              title: 'Stale Inventory Data',
              description: `Inventory data hasn't been updated for ${Math.round(ageInMinutes)} minutes`,
              inventoryId: item.id,
              titleId: item.titleId,
              warehouseId: item.warehouseId,
              actualValue: ageInMinutes,
              threshold: ageThreshold.threshold,
              detectedAt: scanTime,
              status: 'OPEN'
            }
            alerts.push(alert)
            this.activeAlerts.set(alert.id, alert)
            discrepanciesFound++
          }
        }

        // Detect stock movement anomalies
        const anomaly = await this.detectStockAnomaly(item.titleId, item.warehouseId)
        if (anomaly) {
          anomalies.push(anomaly)
          discrepanciesFound++
        }

        // Check synchronization with other warehouses
        const syncDiscrepancies = await this.detectSynchronizationDiscrepancies(item.titleId)
        syncIssues.push(...syncDiscrepancies)
        if (syncDiscrepancies.length > 0) {
          discrepanciesFound += syncDiscrepancies.length
        }
      }

      return {
        scanId,
        scanTime,
        totalItemsScanned,
        discrepanciesFound,
        alerts,
        anomalies,
        syncIssues
      }
    } catch (error) {
      throw new Error('Failed to perform comprehensive discrepancy scan')
    }
  }

  // Detect stock movement anomalies using statistical analysis
  private static async detectStockAnomaly(
    titleId: number,
    warehouseId: number
  ): Promise<StockAnomalyDetection | null> {
    try {
      const timeWindow = 7 * 24 * 60; // 7 days in minutes
      const cutoffDate = new Date(Date.now() - timeWindow * 60 * 1000)

      // Get recent stock movements
      const movements = await dbClient.stockMovement.findMany({
        where: {
          titleId,
          warehouseId,
          movementDate: { gte: cutoffDate }
        },
        orderBy: { movementDate: 'desc' }
      })

      if (movements.length < 5) {
        return null // Not enough data for anomaly detection
      }

      // Calculate movement statistics
      const quantities = movements.map(m => Math.abs(m.quantity))
      const average = quantities.reduce((sum, q) => sum + q, 0) / quantities.length
      const variance = quantities.reduce((sum, q) => sum + Math.pow(q - average, 2), 0) / quantities.length
      const standardDeviation = Math.sqrt(variance)

      // Check recent movements against historical patterns
      const recentMovements = movements.slice(0, 3)
      const recentAverage = recentMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0) / recentMovements.length

      // Detect anomalies
      const threshold = 2; // 2 standard deviations
      const zScore = standardDeviation > 0 ? Math.abs(recentAverage - average) / standardDeviation : 0

      if (zScore > threshold) {
        const anomalyType = recentAverage > average ? 'SUDDEN_SPIKE' : 'SUDDEN_DROP'

        return {
          titleId,
          warehouseId,
          anomalyType,
          confidence: Math.min(zScore / 3, 1), // Normalize to 0-1
          detectedAt: new Date(),
          context: {
            timeWindow,
            averageMovement: average,
            currentMovement: recentAverage,
            standardDeviation
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error detecting stock anomaly:', error)
      return null
    }
  }

  // Send alert notification
  private static async sendAlert(alert: DiscrepancyAlert): Promise<void> {
    try {
      // In a real implementation, this would send notifications via:
      // - Email
      // - SMS
      // - Slack/Teams
      // - Push notifications
      // - Dashboard alerts

      console.log(`🚨 INVENTORY ALERT [${alert.severity}]: ${alert.title}`)
      console.log(`   Description: ${alert.description}`)
      console.log(`   Inventory ID: ${alert.inventoryId}`)
      console.log(`   Detected: ${alert.detectedAt.toISOString()}`)

      // Emit real-time event for dashboard updates
      const realTimeService = RealTimeInventoryService.getInstance()
      realTimeService.emitInventoryEvent({
        type: 'ADJUSTMENT',
        inventoryId: alert.inventoryId,
        warehouseId: alert.warehouseId,
        titleId: alert.titleId,
        previousStock: alert.expectedValue || 0,
        newStock: alert.actualValue || 0,
        changeAmount: 0,
        reason: `Alert: ${alert.title}`,
        timestamp: alert.detectedAt
      })
    } catch (error) {
      console.error('Error sending alert:', error)
    }
  }

  // Get all warehouse IDs
  private static async getAllWarehouseIds(): Promise<number[]> {
    const warehouses = await dbClient.warehouse.findMany({
      select: { id: true },
      where: { isActive: true }
    })
    return warehouses.map(w => w.id)
  }

  // Configure custom threshold
  static setThreshold(threshold: DiscrepancyThreshold): void {
    const existingIndex = this.thresholds.findIndex(t =>
      t.type === threshold.type &&
      t.warehouseId === threshold.warehouseId &&
      t.titleId === threshold.titleId
    )

    if (existingIndex >= 0) {
      this.thresholds[existingIndex] = threshold
    } else {
      this.thresholds.push(threshold)
    }
  }

  // Get all active alerts
  static getActiveAlerts(): DiscrepancyAlert[] {
    return Array.from(this.activeAlerts.values())
  }

  // Resolve alert
  static resolveAlert(alertId: string, status: 'RESOLVED' | 'FALSE_POSITIVE' = 'RESOLVED'): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.status = status
      alert.resolvedAt = new Date()
      // Keep resolved alerts in the map for tracking
      this.activeAlerts.set(alertId, alert)
      return true
    }
    return false
  }

  // Get anomaly history
  static getAnomalyHistory(
    titleId?: number,
    warehouseId?: number,
    days: number = 7
  ): StockAnomalyDetection[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return this.anomalyHistory.filter(anomaly =>
      anomaly.detectedAt >= cutoffDate &&
      (!titleId || anomaly.titleId === titleId) &&
      (!warehouseId || anomaly.warehouseId === warehouseId)
    )
  }
}

// Export service and types
export default InventoryDiscrepancyService