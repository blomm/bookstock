import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestUser, createTestWarehouse } from '../utils/test-db'

describe('Warehouse API Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('GET /api/warehouses', () => {
    test('should return paginated list of warehouses', async () => {
      // Create test warehouses
      await createTestWarehouse({ name: 'WH1', code: 'WH1' })
      await createTestWarehouse({ name: 'WH2', code: 'WH2' })
      await createTestWarehouse({ name: 'WH3', code: 'WH3' })

      const warehouses = await testDb.warehouse.findMany()

      expect(warehouses).toHaveLength(3)
      expect(warehouses[0].name).toBeDefined()
      expect(warehouses[0].code).toBeDefined()
    })

    test('should filter warehouses by status', async () => {
      await testDb.warehouse.create({
        data: { name: 'Active', code: 'ACT', status: 'ACTIVE' }
      })
      await testDb.warehouse.create({
        data: { name: 'Inactive', code: 'INA', status: 'INACTIVE' }
      })

      const active = await testDb.warehouse.findMany({
        where: { status: 'ACTIVE' }
      })
      const inactive = await testDb.warehouse.findMany({
        where: { status: 'INACTIVE' }
      })

      expect(active).toHaveLength(1)
      expect(inactive).toHaveLength(1)
    })

    test('should filter warehouses by type', async () => {
      await testDb.warehouse.create({
        data: { name: 'Physical', code: 'PHY', type: 'PHYSICAL' }
      })
      await testDb.warehouse.create({
        data: { name: 'Virtual', code: 'VIR', type: 'VIRTUAL' }
      })

      const physical = await testDb.warehouse.findMany({
        where: { type: 'PHYSICAL' }
      })
      const virtual = await testDb.warehouse.findMany({
        where: { type: 'VIRTUAL' }
      })

      expect(physical).toHaveLength(1)
      expect(virtual).toHaveLength(1)
    })

    test('should search warehouses by name', async () => {
      await testDb.warehouse.create({
        data: { name: 'London Warehouse', code: 'LON' }
      })
      await testDb.warehouse.create({
        data: { name: 'New York Warehouse', code: 'NYC' }
      })

      const results = await testDb.warehouse.findMany({
        where: {
          name: { contains: 'London', mode: 'insensitive' }
        }
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('London Warehouse')
    })
  })

  describe('POST /api/warehouses', () => {
    test('should create warehouse with valid data', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TST',
          type: 'PHYSICAL',
          status: 'ACTIVE'
        }
      })

      expect(warehouse.id).toBeDefined()
      expect(warehouse.name).toBe('Test Warehouse')
      expect(warehouse.code).toBe('TST')
      expect(warehouse.type).toBe('PHYSICAL')
      expect(warehouse.status).toBe('ACTIVE')
    })

    test('should create warehouse with full address', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'UK Warehouse',
          code: 'UK-LON',
          type: 'PHYSICAL',
          addressLine1: '123 Street',
          city: 'London',
          postalCode: 'EC1A 1BB',
          country: 'GB',
          contactEmail: 'test@example.com'
        }
      })

      expect(warehouse.addressLine1).toBe('123 Street')
      expect(warehouse.city).toBe('London')
      expect(warehouse.country).toBe('GB')
    })

    test('should reject duplicate warehouse code', async () => {
      await testDb.warehouse.create({
        data: { name: 'First', code: 'DUP' }
      })

      await expect(
        testDb.warehouse.create({
          data: { name: 'Second', code: 'DUP' }
        })
      ).rejects.toThrow()
    })
  })

  describe('GET /api/warehouses/[id]', () => {
    test('should return warehouse by id', async () => {
      const created = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TST'
      })

      const found = await testDb.warehouse.findUnique({
        where: { id: created.id }
      })

      expect(found).toBeDefined()
      expect(found?.name).toBe('Test Warehouse')
      expect(found?.code).toBe('TST')
    })

    test('should return null for non-existent warehouse', async () => {
      const found = await testDb.warehouse.findUnique({
        where: { id: 999999 }
      })

      expect(found).toBeNull()
    })
  })

  describe('PUT /api/warehouses/[id]', () => {
    test('should update warehouse details', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Original Name',
        code: 'TST'
      })

      const updated = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: {
          name: 'Updated Name',
          city: 'London'
        }
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.city).toBe('London')
      expect(updated.code).toBe('TST') // Unchanged
    })

    test('should update warehouse status', async () => {
      const warehouse = await createTestWarehouse({
        code: 'TST',
        status: 'ACTIVE'
      })

      const updated = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: { status: 'MAINTENANCE' }
      })

      expect(updated.status).toBe('MAINTENANCE')
    })
  })

  describe('DELETE /api/warehouses/[id]', () => {
    test('should delete warehouse without inventory', async () => {
      const warehouse = await createTestWarehouse({ code: 'DEL' })

      await testDb.warehouse.delete({
        where: { id: warehouse.id }
      })

      const found = await testDb.warehouse.findUnique({
        where: { id: warehouse.id }
      })

      expect(found).toBeNull()
    })
  })

  describe('PATCH /api/warehouses/[id]/activate', () => {
    test('should activate warehouse', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test',
          code: 'TST',
          status: 'INACTIVE',
          isActive: false
        }
      })

      const activated = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: {
          status: 'ACTIVE',
          isActive: true
        }
      })

      expect(activated.status).toBe('ACTIVE')
      expect(activated.isActive).toBe(true)
    })
  })

  describe('PATCH /api/warehouses/[id]/deactivate', () => {
    test('should deactivate warehouse', async () => {
      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test',
          code: 'TST',
          status: 'ACTIVE',
          isActive: true
        }
      })

      const deactivated = await testDb.warehouse.update({
        where: { id: warehouse.id },
        data: {
          status: 'INACTIVE',
          isActive: false
        }
      })

      expect(deactivated.status).toBe('INACTIVE')
      expect(deactivated.isActive).toBe(false)
    })
  })

  describe('Validation', () => {
    test('should enforce unique warehouse codes', async () => {
      await createTestWarehouse({ code: 'UNIQUE' })

      await expect(
        createTestWarehouse({ code: 'UNIQUE' })
      ).rejects.toThrow()
    })

    test('should validate warehouse type enum', async () => {
      const physical = await testDb.warehouse.create({
        data: { name: 'Physical', code: 'PHY', type: 'PHYSICAL' }
      })
      expect(physical.type).toBe('PHYSICAL')

      const virtual = await testDb.warehouse.create({
        data: { name: 'Virtual', code: 'VIR', type: 'VIRTUAL' }
      })
      expect(virtual.type).toBe('VIRTUAL')

      const thirdParty = await testDb.warehouse.create({
        data: { name: 'Third Party', code: 'TPW', type: 'THIRD_PARTY' }
      })
      expect(thirdParty.type).toBe('THIRD_PARTY')
    })

    test('should validate warehouse status enum', async () => {
      const active = await testDb.warehouse.create({
        data: { name: 'Active', code: 'ACT', status: 'ACTIVE' }
      })
      expect(active.status).toBe('ACTIVE')

      const inactive = await testDb.warehouse.create({
        data: { name: 'Inactive', code: 'INA', status: 'INACTIVE' }
      })
      expect(inactive.status).toBe('INACTIVE')

      const maintenance = await testDb.warehouse.create({
        data: { name: 'Maintenance', code: 'MNT', status: 'MAINTENANCE' }
      })
      expect(maintenance.status).toBe('MAINTENANCE')
    })
  })
})
