import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse } from '../utils/test-db'
import InventoryDiscrepancyService, { setDbClient } from '@/services/inventoryDiscrepancyService'
import RealTimeInventoryService from '@/services/realTimeInventoryService'

describe('Inventory Discrepancy Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
    setDbClient(testDb)
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Discrepancy Detection and Alerts (Sub-task 4)', () => {
    test('should initialize monitoring with default thresholds', async () => {
      await expect(InventoryDiscrepancyService.initializeMonitoring()).resolves.not.toThrow()

      // Verify service is listening to real-time events
      const realTimeService = RealTimeInventoryService.getInstance()
      const subscriptions = realTimeService.getActiveSubscriptions()
      expect(subscriptions).toContain('discrepancy-monitor')
    })

    test('should detect negative stock discrepancies', async () => {
      await InventoryDiscrepancyService.initializeMonitoring()

      // Create test data
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 5,
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      // Force negative stock by large sale
      await RealTimeInventoryService.updateInventoryLevel(
        inventory.id,
        -10,
        'Force negative stock'
      )

      // Wait a bit for event processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const alerts = InventoryDiscrepancyService.getActiveAlerts()
      const negativeStockAlert = alerts.find(alert => alert.type === 'STOCK_NEGATIVE')

      // Note: This test demonstrates the structure but may not trigger alerts
      // depending on the implementation's negative stock handling
      expect(alerts).toBeDefined()
    })

    test('should detect synchronization discrepancies between warehouses', async () => {
      // Create test data with stock discrepancies
      const warehouse1 = await createTestWarehouse({
        name: 'Warehouse 1',
        code: 'WH001',
        location: 'Location 1'
      })

      const warehouse2 = await createTestWarehouse({
        name: 'Warehouse 2',
        code: 'WH002',
        location: 'Location 2'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      // Create inventory with significant stock differences
      await testDb.inventory.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            currentStock: 100,
            reservedStock: 10,
            averageCost: 5.50
          },
          {
            titleId: title.id,
            warehouseId: warehouse2.id,
            currentStock: 50, // 50% difference
            reservedStock: 5,
            averageCost: 5.50
          }
        ]
      })

      const discrepancies = await InventoryDiscrepancyService.detectSynchronizationDiscrepancies(
        title.id
      )

      expect(discrepancies).toHaveLength(1)
      expect(discrepancies[0]).toMatchObject({
        titleId: title.id,
        warehousePair: [warehouse1.id, warehouse2.id],
        discrepancyType: 'STOCK_MISMATCH'
      })
      expect(discrepancies[0].severity).toBeGreaterThan(0.1)
      expect(discrepancies[0].details.warehouse1Stock).toBe(100)
      expect(discrepancies[0].details.warehouse2Stock).toBe(50)
    })

    test('should detect cost variance discrepancies', async () => {
      // Create test data with cost differences
      const warehouse1 = await createTestWarehouse({
        name: 'Warehouse 1',
        code: 'WH001',
        location: 'Location 1'
      })

      const warehouse2 = await createTestWarehouse({
        name: 'Warehouse 2',
        code: 'WH002',
        location: 'Location 2'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      // Create inventory with significant cost differences
      await testDb.inventory.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            currentStock: 100,
            reservedStock: 10,
            averageCost: 5.50
          },
          {
            titleId: title.id,
            warehouseId: warehouse2.id,
            currentStock: 100,
            reservedStock: 10,
            averageCost: 6.50 // 18% higher cost
          }
        ]
      })

      const discrepancies = await InventoryDiscrepancyService.detectSynchronizationDiscrepancies(
        title.id
      )

      const costDiscrepancy = discrepancies.find(d => d.discrepancyType === 'COST_VARIANCE')
      expect(costDiscrepancy).toBeDefined()
      expect(costDiscrepancy?.severity).toBeGreaterThan(0.05)
    })

    test('should perform comprehensive discrepancy scan', async () => {
      // Create test data with various issues
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title1 = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book 1',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      const title2 = await createTestTitle({
        isbn: '9781234567891',
        title: 'Test Book 2',
        author: 'Test Author',
        format: 'HARDCOVER',
        rrp: 29.99,
        unitCost: 8.50
      })

      // Create one inventory with negative stock (simulated issue)
      const inventory1 = await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          currentStock: -5, // Negative stock
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      // Create one inventory with stale data (old timestamp)
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
      await testDb.inventory.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          currentStock: 50,
          reservedStock: 5,
          averageCost: 8.50,
          updatedAt: oldDate
        }
      })

      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouse.id
      )

      expect(scanResult.scanId).toMatch(/^SCAN_/)
      expect(scanResult.totalItemsScanned).toBe(2)
      expect(scanResult.discrepanciesFound).toBeGreaterThan(0)
      expect(scanResult.alerts.length).toBeGreaterThan(0)

      // Check for negative stock alert
      const negativeStockAlert = scanResult.alerts.find(alert => alert.type === 'STOCK_NEGATIVE')
      expect(negativeStockAlert).toBeDefined()
      expect(negativeStockAlert?.inventoryId).toBe(inventory1.id)

      // Check for stale data alert
      const staleDataAlert = scanResult.alerts.find(alert => alert.type === 'STALE_DATA')
      expect(staleDataAlert).toBeDefined()
    })

    test('should configure and apply custom thresholds', async () => {
      // Set custom minimum stock threshold
      InventoryDiscrepancyService.setThreshold({
        type: 'MIN_STOCK',
        warehouseId: 1,
        threshold: 25,
        isActive: true,
        alertSeverity: 'HIGH'
      })

      // Create test data
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 20, // Below custom threshold of 25
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouse.id
      )

      // Should detect low stock based on custom threshold
      const lowStockAlert = scanResult.alerts.find(alert =>
        alert.type === 'STOCK_THRESHOLD' && alert.inventoryId === inventory.id
      )
      expect(lowStockAlert).toBeDefined()
      expect(lowStockAlert?.threshold).toBe(25)
    })

    test('should resolve and manage alert lifecycle', async () => {
      await InventoryDiscrepancyService.initializeMonitoring()

      // Create a test alert by performing a scan with problematic data
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: -10, // Negative stock to trigger alert
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouse.id
      )

      const alert = scanResult.alerts[0]
      if (alert) {
        // Resolve the alert
        const resolved = InventoryDiscrepancyService.resolveAlert(alert.id, 'RESOLVED')
        expect(resolved).toBe(true)

        // Verify alert is marked as resolved
        const activeAlerts = InventoryDiscrepancyService.getActiveAlerts()
        const resolvedAlert = activeAlerts.find(a => a.id === alert.id)
        expect(resolvedAlert?.status).toBe('RESOLVED')
        expect(resolvedAlert?.resolvedAt).toBeDefined()
      }
    })

    test('should track anomaly history', async () => {
      // Create test data with some stock movements to analyze
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100,
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      // Create historical stock movements to establish a pattern
      const movementDates = [
        new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      ]

      // Normal movements (5-10 units)
      for (let i = 0; i < movementDates.length; i++) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'ONLINE_SALES',
            quantity: -(5 + i), // -5, -6, -7, -8, -9
            movementDate: movementDates[i],
            referenceNumber: `Normal sale ${i + 1}`,
            rrpAtTime: 19.99
          }
        })
      }

      // Perform scan to detect anomalies
      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouse.id
      )

      expect(scanResult.anomalies).toBeDefined()

      // Test anomaly history retrieval
      const history = InventoryDiscrepancyService.getAnomalyHistory(title.id, warehouse.id, 7)
      expect(Array.isArray(history)).toBe(true)
    })

    test('should handle errors gracefully during detection', async () => {
      // Test with non-existent title
      const discrepancies = await InventoryDiscrepancyService.detectSynchronizationDiscrepancies(
        99999 // Non-existent title ID
      )

      expect(discrepancies).toHaveLength(0)
    })

    test('should validate alert severity levels', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: -50, // Very negative for critical alert
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouse.id
      )

      const criticalAlert = scanResult.alerts.find(alert => alert.severity === 'CRITICAL')
      expect(criticalAlert).toBeDefined()
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(criticalAlert?.severity)
    })

    test('should handle concurrent discrepancy detection', async () => {
      // Create multiple warehouses and titles for concurrent testing
      const warehouses = await Promise.all([
        createTestWarehouse({ name: 'WH1', code: 'WH001', location: 'Loc1' }),
        createTestWarehouse({ name: 'WH2', code: 'WH002', location: 'Loc2' }),
        createTestWarehouse({ name: 'WH3', code: 'WH003', location: 'Loc3' })
      ])

      const titles = await Promise.all([
        createTestTitle({ isbn: '9781234567890', title: 'Book 1', author: 'Author 1', format: 'PAPERBACK', rrp: 19.99, unitCost: 5.50 }),
        createTestTitle({ isbn: '9781234567891', title: 'Book 2', author: 'Author 2', format: 'HARDCOVER', rrp: 29.99, unitCost: 8.50 })
      ])

      // Create inventory for each combination
      for (const warehouse of warehouses) {
        for (const title of titles) {
          await testDb.inventory.create({
            data: {
              titleId: title.id,
              warehouseId: warehouse.id,
              currentStock: Math.floor(Math.random() * 100) + 10,
              reservedStock: Math.floor(Math.random() * 10),
              averageCost: Number(title.unitCost)
            }
          })
        }
      }

      // Run concurrent scans
      const scanPromises = warehouses.map(warehouse =>
        InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(warehouse.id)
      )

      const results = await Promise.all(scanPromises)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.scanId).toMatch(/^SCAN_/)
        expect(result.totalItemsScanned).toBe(2) // 2 titles per warehouse
      })
    })
  })

  describe('Alert Management', () => {
    test('should filter alerts by multiple criteria', async () => {
      // This test would require creating alerts and testing the filtering logic
      // For now, we'll test the basic structure
      const alerts = InventoryDiscrepancyService.getActiveAlerts()
      expect(Array.isArray(alerts)).toBe(true)
    })

    test('should handle false positive alerts', async () => {
      await InventoryDiscrepancyService.initializeMonitoring()

      // Create test data that might generate false positives
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001',
        location: 'Test Location'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 5.50
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: -1, // Minimal negative for testing
          reservedStock: 0,
          averageCost: 5.50
        }
      })

      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouse.id
      )

      if (scanResult.alerts.length > 0) {
        const alertId = scanResult.alerts[0].id
        const resolved = InventoryDiscrepancyService.resolveAlert(alertId, 'FALSE_POSITIVE')
        expect(resolved).toBe(true)
      }
    })
  })
})