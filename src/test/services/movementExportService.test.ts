import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { testDb } from '../utils/test-db'
import MovementExportService, {
  ExportRequest,
  SyncConfiguration
} from '../../services/movementExportService'
import { MovementType } from '@prisma/client'

describe('MovementExportService', () => {
  beforeAll(async () => {
    MovementExportService.setDbClient(testDb)
  })

  beforeEach(async () => {
    await testDb.stockMovement.deleteMany()
    await testDb.inventory.deleteMany()
    await testDb.title.deleteMany()
    await testDb.warehouse.deleteMany()
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe('Export Creation', () => {
    it('should create export successfully', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TST',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          status: 'ACTIVE'
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: MovementType.PRINT_RECEIVED,
          quantity: 100,
          unitCost: 5.50,
          movementDate: new Date(),
          notes: 'Export test movement'
        }
      })

      const exportRequest: ExportRequest = {
        format: 'csv',
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dateTo: new Date(),
        includeAuditTrail: false,
        includeMetadata: false
      }

      const exportId = await MovementExportService.createExport(exportRequest)

      expect(exportId).toMatch(/^export_\d+_/)

      const status = await MovementExportService.getExportStatus(exportId)
      expect(status).toBeDefined()
      expect(status!.exportId).toBe(exportId)
      expect(status!.format).toBe('csv')
      expect(status!.status).toBe('pending')
    })

    it('should validate export request', async () => {
      const invalidRequest: ExportRequest = {
        format: 'invalid' as any,
        dateFrom: new Date(),
        dateTo: new Date(Date.now() - 24 * 60 * 60 * 1000), // dateTo before dateFrom
        maxRecords: 200000 // Too many records
      }

      await expect(MovementExportService.createExport(invalidRequest))
        .rejects.toThrow()
    })

    it('should filter export by warehouse and movement type', async () => {
      const warehouse1 = await testDb.warehouse.create({
        data: {
          name: 'Warehouse 1',
          code: 'WH1',
          location: 'Location 1',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const warehouse2 = await testDb.warehouse.create({
        data: {
          name: 'Warehouse 2',
          code: 'WH2',
          location: 'Location 2',
          fulfillsChannels: ['ONLINE_SALES']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          status: 'ACTIVE'
        }
      })

      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: MovementType.PRINT_RECEIVED,
            quantity: 100,
            unitCost: 5.50,
            movementDate: new Date()
          },
          {
            titleId: title.id,
            warehouseId: warehouse1.id,
            movementType: MovementType.ONLINE_SALES,
            quantity: -10,
            unitCost: 5.50,
            movementDate: new Date()
          },
          {
            titleId: title.id,
            warehouseId: warehouse2.id,
            movementType: MovementType.PRINT_RECEIVED,
            quantity: 50,
            unitCost: 5.50,
            movementDate: new Date()
          }
        ]
      })

      const exportRequest: ExportRequest = {
        format: 'json',
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dateTo: new Date(Date.now() + 24 * 60 * 60 * 1000),
        warehouseIds: [warehouse1.id],
        movementTypes: [MovementType.PRINT_RECEIVED]
      }

      const exportId = await MovementExportService.createExport(exportRequest)

      // Wait a moment for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const status = await MovementExportService.getExportStatus(exportId)
      expect(status!.recordCount).toBe(1)
    })

    it('should handle different export formats', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Format Test Warehouse',
          code: 'FMT',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Format Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          status: 'ACTIVE'
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: MovementType.PRINT_RECEIVED,
          quantity: 100,
          unitCost: 5.50,
          movementDate: new Date(),
          notes: 'Format test'
        }
      })

      const formats: ('csv' | 'json' | 'xml' | 'xlsx')[] = ['csv', 'json', 'xml', 'xlsx']

      for (const format of formats) {
        const exportRequest: ExportRequest = {
          format,
          dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
          dateTo: new Date()
        }

        const exportId = await MovementExportService.createExport(exportRequest)

        const status = await MovementExportService.getExportStatus(exportId)
        expect(status!.format).toBe(format)
      }
    })
  })

  describe('Export Download', () => {
    it('should download completed export', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Download Test Warehouse',
          code: 'DWN',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Download Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          status: 'ACTIVE'
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: MovementType.PRINT_RECEIVED,
          quantity: 100,
          unitCost: 5.50,
          movementDate: new Date(),
          notes: 'Download test'
        }
      })

      const exportRequest: ExportRequest = {
        format: 'csv',
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dateTo: new Date()
      }

      const exportId = await MovementExportService.createExport(exportRequest)

      // Wait for export to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const downloadData = await MovementExportService.downloadExport(exportId)

      if (downloadData) {
        expect(downloadData.filename).toMatch(/\.csv$/)
        expect(downloadData.contentType).toBe('text/csv')
        expect(downloadData.data).toContain('Movement ID')
      }
    })

    it('should return null for non-existent export', async () => {
      const downloadData = await MovementExportService.downloadExport('non-existent-id')
      expect(downloadData).toBeNull()
    })
  })

  describe('Sync Configuration Management', () => {
    it('should create sync configuration', async () => {
      const syncConfig: SyncConfiguration = {
        targetSystem: 'TestERP',
        syncType: 'incremental',
        schedule: 'daily',
        filters: {
          movementTypes: [MovementType.PRINT_RECEIVED, MovementType.ONLINE_SALES]
        },
        format: 'json',
        destination: {
          type: 'webhook',
          endpoint: 'https://erp.example.com/webhooks/movements',
          credentials: {
            apiKey: 'test-key'
          }
        },
        isActive: true
      }

      const configId = await MovementExportService.createSyncConfiguration(syncConfig)

      expect(configId).toMatch(/^sync_config_\d+_/)

      const configs = await MovementExportService.listSyncConfigurations()
      const createdConfig = configs.find(c => c.targetSystem === 'TestERP')

      expect(createdConfig).toBeDefined()
      expect(createdConfig!.syncType).toBe('incremental')
      expect(createdConfig!.schedule).toBe('daily')
    })

    it('should validate sync configuration', async () => {
      const invalidConfig: SyncConfiguration = {
        targetSystem: '',
        syncType: 'invalid' as any,
        schedule: 'invalid' as any,
        filters: {},
        format: 'invalid' as any,
        destination: {
          type: 'invalid' as any,
          endpoint: '',
          credentials: {}
        },
        isActive: true
      }

      await expect(MovementExportService.createSyncConfiguration(invalidConfig))
        .rejects.toThrow()
    })

    it('should update sync configuration', async () => {
      const syncConfig: SyncConfiguration = {
        targetSystem: 'UpdateTest',
        syncType: 'full',
        schedule: 'manual',
        filters: {},
        format: 'csv',
        destination: {
          type: 'ftp',
          endpoint: 'ftp.example.com',
          credentials: {}
        },
        isActive: true
      }

      const configId = await MovementExportService.createSyncConfiguration(syncConfig)

      const success = await MovementExportService.updateSyncConfiguration(configId, {
        isActive: false,
        schedule: 'weekly'
      })

      expect(success).toBe(true)

      const configs = await MovementExportService.listSyncConfigurations()
      const updatedConfig = configs.find(c => c.targetSystem === 'UpdateTest')

      expect(updatedConfig!.isActive).toBe(false)
      expect(updatedConfig!.schedule).toBe('weekly')
    })

    it('should delete sync configuration', async () => {
      const syncConfig: SyncConfiguration = {
        targetSystem: 'DeleteTest',
        syncType: 'full',
        schedule: 'manual',
        filters: {},
        format: 'json',
        destination: {
          type: 'api',
          endpoint: 'https://api.example.com',
          credentials: {}
        },
        isActive: true
      }

      const configId = await MovementExportService.createSyncConfiguration(syncConfig)

      const success = await MovementExportService.deleteSyncConfiguration(configId)
      expect(success).toBe(true)

      const successAgain = await MovementExportService.deleteSyncConfiguration(configId)
      expect(successAgain).toBe(false)
    })
  })

  describe('Sync Execution', () => {
    it('should execute sync configuration', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Sync Test Warehouse',
          code: 'SYN',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Sync Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          status: 'ACTIVE'
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: MovementType.PRINT_RECEIVED,
          quantity: 100,
          unitCost: 5.50,
          movementDate: new Date(),
          notes: 'Sync test movement'
        }
      })

      const syncConfig: SyncConfiguration = {
        targetSystem: 'SyncExecution',
        syncType: 'incremental',
        schedule: 'manual',
        filters: {
          dateRange: {
            from: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        format: 'json',
        destination: {
          type: 'webhook',
          endpoint: 'https://sync.example.com/movements',
          credentials: {}
        },
        isActive: true
      }

      const configId = await MovementExportService.createSyncConfiguration(syncConfig)

      const syncId = await MovementExportService.executeSyncConfiguration(configId)

      expect(syncId).toMatch(/^sync_\d+_/)

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const syncStatus = await MovementExportService.getSyncExecutionStatus(syncId)

      expect(syncStatus).toBeDefined()
      expect(syncStatus!.syncId).toBe(syncId)
      expect(syncStatus!.configurationId).toBe(configId)
      expect(syncStatus!.recordCount).toBeGreaterThan(0)
    })

    it('should fail to execute inactive sync configuration', async () => {
      const syncConfig: SyncConfiguration = {
        targetSystem: 'InactiveSync',
        syncType: 'full',
        schedule: 'manual',
        filters: {},
        format: 'csv',
        destination: {
          type: 'ftp',
          endpoint: 'ftp.example.com',
          credentials: {}
        },
        isActive: false
      }

      const configId = await MovementExportService.createSyncConfiguration(syncConfig)

      await expect(MovementExportService.executeSyncConfiguration(configId))
        .rejects.toThrow('is not active')
    })

    it('should get due sync configurations', async () => {
      const pastTime = new Date(Date.now() - 60000) // 1 minute ago

      const syncConfig: SyncConfiguration = {
        targetSystem: 'DueSync',
        syncType: 'incremental',
        schedule: 'hourly',
        filters: {},
        format: 'json',
        destination: {
          type: 'webhook',
          endpoint: 'https://due.example.com',
          credentials: {}
        },
        isActive: true,
        nextSyncAt: pastTime
      }

      const configId = await MovementExportService.createSyncConfiguration(syncConfig)

      const dueConfigs = await MovementExportService.getDueSyncConfigurations()

      expect(dueConfigs).toHaveLength(1)
      expect(dueConfigs[0].targetSystem).toBe('DueSync')
    })

    it('should run scheduled syncs', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Scheduled Sync Warehouse',
          code: 'SCH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Scheduled Sync Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          status: 'ACTIVE'
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: MovementType.PRINT_RECEIVED,
          quantity: 100,
          unitCost: 5.50,
          movementDate: new Date()
        }
      })

      const pastTime = new Date(Date.now() - 60000)

      const syncConfig: SyncConfiguration = {
        targetSystem: 'ScheduledSync',
        syncType: 'incremental',
        schedule: 'hourly',
        filters: {},
        format: 'json',
        destination: {
          type: 'webhook',
          endpoint: 'https://scheduled.example.com',
          credentials: {}
        },
        isActive: true,
        nextSyncAt: pastTime
      }

      await MovementExportService.createSyncConfiguration(syncConfig)

      await expect(MovementExportService.runScheduledSyncs())
        .resolves.toBeUndefined()
    })
  })

  describe('Export Status Management', () => {
    it('should return null for non-existent export', async () => {
      const status = await MovementExportService.getExportStatus('non-existent')
      expect(status).toBeNull()
    })

    it('should return null for non-existent sync execution', async () => {
      const status = await MovementExportService.getSyncExecutionStatus('non-existent')
      expect(status).toBeNull()
    })
  })
})