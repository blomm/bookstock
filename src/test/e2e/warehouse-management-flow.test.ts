/**
 * E2E Test: Complete Warehouse Management Flow (Task 5.1)
 * Tests the full user journey of managing warehouses from creation to deactivation
 */

import { describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { warehouseService } from '@/services/warehouseService'
import { WarehouseType, WarehouseStatus } from '@prisma/client'

describe.sequential('E2E: Warehouse Management Flow', () => {
  beforeAll(async () => {
    await cleanDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('complete warehouse creation flow: admin creates a new physical warehouse successfully', async () => {
    // Step 1: Admin navigates to create warehouse page (simulated by having valid data)
    const newWarehouseData = {
      name: 'London Distribution Center',
      code: 'UK-LON-01',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE,
      addressLine1: '123 Publishing Street',
      addressLine2: 'Floor 2',
      city: 'London',
      stateProvince: 'Greater London',
      postalCode: 'EC1A 1BB',
      country: 'GB',
      contactName: 'John Smith',
      contactEmail: 'john.smith@example.com',
      contactPhone: '+44 20 1234 5678',
      notes: 'Main UK distribution center'
    }

    // Step 2: Admin fills out the form and submits
    const createdWarehouse = await warehouseService.create(newWarehouseData)

    // Step 3: Verify warehouse was created with correct data
    expect(createdWarehouse).toBeDefined()
    expect(createdWarehouse.id).toBeDefined()
    expect(createdWarehouse.name).toBe('London Distribution Center')
    expect(createdWarehouse.code).toBe('UK-LON-01')
    expect(createdWarehouse.type).toBe(WarehouseType.PHYSICAL)
    expect(createdWarehouse.status).toBe(WarehouseStatus.ACTIVE)
    expect(createdWarehouse.isActive).toBe(true)
    expect(createdWarehouse.city).toBe('London')
    expect(createdWarehouse.country).toBe('GB')
    expect(createdWarehouse.contactEmail).toBe('john.smith@example.com')

    // Step 4: Admin is redirected to detail page - verify we can fetch the warehouse
    const fetchedWarehouse = await warehouseService.findById(createdWarehouse.id)
    expect(fetchedWarehouse).toBeDefined()
    expect(fetchedWarehouse.id).toBe(createdWarehouse.id)
    expect(fetchedWarehouse.name).toBe('London Distribution Center')
    expect(fetchedWarehouse.addressLine1).toBe('123 Publishing Street')
    expect(fetchedWarehouse.notes).toBe('Main UK distribution center')

    // Step 5: Verify warehouse appears in list
    const warehouseList = await warehouseService.list({
      page: 1,
      limit: 20
    })
    expect(warehouseList.warehouses).toHaveLength(1)
    expect(warehouseList.warehouses[0].id).toBe(createdWarehouse.id)
    expect(warehouseList.warehouses[0].code).toBe('UK-LON-01')
  })

  test('warehouse creation with duplicate code should fail with clear error', async () => {
    // Step 1: Create first warehouse
    await warehouseService.create({
      name: 'First Warehouse',
      code: 'UK-LON',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })

    // Step 2: Attempt to create warehouse with same code
    await expect(
      warehouseService.create({
        name: 'Second Warehouse',
        code: 'UK-LON',
        type: WarehouseType.PHYSICAL,
        status: WarehouseStatus.ACTIVE
      })
    ).rejects.toThrow('Warehouse with code UK-LON already exists')
  })

  test('warehouse edit flow: admin updates warehouse details successfully', async () => {
    // Step 1: Create initial warehouse
    const warehouse = await warehouseService.create({
      name: 'New York Warehouse',
      code: 'US-NYC',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE,
      city: 'New York',
      country: 'US'
    })

    // Step 2: Admin navigates to edit page and updates details
    const updatedWarehouse = await warehouseService.update(warehouse.id, {
      name: 'New York Distribution Center',
      addressLine1: '456 Book Avenue',
      city: 'New York',
      stateProvince: 'NY',
      postalCode: '10001',
      contactName: 'Jane Doe',
      contactEmail: 'jane.doe@example.com',
      notes: 'Updated with full address'
    })

    // Step 3: Verify updates were applied
    expect(updatedWarehouse.name).toBe('New York Distribution Center')
    expect(updatedWarehouse.code).toBe('US-NYC') // Code unchanged
    expect(updatedWarehouse.addressLine1).toBe('456 Book Avenue')
    expect(updatedWarehouse.stateProvince).toBe('NY')
    expect(updatedWarehouse.contactName).toBe('Jane Doe')
    expect(updatedWarehouse.notes).toBe('Updated with full address')

    // Step 4: Verify changes persist when fetching again
    const fetchedWarehouse = await warehouseService.findById(warehouse.id)
    expect(fetchedWarehouse.name).toBe('New York Distribution Center')
    expect(fetchedWarehouse.contactEmail).toBe('jane.doe@example.com')
  })

  test('warehouse status management flow: admin activates and deactivates warehouse', async () => {
    // Step 1: Create warehouse
    const warehouse = await warehouseService.create({
      name: 'Test Warehouse',
      code: 'TEST-01',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })

    expect(warehouse.status).toBe(WarehouseStatus.ACTIVE)
    expect(warehouse.isActive).toBe(true)

    // Step 2: Admin clicks "Deactivate" button
    const deactivatedWarehouse = await warehouseService.deactivate(warehouse.id)

    // Step 3: Verify warehouse is deactivated
    expect(deactivatedWarehouse.status).toBe(WarehouseStatus.INACTIVE)
    expect(deactivatedWarehouse.isActive).toBe(false)

    // Step 4: Admin clicks "Activate" button
    const reactivatedWarehouse = await warehouseService.activate(warehouse.id)

    // Step 5: Verify warehouse is active again
    expect(reactivatedWarehouse.status).toBe(WarehouseStatus.ACTIVE)
    expect(reactivatedWarehouse.isActive).toBe(true)
  })

  test('warehouse list with search and filters flow: user searches and filters warehouses', async () => {
    // Step 1: Create multiple warehouses
    await warehouseService.create({
      name: 'London Warehouse',
      code: 'UK-LON',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE,
      city: 'London',
      country: 'GB'
    })

    await warehouseService.create({
      name: 'New York Warehouse',
      code: 'US-NYC',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE,
      city: 'New York',
      country: 'US'
    })

    await warehouseService.create({
      name: 'Online Fulfillment Center',
      code: 'ONLINE',
      type: WarehouseType.VIRTUAL,
      status: WarehouseStatus.ACTIVE
    })

    await warehouseService.create({
      name: 'Maintenance Warehouse',
      code: 'MAINT-01',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.MAINTENANCE
    })

    // Step 2: User searches for "London"
    const londonResults = await warehouseService.list({
      page: 1,
      limit: 20,
      search: 'London'
    })
    expect(londonResults.warehouses).toHaveLength(1)
    expect(londonResults.warehouses[0].name).toBe('London Warehouse')

    // Step 3: User filters by status ACTIVE
    const activeResults = await warehouseService.list({
      page: 1,
      limit: 20,
      status: WarehouseStatus.ACTIVE
    })
    expect(activeResults.warehouses).toHaveLength(3)

    // Step 4: User filters by type VIRTUAL
    const virtualResults = await warehouseService.list({
      page: 1,
      limit: 20,
      type: WarehouseType.VIRTUAL
    })
    expect(virtualResults.warehouses).toHaveLength(1)
    expect(virtualResults.warehouses[0].name).toBe('Online Fulfillment Center')

    // Step 5: User combines filters (PHYSICAL and ACTIVE)
    const physicalActiveResults = await warehouseService.list({
      page: 1,
      limit: 20,
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })
    expect(physicalActiveResults.warehouses).toHaveLength(2)

    // Step 6: User searches by country code "US"
    const usResults = await warehouseService.list({
      page: 1,
      limit: 20,
      search: 'US'
    })
    expect(usResults.warehouses).toHaveLength(1)
    expect(usResults.warehouses[0].country).toBe('US')
  })

  test('warehouse pagination flow: user navigates through pages', async () => {
    // Step 1: Create 25 warehouses
    for (let i = 1; i <= 25; i++) {
      await warehouseService.create({
        name: `Warehouse ${i}`,
        code: `WH-${String(i).padStart(3, '0')}`,
        type: WarehouseType.PHYSICAL,
        status: WarehouseStatus.ACTIVE
      })
    }

    // Step 2: User views first page (limit 20)
    const page1 = await warehouseService.list({
      page: 1,
      limit: 20
    })
    expect(page1.warehouses).toHaveLength(20)
    expect(page1.total).toBe(25)
    expect(page1.totalPages).toBe(2)
    expect(page1.page).toBe(1)

    // Step 3: User clicks "Next" to view page 2
    const page2 = await warehouseService.list({
      page: 2,
      limit: 20
    })
    expect(page2.warehouses).toHaveLength(5)
    expect(page2.page).toBe(2)
    expect(page2.total).toBe(25)
  })

  test('warehouse creation with virtual type: admin creates online fulfillment center', async () => {
    // Step 1: Admin creates virtual warehouse for online orders
    const virtualWarehouse = await warehouseService.create({
      name: 'Online Fulfillment Center',
      code: 'ONLINE',
      type: WarehouseType.VIRTUAL,
      status: WarehouseStatus.ACTIVE,
      notes: 'Virtual warehouse for tracking online inventory'
    })

    // Step 2: Verify virtual warehouse has correct type
    expect(virtualWarehouse.type).toBe(WarehouseType.VIRTUAL)
    expect(virtualWarehouse.isActive).toBe(true)

    // Step 3: Verify virtual warehouse doesn't require physical address
    expect(virtualWarehouse.addressLine1).toBeNull()
    expect(virtualWarehouse.city).toBeNull()
    expect(virtualWarehouse.country).toBeNull()
  })

  test('warehouse deletion prevention: warehouse with inventory cannot be deleted', async () => {
    // Step 1: Create warehouse
    const warehouse = await warehouseService.create({
      name: 'Test Warehouse',
      code: 'TEST-DEL',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })

    // Step 2: Create inventory record for this warehouse (simulated)
    await testDb.inventory.create({
      data: {
        titleId: (await testDb.title.create({
          data: {
            isbn: '9780306406157',
            title: 'Test Book',
            author: 'Test Author',
            format: 'PAPERBACK',
            rrp: 19.99,
            unitCost: 8.00
          }
        })).id,
        warehouseId: warehouse.id,
        quantity: 10,
        currentStock: 10
      }
    })

    // Step 3: Attempt to delete warehouse with inventory
    await expect(
      warehouseService.delete(warehouse.id)
    ).rejects.toThrow('Cannot delete warehouse with existing inventory')
  })

  test('warehouse deletion success: empty warehouse can be deleted', async () => {
    // Step 1: Create warehouse without inventory
    const warehouse = await warehouseService.create({
      name: 'Empty Warehouse',
      code: 'EMPTY-01',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })

    // Step 2: Admin deletes the warehouse
    const deletedWarehouse = await warehouseService.delete(warehouse.id)

    // Step 3: Verify warehouse was deleted
    expect(deletedWarehouse).toBeDefined()
    expect(deletedWarehouse.id).toBe(warehouse.id)

    // Step 4: Verify warehouse no longer exists
    const nonExistent = await warehouseService.findById(warehouse.id)
    expect(nonExistent).toBeNull()
  })

  test('warehouse code case sensitivity: codes are stored as provided', async () => {
    // Step 1: Admin creates warehouse with uppercase code
    const warehouse = await warehouseService.create({
      name: 'Test Warehouse',
      code: 'UK-TEST',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })

    // Step 2: Verify code was stored as provided
    expect(warehouse.code).toBe('UK-TEST')

    // Step 3: Verify warehouse can be found by exact code
    const foundWarehouse = await warehouseService.findByCode('UK-TEST')
    expect(foundWarehouse).toBeDefined()
    expect(foundWarehouse!.id).toBe(warehouse.id)
  })

  test('warehouse maintenance status flow: admin sets warehouse to maintenance mode', async () => {
    // Step 1: Create active warehouse
    const warehouse = await warehouseService.create({
      name: 'Maintenance Test Warehouse',
      code: 'MAINT-TEST',
      type: WarehouseType.PHYSICAL,
      status: WarehouseStatus.ACTIVE
    })

    // Step 2: Admin sets warehouse to maintenance status
    const maintenanceWarehouse = await warehouseService.setMaintenance(warehouse.id)

    // Step 3: Verify warehouse is in maintenance mode
    expect(maintenanceWarehouse.status).toBe(WarehouseStatus.MAINTENANCE)
    expect(maintenanceWarehouse.isActive).toBe(false)

    // Step 4: Verify maintenance warehouses appear in filtered list
    const maintenanceList = await warehouseService.list({
      page: 1,
      limit: 20,
      status: WarehouseStatus.MAINTENANCE
    })
    expect(maintenanceList.warehouses).toHaveLength(1)
    expect(maintenanceList.warehouses[0].id).toBe(warehouse.id)
  })

  test('warehouse third-party type: admin creates third-party fulfillment warehouse', async () => {
    // Step 1: Admin creates third-party warehouse
    const thirdPartyWarehouse = await warehouseService.create({
      name: 'Amazon FBA Warehouse',
      code: 'AMZN-FBA',
      type: WarehouseType.THIRD_PARTY,
      status: WarehouseStatus.ACTIVE,
      contactName: 'Amazon Fulfillment',
      contactEmail: 'fba@amazon.com',
      notes: 'Third-party fulfillment via Amazon FBA'
    })

    // Step 2: Verify third-party warehouse has correct type
    expect(thirdPartyWarehouse.type).toBe(WarehouseType.THIRD_PARTY)

    // Step 3: Filter warehouses by third-party type
    const thirdPartyList = await warehouseService.list({
      page: 1,
      limit: 20,
      type: WarehouseType.THIRD_PARTY
    })
    expect(thirdPartyList.warehouses).toHaveLength(1)
    expect(thirdPartyList.warehouses[0].name).toBe('Amazon FBA Warehouse')
  })
})
