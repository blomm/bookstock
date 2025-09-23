import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'
import InterWarehouseTransferService, { setDbClient } from '@/services/interWarehouseTransferService'
import { setDbClient as setRealTimeDbClient } from '@/services/realTimeInventoryService'

describe('InterWarehouseTransferService', () => {
  let sourceWarehouse: any
  let destinationWarehouse: any
  let title: any

  beforeEach(async () => {
    await cleanDatabase()
    setDbClient(testDb)
    setRealTimeDbClient(testDb)

    // Create test warehouses
    sourceWarehouse = await createTestWarehouse({
      name: 'Source Warehouse',
      code: 'SRC001',
      location: 'Manchester, UK',
      fulfillsChannels: ['wholesale', 'online']
    })

    destinationWarehouse = await createTestWarehouse({
      name: 'Destination Warehouse',
      code: 'DST001',
      location: 'London, UK',
      fulfillsChannels: ['retail', 'online']
    })

    // Create test title
    title = await createTestTitle({
      isbn: '9781234567890',
      title: 'Transfer Test Book',
      author: 'Test Author',
      rrp: 19.99
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Transfer Request Creation', () => {
    test('should create transfer request with valid data', async () => {
      // Create initial inventory in source warehouse
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing',
        priority: 'MEDIUM' as const,
        notes: 'Test transfer request'
      }

      const result = await InterWarehouseTransferService.createTransferRequest(transferRequest)

      expect(result.success).toBe(true)
      expect(result.transferId).toBeDefined()
      expect(result.message).toContain('Transfer request created successfully')
      expect(result.estimatedCost).toBeDefined()
      expect(result.estimatedCost?.totalCost).toBeGreaterThan(0)
      expect(result.estimatedDuration).toBeGreaterThan(0)

      // Verify stock reservation
      const updatedInventory = await testDb.inventory.findFirst({
        where: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id
        }
      })

      expect(updatedInventory?.reservedStock).toBe(20)
    })

    test('should fail when insufficient stock', async () => {
      // Create insufficient inventory
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 5,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const result = await InterWarehouseTransferService.createTransferRequest(transferRequest)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Insufficient stock')
    })

    test('should fail when source inventory not found', async () => {
      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const result = await InterWarehouseTransferService.createTransferRequest(transferRequest)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Source inventory not found')
    })

    test('should fail when destination warehouse not found', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: 999999,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const result = await InterWarehouseTransferService.createTransferRequest(transferRequest)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Destination warehouse not found')
    })
  })

  describe('Transfer Approval Workflow', () => {
    let transferId: string

    beforeEach(async () => {
      // Create initial inventory and transfer request
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const result = await InterWarehouseTransferService.createTransferRequest(transferRequest)
      transferId = result.transferId!
    })

    test('should approve transfer request', async () => {
      const approval = {
        transferId,
        approvedBy: 'manager-user',
        approvalNotes: 'Approved for urgent stock rebalancing',
        scheduledDate: new Date()
      }

      const result = await InterWarehouseTransferService.approveTransfer(approval)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Transfer approved successfully')

      // Verify status update in database
      const transfer = await testDb.stockMovement.findFirst({
        where: { referenceNumber: transferId }
      })

      const notesContent = transfer?.notes || ''
      const metadataMatch = notesContent.match(/Metadata: ({.*})/)
      let metadata: any = {}

      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1])
        } catch (e) {
          // Parsing failed
        }
      }

      expect(metadata?.status).toBe('APPROVED')
      expect(metadata?.approvedBy).toBe('manager-user')
    })

    test('should fail to approve non-existent transfer', async () => {
      const approval = {
        transferId: 'NON_EXISTENT',
        approvedBy: 'manager-user'
      }

      const result = await InterWarehouseTransferService.approveTransfer(approval)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Transfer request not found')
    })
  })

  describe('Transfer Execution', () => {
    let approvedTransferId: string

    beforeEach(async () => {
      // Create and approve a transfer
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      // Create destination inventory record
      await createTestInventory({
        titleId: title.id,
        warehouseId: destinationWarehouse.id,
        currentStock: 0,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const createResult = await InterWarehouseTransferService.createTransferRequest(transferRequest)
      approvedTransferId = createResult.transferId!

      await InterWarehouseTransferService.approveTransfer({
        transferId: approvedTransferId,
        approvedBy: 'manager-user'
      })
    })

    test('should execute approved transfer', async () => {
      const result = await InterWarehouseTransferService.executeTransfer(approvedTransferId, 'warehouse-staff')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Transfer executed successfully')

      // Verify status update
      const transfer = await testDb.stockMovement.findFirst({
        where: { referenceNumber: approvedTransferId }
      })

      const notesContent = transfer?.notes || ''
      const metadataMatch = notesContent.match(/Metadata: ({.*})/)
      let metadata: any = {}

      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1])
        } catch (e) {
          // Parsing failed
        }
      }

      expect(metadata?.status).toBe('IN_TRANSIT')
      expect(metadata?.executedBy).toBe('warehouse-staff')
    })

    test('should fail to execute non-approved transfer', async () => {
      // Create a new title and warehouses for this test to avoid conflicts
      const newSourceWarehouse = await createTestWarehouse({
        name: 'New Source Warehouse',
        code: 'NSRC001',
        location: 'Birmingham, UK',
        fulfillsChannels: ['wholesale']
      })

      const newDestinationWarehouse = await createTestWarehouse({
        name: 'New Destination Warehouse',
        code: 'NDST001',
        location: 'Cardiff, UK',
        fulfillsChannels: ['retail']
      })

      const newTitle = await createTestTitle({
        isbn: '9781234567891',
        title: 'New Transfer Test Book',
        author: 'New Test Author',
        rrp: 24.99
      })

      // Create a new transfer without approval
      await createTestInventory({
        titleId: newTitle.id,
        warehouseId: newSourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: newTitle.id,
        sourceWarehouseId: newSourceWarehouse.id,
        destinationWarehouseId: newDestinationWarehouse.id,
        quantity: 10,
        requestedBy: 'test-user',
        reason: 'Test'
      }

      const createResult = await InterWarehouseTransferService.createTransferRequest(transferRequest)
      const unapprovedTransferId = createResult.transferId!

      const result = await InterWarehouseTransferService.executeTransfer(unapprovedTransferId, 'warehouse-staff')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Transfer is not approved')
    })
  })

  describe('Transfer Tracking', () => {
    let inTransitTransferId: string

    beforeEach(async () => {
      // Create, approve, and execute a transfer
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: destinationWarehouse.id,
        currentStock: 0,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const createResult = await InterWarehouseTransferService.createTransferRequest(transferRequest)
      inTransitTransferId = createResult.transferId!

      await InterWarehouseTransferService.approveTransfer({
        transferId: inTransitTransferId,
        approvedBy: 'manager-user'
      })

      await InterWarehouseTransferService.executeTransfer(inTransitTransferId, 'warehouse-staff')
    })

    test('should update transfer tracking information', async () => {
      const tracking = {
        transferId: inTransitTransferId,
        status: 'IN_TRANSIT' as const,
        location: 'En route to London',
        estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        carrier: 'DHL',
        trackingNumber: 'DHL123456789',
        notes: 'Package scanned at Birmingham hub'
      }

      const result = await InterWarehouseTransferService.updateTransferTracking(tracking)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Tracking updated successfully')

      // Verify tracking info in database
      const transfer = await testDb.stockMovement.findFirst({
        where: { referenceNumber: inTransitTransferId }
      })

      const notesContent = transfer?.notes || ''
      const metadataMatch = notesContent.match(/Metadata: ({.*})/)
      let metadata: any = {}

      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1])
        } catch (e) {
          // Parsing failed
        }
      }

      expect(metadata?.tracking?.carrier).toBe('DHL')
      expect(metadata?.tracking?.trackingNumber).toBe('DHL123456789')
    })
  })

  describe('Transfer Completion', () => {
    let inTransitTransferId: string

    beforeEach(async () => {
      // Create, approve, and execute a transfer
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: destinationWarehouse.id,
        currentStock: 0,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const createResult = await InterWarehouseTransferService.createTransferRequest(transferRequest)
      inTransitTransferId = createResult.transferId!

      await InterWarehouseTransferService.approveTransfer({
        transferId: inTransitTransferId,
        approvedBy: 'manager-user'
      })

      await InterWarehouseTransferService.executeTransfer(inTransitTransferId, 'warehouse-staff')
    })

    test('should complete transfer and generate analytics', async () => {
      const result = await InterWarehouseTransferService.completeTransfer(inTransitTransferId, 'receiving-staff')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Transfer completed successfully')
      expect(result.trackingInfo?.analytics).toBeDefined()

      // Verify status update
      const transfer = await testDb.stockMovement.findFirst({
        where: { referenceNumber: inTransitTransferId }
      })

      const notesContent = transfer?.notes || ''
      const metadataMatch = notesContent.match(/Metadata: ({.*})/)
      let metadata: any = {}

      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1])
        } catch (e) {
          // Parsing failed
        }
      }

      expect(metadata?.status).toBe('COMPLETED')
      expect(metadata?.completedBy).toBe('receiving-staff')
    })
  })

  describe('Cost Calculation', () => {
    test('should calculate transfer costs correctly', async () => {
      const cost = await InterWarehouseTransferService.calculateTransferCost(
        sourceWarehouse.id,
        destinationWarehouse.id,
        50,
        'MEDIUM'
      )

      expect(cost.baseCost).toBe(25.0) // 50 * £0.50
      expect(cost.handlingCost).toBe(12.5) // 50 * £0.25
      expect(cost.totalCost).toBeGreaterThan(0)
      expect(cost.currency).toBe('GBP')
    })

    test('should apply priority cost multipliers', async () => {
      const mediumCost = await InterWarehouseTransferService.calculateTransferCost(
        sourceWarehouse.id,
        destinationWarehouse.id,
        50,
        'MEDIUM'
      )

      const urgentCost = await InterWarehouseTransferService.calculateTransferCost(
        sourceWarehouse.id,
        destinationWarehouse.id,
        50,
        'URGENT'
      )

      expect(urgentCost.totalCost).toBeGreaterThan(mediumCost.totalCost)
    })
  })

  describe('Transfer Analytics', () => {
    test('should generate transfer analytics', async () => {
      // Create and complete a transfer
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: destinationWarehouse.id,
        currentStock: 0,
        reservedStock: 0
      })

      const transferRequest = {
        titleId: title.id,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        quantity: 20,
        requestedBy: 'test-user',
        reason: 'Stock rebalancing'
      }

      const createResult = await InterWarehouseTransferService.createTransferRequest(transferRequest)
      const transferId = createResult.transferId!

      await InterWarehouseTransferService.approveTransfer({
        transferId,
        approvedBy: 'manager-user'
      })

      await InterWarehouseTransferService.executeTransfer(transferId, 'warehouse-staff')
      await InterWarehouseTransferService.completeTransfer(transferId, 'receiving-staff')

      const analytics = await InterWarehouseTransferService.generateTransferAnalytics(transferId)

      expect(analytics.transferId).toBe(transferId)
      expect(analytics.duration).toBeGreaterThanOrEqual(0)
      expect(analytics.efficiency).toBeGreaterThanOrEqual(0)
      expect(analytics.efficiency).toBeLessThanOrEqual(100)
      expect(typeof analytics.onTimeDelivery).toBe('boolean')
    })
  })

  describe('Transfer Summary', () => {
    test('should generate transfer summary', async () => {
      const summary = await InterWarehouseTransferService.getTransferSummary()

      expect(summary.totalTransfers).toBeGreaterThanOrEqual(0)
      expect(summary.completedTransfers).toBeGreaterThanOrEqual(0)
      expect(summary.pendingTransfers).toBeGreaterThanOrEqual(0)
      expect(summary.averageDuration).toBeGreaterThanOrEqual(0)
      expect(summary.averageCost).toBeGreaterThanOrEqual(0)
      expect(summary.onTimePercentage).toBeGreaterThanOrEqual(0)
      expect(summary.onTimePercentage).toBeLessThanOrEqual(100)
      expect(summary.totalValue).toBeGreaterThanOrEqual(0)
    })

    test('should filter transfer summary by warehouse', async () => {
      const summary = await InterWarehouseTransferService.getTransferSummary(sourceWarehouse.id)

      expect(summary).toBeDefined()
      expect(typeof summary.totalTransfers).toBe('number')
    })

    test('should filter transfer summary by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const summary = await InterWarehouseTransferService.getTransferSummary(
        undefined,
        yesterday,
        tomorrow
      )

      expect(summary).toBeDefined()
      expect(typeof summary.totalTransfers).toBe('number')
    })
  })
})