import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestWarehouse } from '../utils/test-db'

describe('Warehouse Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create warehouse with all required fields', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Turnaround',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      expect(warehouse).toMatchObject({
        name: 'Turnaround',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES'],
        isActive: true
      })
      expect(warehouse.id).toBeDefined()
      expect(warehouse.createdAt).toBeInstanceOf(Date)
      expect(warehouse.updatedAt).toBeInstanceOf(Date)
    })

    test('should create all three main warehouses', async () => {
      const turnaround = await createTestWarehouse({
        name: 'Turnaround',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      const acc = await createTestWarehouse({
        name: 'ACC',
        code: 'ACC',
        location: 'US',
        fulfillsChannels: ['US_TRADE_SALES']
      })

      const flostream = await createTestWarehouse({
        name: 'Flostream',
        code: 'FLS',
        location: 'UK',
        fulfillsChannels: ['ONLINE_SALES']
      })

      expect([turnaround, acc, flostream]).toHaveLength(3)
      expect(turnaround.code).toBe('TRN')
      expect(acc.code).toBe('ACC')
      expect(flostream.code).toBe('FLS')
    })

    test('should enforce unique warehouse codes', async () => {
      await createTestWarehouse({ code: 'DUP' })

      await expect(
        createTestWarehouse({ code: 'DUP' })
      ).rejects.toThrow()
    })

    test('should default isActive to true', async () => {
      const warehouse = await createTestWarehouse()
      expect(warehouse.isActive).toBe(true)
    })
  })

  describe('Validation', () => {
    test('should require warehouse name', async () => {
      await expect(
        testDb.warehouse.create({
          data: {
            code: 'REQ',
            location: 'UK',
            fulfillsChannels: []
          } as any
        })
      ).rejects.toThrow()
    })

    test('should require warehouse code', async () => {
      await expect(
        testDb.warehouse.create({
          data: {
            name: 'Required Code Warehouse',
            location: 'UK',
            fulfillsChannels: []
          } as any
        })
      ).rejects.toThrow()
    })

    test('should enforce name length constraints', async () => {
      const longName = 'a'.repeat(101)
      await expect(
        createTestWarehouse({ name: longName })
      ).rejects.toThrow()
    })

    test('should enforce code length constraints', async () => {
      const longCode = 'a'.repeat(11)
      await expect(
        createTestWarehouse({ code: longCode })
      ).rejects.toThrow()
    })

    test('should handle JSON fulfillsChannels field', async () => {
      const warehouse = await createTestWarehouse({
        fulfillsChannels: ['ONLINE_SALES', 'UK_TRADE_SALES', 'US_TRADE_SALES']
      })

      expect(warehouse.fulfillsChannels).toEqual([
        'ONLINE_SALES',
        'UK_TRADE_SALES',
        'US_TRADE_SALES'
      ])
    })

    test('should handle empty fulfillsChannels array', async () => {
      const warehouse = await createTestWarehouse({
        fulfillsChannels: []
      })

      expect(warehouse.fulfillsChannels).toEqual([])
    })
  })

  describe('Queries', () => {
    test('should find warehouse by code', async () => {
      await createTestWarehouse({
        name: 'Findable Warehouse',
        code: 'FIND'
      })

      const found = await testDb.warehouse.findUnique({
        where: { code: 'FIND' }
      })

      expect(found?.name).toBe('Findable Warehouse')
    })

    test('should filter active warehouses', async () => {
      await createTestWarehouse({ name: 'Active', code: 'ACT', isActive: true })
      await createTestWarehouse({ name: 'Inactive', code: 'INA', isActive: false })

      const activeWarehouses = await testDb.warehouse.findMany({
        where: { isActive: true }
      })

      expect(activeWarehouses).toHaveLength(1)
      expect(activeWarehouses[0].name).toBe('Active')
    })

    test('should filter by location', async () => {
      await createTestWarehouse({ name: 'UK Warehouse', code: 'UK1', location: 'UK' })
      await createTestWarehouse({ name: 'US Warehouse', code: 'US1', location: 'US' })

      const ukWarehouses = await testDb.warehouse.findMany({
        where: { location: 'UK' }
      })

      expect(ukWarehouses).toHaveLength(1)
      expect(ukWarehouses[0].name).toBe('UK Warehouse')
    })

    test('should order warehouses by name', async () => {
      await createTestWarehouse({ name: 'Zebra Warehouse', code: 'ZWH' })
      await createTestWarehouse({ name: 'Alpha Warehouse', code: 'AWH' })

      const warehouses = await testDb.warehouse.findMany({
        orderBy: { name: 'asc' }
      })

      expect(warehouses.map(w => w.name)).toEqual([
        'Alpha Warehouse',
        'Zebra Warehouse'
      ])
    })
  })

  describe('Updates', () => {
    test('should update warehouse details', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Original Name',
        location: 'UK',
        isActive: true
      })

      const updated = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: {
          name: 'Updated Name',
          location: 'US',
          isActive: false
        }
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.location).toBe('US')
      expect(updated.isActive).toBe(false)
      expect(updated.updatedAt.getTime()).toBeGreaterThan(warehouse.updatedAt.getTime())
    })

    test('should update fulfillsChannels', async () => {
      const warehouse = await createTestWarehouse({
        fulfillsChannels: ['ONLINE_SALES']
      })

      const updated = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: {
          fulfillsChannels: ['ONLINE_SALES', 'UK_TRADE_SALES']
        }
      })

      expect(updated.fulfillsChannels).toEqual(['ONLINE_SALES', 'UK_TRADE_SALES'])
    })
  })

  describe('Deletion', () => {
    test('should delete warehouse without relationships', async () => {
      const warehouse = await createTestWarehouse({ code: 'DEL' })

      await testDb.warehouse.delete({
        where: { id: warehouse.id }
      })

      const found = await testDb.warehouse.findUnique({
        where: { id: warehouse.id }
      })

      expect(found).toBeNull()
    })

    test('should soft delete by setting isActive to false', async () => {
      const warehouse = await createTestWarehouse({ code: 'SOFT' })

      const softDeleted = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: { isActive: false }
      })

      expect(softDeleted.isActive).toBe(false)

      const activeWarehouses = await testDb.warehouse.findMany({
        where: { isActive: true }
      })

      expect(activeWarehouses.find(w => w.id === warehouse.id)).toBeUndefined()
    })
  })

  describe('Business Logic', () => {
    test('should validate warehouse channel assignments', async () => {
      // Test that Turnaround handles UK and ROW trade
      const turnaround = await createTestWarehouse({
        name: 'Turnaround',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      expect(turnaround.fulfillsChannels).toContain('UK_TRADE_SALES')
      expect(turnaround.fulfillsChannels).toContain('ROW_TRADE_SALES')

      // Test that Flostream handles online sales
      const flostream = await createTestWarehouse({
        name: 'Flostream',
        code: 'FLS',
        location: 'UK',
        fulfillsChannels: ['ONLINE_SALES']
      })

      expect(flostream.fulfillsChannels).toContain('ONLINE_SALES')

      // Test that ACC handles US trade
      const acc = await createTestWarehouse({
        name: 'ACC',
        code: 'ACC',
        location: 'US',
        fulfillsChannels: ['US_TRADE_SALES']
      })

      expect(acc.fulfillsChannels).toContain('US_TRADE_SALES')
    })

    test('should support extensibility for future warehouses', async () => {
      const futureWarehouse = await createTestWarehouse({
        name: 'Future Warehouse',
        code: 'FUT',
        location: 'EU',
        fulfillsChannels: ['EU_TRADE_SALES'],
        isActive: true
      })

      expect(futureWarehouse.location).toBe('EU')
      expect(futureWarehouse.fulfillsChannels).toContain('EU_TRADE_SALES')
    })
  })
})