import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'
import { StatusManagementService, StatusTransitionError, NotificationError, setDbClient } from '../../services/statusManagementService'
import { TitleStatus } from '@prisma/client'

describe('StatusManagementService', () => {
  beforeEach(async () => {
    setDbClient(testDb)
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Status Transitions', () => {
    test('should allow valid status transitions', async () => {
      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        status: 'PRE_ORDER'
      })


      const result = await StatusManagementService.updateTitleStatus(
        title.id,
        TitleStatus.ACTIVE,
        'Manual activation'
      )

      expect(result.status).toBe(TitleStatus.ACTIVE)
      expect(result.statusHistory).toHaveLength(1)
      expect(result.statusHistory[0].fromStatus).toBe(TitleStatus.PRE_ORDER)
      expect(result.statusHistory[0].toStatus).toBe(TitleStatus.ACTIVE)
      expect(result.statusHistory[0].reason).toBe('Manual activation')
    })

    test('should prevent invalid status transitions', async () => {
      const title = await createTestTitle({
        isbn: '9781234567891',
        title: 'Test Book 2',
        status: TitleStatus.DISCONTINUED
      })

      await expect(
        StatusManagementService.updateTitleStatus(
          title.id,
          TitleStatus.PRE_ORDER,
          'Invalid transition'
        )
      ).rejects.toThrow(StatusTransitionError)
    })

    test('should validate business rules for status changes', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW001'
      })

      const title = await createTestTitle({
        isbn: '9781234567892',
        title: 'Test Book 3',
        status: TitleStatus.ACTIVE
      })

      // Create inventory to prevent discontinuation
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        quantityOnHand: 100,
        quantityReserved: 0
      })

      await expect(
        StatusManagementService.updateTitleStatus(
          title.id,
          TitleStatus.DISCONTINUED,
          'Force discontinue'
        )
      ).rejects.toThrow('Cannot discontinue title with existing inventory')
    })

    test('should record status change history', async () => {
      const title = await createTestTitle({
        isbn: '9781234567893',
        title: 'Test Book 4',
        status: 'PRE_ORDER'
      })

      await StatusManagementService.updateTitleStatus(
        title.id,
        TitleStatus.ACTIVE,
        'Launch complete'
      )

      await StatusManagementService.updateTitleStatus(
        title.id,
        TitleStatus.DISCONTINUED,
        'End of life'
      )

      const updatedTitle = await testDb.title.findUnique({
        where: { id: title.id },
        include: { statusHistory: true }
      })

      expect(updatedTitle?.statusHistory).toHaveLength(2)
      expect(updatedTitle?.statusHistory[0].toStatus).toBe(TitleStatus.ACTIVE)
      expect(updatedTitle?.statusHistory[1].toStatus).toBe(TitleStatus.DISCONTINUED)
    })
  })

  describe('Automated Status Updates', () => {
    test('should automatically discontinue titles with zero inventory', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW002'
      })

      const title = await createTestTitle({
        isbn: '9781234567894',
        title: 'Test Book 5',
        status: TitleStatus.ACTIVE
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        quantityOnHand: 0,
        quantityReserved: 0
      })

      const result = await StatusManagementService.processAutomatedStatusUpdates()

      expect(result.updatedTitles).toContain(title.id)

      const updatedTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(updatedTitle?.status).toBe(TitleStatus.DISCONTINUED)
    })

    test('should activate pre-order titles when inventory arrives', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW003'
      })

      const title = await createTestTitle({
        isbn: '9781234567895',
        title: 'Test Book 6',
        status: 'PRE_ORDER'
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        quantityOnHand: 50,
        quantityReserved: 0
      })

      const result = await StatusManagementService.processAutomatedStatusUpdates()

      expect(result.updatedTitles).toContain(title.id)

      const updatedTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(updatedTitle?.status).toBe(TitleStatus.ACTIVE)
    })

    test('should respect minimum stock thresholds for discontinuation', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW004'
      })

      const title = await createTestTitle({
        isbn: '9781234567896',
        title: 'Test Book 7',
        status: TitleStatus.ACTIVE
      })

      // Create low but non-zero inventory
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        quantityOnHand: 5,
        quantityReserved: 0,
        minStockLevel: 10
      })

      const result = await StatusManagementService.processAutomatedStatusUpdates()

      // Should not auto-discontinue because inventory exists
      expect(result.updatedTitles).not.toContain(title.id)

      const updatedTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(updatedTitle?.status).toBe(TitleStatus.ACTIVE)
    })
  })

  describe('Publisher Notifications', () => {
    test('should send notification for status changes', async () => {
      const title = await createTestTitle({
        isbn: '9781234567897',
        title: 'Test Book 8',
        status: 'ACTIVE',
        publisher: 'Test Publisher'
      })

      const notifications = await StatusManagementService.sendStatusChangeNotification(
        title.id,
        TitleStatus.ACTIVE,
        TitleStatus.DISCONTINUED,
        'End of print run'
      )

      expect(notifications).toHaveLength(1)
      expect(notifications[0].recipient).toBe('Test Publisher')
      expect(notifications[0].subject).toContain('Status Change')
      expect(notifications[0].message).toContain('DISCONTINUED')
    })

    test('should queue notifications for batch processing', async () => {
      const titles = await Promise.all([
        createTestTitle({
          isbn: '9781234567898',
          title: 'Test Book 9',
          status: TitleStatus.ACTIVE,
          publisher: 'Publisher A'
        }),
        createTestTitle({
          isbn: '9781234567899',
          title: 'Test Book 10',
          status: TitleStatus.ACTIVE,
          publisher: 'Publisher B'
        })
      ])

      const notifications = await StatusManagementService.queueBatchNotifications([
        {
          titleId: titles[0].id,
          fromStatus: TitleStatus.ACTIVE,
          toStatus: TitleStatus.DISCONTINUED,
          reason: 'Batch update'
        },
        {
          titleId: titles[1].id,
          fromStatus: TitleStatus.ACTIVE,
          toStatus: TitleStatus.DISCONTINUED,
          reason: 'Batch update'
        }
      ])

      expect(notifications.queued).toBe(2)
      expect(notifications.failed).toBe(0)
    })

    test('should handle notification delivery failures gracefully', async () => {
      const title = await createTestTitle({
        isbn: '9781234567900',
        title: 'Test Book 11',
        status: TitleStatus.ACTIVE,
        publisher: 'Invalid Publisher'
      })

      // Mock notification failure
      const result = await StatusManagementService.sendStatusChangeNotification(
        title.id,
        TitleStatus.ACTIVE,
        TitleStatus.DISCONTINUED,
        'Test failure',
        { mockFailure: true }
      )

      expect(result).toHaveLength(0)

      // Should log the failure
      const failedNotifications = await testDb.notificationLog.findMany({
        where: { titleId: title.id, status: 'FAILED' }
      })

      expect(failedNotifications).toHaveLength(1)
    })

    test('should respect notification preferences', async () => {
      const title = await createTestTitle({
        isbn: '9781234567901',
        title: 'Test Book 12',
        status: TitleStatus.ACTIVE,
        publisher: 'Silent Publisher'
      })

      const notifications = await StatusManagementService.sendStatusChangeNotification(
        title.id,
        TitleStatus.ACTIVE,
        TitleStatus.DISCONTINUED,
        'Should be silent',
        { suppressNotifications: true }
      )

      expect(notifications).toHaveLength(0)
    })
  })

  describe('Title Retirement and Archival', () => {
    test('should retire titles that have been discontinued for specified period', async () => {
      // Create title that was discontinued 6 months ago
      const title = await createTestTitle({
        isbn: '9781234567902',
        title: 'Old Discontinued Book',
        status: TitleStatus.DISCONTINUED
      })

      // Manually set status change date to 6 months ago
      await testDb.titleStatusHistory.create({
        data: {
          titleId: title.id,
          fromStatus: TitleStatus.ACTIVE,
          toStatus: TitleStatus.DISCONTINUED,
          reason: 'End of print run',
          changedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months ago
        }
      })

      const result = await StatusManagementService.processRetirementCandidates(120) // 4 months threshold

      expect(result.retiredTitles).toContain(title.id)

      const retiredTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(retiredTitle?.isRetired).toBe(true)
      expect(retiredTitle?.retiredAt).toBeDefined()
    })

    test('should not retire titles with recent sales activity', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW005'
      })

      const title = await createTestTitle({
        isbn: '9781234567903',
        title: 'Recently Sold Book',
        status: TitleStatus.DISCONTINUED
      })

      // Create recent stock movement (sale)
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'ONLINE_SALES',
          quantity: -5,
          referenceNumber: 'Recent sale',
          movementDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
      })

      const result = await StatusManagementService.processRetirementCandidates(120)

      expect(result.retiredTitles).not.toContain(title.id)
    })

    test('should archive old title data while preserving references', async () => {
      const title = await createTestTitle({
        isbn: '9781234567904',
        title: 'Archive Candidate',
        status: TitleStatus.DISCONTINUED,
        isRetired: true
      })

      const archiveResult = await StatusManagementService.archiveTitleData(title.id)

      expect(archiveResult.archived).toBe(true)
      expect(archiveResult.archiveLocation).toBeDefined()

      // Title should still exist but marked as archived
      const archivedTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(archivedTitle?.isArchived).toBe(true)
      expect(archivedTitle?.archivedAt).toBeDefined()
    })

    test('should generate retirement reports', async () => {
      const titles = await Promise.all([
        createTestTitle({
          isbn: '9781234567905',
          title: 'Retirement Report Book 1',
          status: 'DISCONTINUED',
          isRetired: true,
          retiredAt: new Date()
        }),
        createTestTitle({
          isbn: '9781234567906',
          title: 'Retirement Report Book 2',
          status: 'DISCONTINUED',
          isRetired: true,
          retiredAt: new Date()
        })
      ])

      const report = await StatusManagementService.generateRetirementReport(
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        new Date()
      )

      expect(report.totalRetired).toBeGreaterThanOrEqual(2)
      expect(report.retiredTitles).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: titles[0].id }),
        expect.objectContaining({ id: titles[1].id })
      ]))
    })
  })

  describe('Error Handling', () => {
    test('should handle non-existent title gracefully', async () => {
      await expect(
        StatusManagementService.updateTitleStatus(
          'non-existent-id',
          TitleStatus.ACTIVE,
          'Test reason'
        )
      ).rejects.toThrow('Title not found')
    })

    test('should validate status transition rules', async () => {
      const title = await createTestTitle({
        isbn: '9781234567907',
        title: 'Validation Test Book',
        status: TitleStatus.DISCONTINUED
      })

      await expect(
        StatusManagementService.updateTitleStatus(
          title.id,
          TitleStatus.PRE_ORDER,
          'Invalid transition'
        )
      ).rejects.toThrow(StatusTransitionError)
    })

    test('should handle notification system failures', async () => {
      const title = await createTestTitle({
        isbn: '9781234567908',
        title: 'Notification Test Book',
        status: TitleStatus.ACTIVE
      })

      const result = await StatusManagementService.sendStatusChangeNotification(
        title.id,
        TitleStatus.ACTIVE,
        TitleStatus.DISCONTINUED,
        'Test notification failure',
        { forceFailure: true }
      )

      expect(result).toHaveLength(0)
    })

    test('should handle database transaction failures during status updates', async () => {
      const title = await createTestTitle({
        isbn: '9781234567909',
        title: 'Transaction Test Book',
        status: 'ACTIVE'
      })

      // This should throw a meaningful error when database fails
      await expect(
        StatusManagementService.updateTitleStatus(
          title.id,
          TitleStatus.DISCONTINUED,
          'Transaction test',
          { simulateDbFailure: true }
        )
      ).rejects.toThrow('Simulated database failure')
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle batch processing efficiently', async () => {
      // Create multiple titles for batch processing
      const titles = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          createTestTitle({
            isbn: `978123456${String(i).padStart(4, '0')}`,
            title: `Batch Test Book ${i}`,
            status: TitleStatus.ACTIVE
          })
        )
      )

      const startTime = Date.now()
      const result = await StatusManagementService.processAutomatedStatusUpdates()
      const endTime = Date.now()

      // Should complete within reasonable time (2 seconds for 50 titles)
      expect(endTime - startTime).toBeLessThan(2000)
      expect(result.processed).toBe(50)
    })

    test('should paginate large retirement candidate lists', async () => {
      // Create some test titles that are candidates for retirement
      await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          createTestTitle({
            isbn: `978456789${String(i).padStart(4, '0')}`,
            title: `Retirement Candidate ${i}`,
            status: 'DISCONTINUED'
          })
        )
      )

      // Create status history entries to make them retirement candidates
      const titles = await testDb.title.findMany({
        where: { status: 'DISCONTINUED' }
      })

      await Promise.all(
        titles.map(title =>
          testDb.titleStatusHistory.create({
            data: {
              titleId: title.id,
              fromStatus: 'ACTIVE',
              toStatus: 'DISCONTINUED',
              reason: 'Test retirement',
              changedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000) // 150 days ago
            }
          })
        )
      )

      const result = await StatusManagementService.processRetirementCandidates(
        120,
        { batchSize: 10 }
      )

      expect(result.batchesProcessed).toBeGreaterThanOrEqual(1)
      expect(result.totalCandidates).toBeDefined()
      expect(result.retiredTitles.length).toBeGreaterThan(0)
    })
  })
})