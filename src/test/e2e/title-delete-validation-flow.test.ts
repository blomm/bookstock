/**
 * E2E Test: Delete Validation Flow (10.6)
 * Tests the full user journey of title deletion with inventory validation
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'
import { prisma } from '@/lib/db'

describe('E2E: Title Delete Validation Flow', () => {
  let warehouse_id: number

  beforeEach(async () => {
    await cleanDatabase()

    // Create a test warehouse for inventory tests
    const warehouse = await prisma.warehouse.create({
      data: {
        name: 'Test Warehouse',
        code: 'TW001',
        isActive: true,
      },
    })
    warehouse_id = warehouse.id
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('user can delete title without inventory', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book to Delete',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: User navigates to title detail page
    const detail = await titleService.findById(title.id)
    expect(detail).toBeDefined()

    // Step 3: User clicks delete button
    // Step 4: User confirms deletion in dialog
    await titleService.delete(title.id)

    // Step 5: Verify title deleted
    await expect(titleService.findById(title.id)).rejects.toThrow('Title not found')

    // Step 6: Verify user redirected to titles list (simulated by successful deletion)
    const all_titles = await titleService.list({ page: 1, limit: 10 })
    expect(all_titles.data.every(t => t.id !== title.id)).toBe(true)
  })

  test('user cannot delete title with inventory', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Add inventory for this title
    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 100,
        availableStock: 100,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 3: User clicks delete button
    // Step 4: User confirms deletion
    // Step 5: System shows error message
    await expect(titleService.delete(title.id)).rejects.toThrow(
      'Cannot delete title with existing inventory'
    )

    // Step 6: Verify title still exists
    const still_exists = await titleService.findById(title.id)
    expect(still_exists).toBeDefined()
    expect(still_exists.id).toBe(title.id)

    // Step 7: Verify user remains on detail page (title still accessible)
    expect(still_exists.title).toBe('Book with Inventory')
  })

  test('user can delete title after inventory depleted', async () => {
    // Step 1: Create title with inventory
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Temporary Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    const inventory = await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 100,
        availableStock: 100,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 2: User attempts delete - fails
    await expect(titleService.delete(title.id)).rejects.toThrow()

    // Step 3: Inventory gets depleted (all sold)
    await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        currentStock: 0,
        availableStock: 0,
      },
    })

    // Step 4: User attempts delete again - succeeds
    await titleService.delete(title.id)

    // Step 5: Verify title deleted
    await expect(titleService.findById(title.id)).rejects.toThrow()
  })

  test('user cannot delete title with inventory across multiple warehouses', async () => {
    // Step 1: Create second warehouse
    const warehouse2 = await prisma.warehouse.create({
      data: {
        name: 'Second Warehouse',
        code: 'TW002',
        isActive: true,
      },
    })

    // Step 2: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book in Multiple Warehouses',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 3: Add inventory in warehouse 1
    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 0,  // No stock here
        availableStock: 0,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 4: Add inventory in warehouse 2
    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse2.id,
        currentStock: 50,  // Has stock here
        availableStock: 50,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 5: User attempts delete
    // Step 6: System checks ALL warehouses
    await expect(titleService.delete(title.id)).rejects.toThrow(
      'Cannot delete title with existing inventory'
    )

    // Step 7: Verify title still exists
    const still_exists = await titleService.findById(title.id)
    expect(still_exists).toBeDefined()
  })

  test('user cannot delete title with reserved inventory', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Reserved Stock',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Add inventory with reserved stock
    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 50,
        availableStock: 30,
        reservedStock: 20,  // Reserved for orders
        committedStock: 0,
      },
    })

    // Step 3: User attempts delete
    await expect(titleService.delete(title.id)).rejects.toThrow(
      'Cannot delete title with existing inventory'
    )
  })

  test('user cannot delete title with committed inventory', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Committed Stock',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Add inventory with committed stock
    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 50,
        availableStock: 30,
        reservedStock: 0,
        committedStock: 20,  // Committed for production
      },
    })

    // Step 3: User attempts delete
    await expect(titleService.delete(title.id)).rejects.toThrow(
      'Cannot delete title with existing inventory'
    )
  })

  test('delete confirmation dialog shows inventory warning', async () => {
    // Step 1: Create title with inventory
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Stock',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 100,
        availableStock: 100,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 2: User clicks delete button
    // Step 3: Before confirmation, check if inventory exists (UI would show warning)
    const inventory_check = await prisma.inventory.aggregate({
      where: { titleId: title.id },
      _sum: { currentStock: true },
    })

    // Step 4: Verify inventory detected
    expect(inventory_check._sum.currentStock).toBeGreaterThan(0)

    // Step 5: Attempt delete anyway (user confirms despite warning)
    await expect(titleService.delete(title.id)).rejects.toThrow()
  })

  test('user can delete title with zero inventory in all warehouses', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Zero Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Create inventory records with zero stock
    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 0,
        availableStock: 0,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 3: User deletes title - should succeed
    await titleService.delete(title.id)

    // Step 4: Verify title deleted
    await expect(titleService.findById(title.id)).rejects.toThrow()
  })

  test('deletion cascades to price history', async () => {
    // Step 1: Create title with price history
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with History',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Add price history
    await titleService.update(title.id, {
      rrp: 34.99,
      priceChangeReason: 'Price increase',
    })

    // Verify price history exists
    const history_before = await titleService.getPriceHistory(title.id)
    expect(history_before).toHaveLength(2)

    // Step 3: Delete title
    await titleService.delete(title.id)

    // Step 4: Verify price history also deleted (cascade)
    const history_count = await prisma.priceHistory.count({
      where: { titleId: title.id },
    })
    expect(history_count).toBe(0)
  })

  test('user cannot delete non-existent title', async () => {
    // User attempts to delete title ID that doesn't exist
    await expect(titleService.delete(99999)).rejects.toThrow('Title not found')
  })

  test('bulk delete not allowed if any title has inventory', async () => {
    // Step 1: Create three titles
    const title1 = await titleService.create({
      isbn: '9780306406157',
      title: 'Book 1 - No Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    const title2 = await titleService.create({
      isbn: '9780306406164',
      title: 'Book 2 - Has Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    const title3 = await titleService.create({
      isbn: '9780306406171',
      title: 'Book 3 - No Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Add inventory only to title2
    await prisma.inventory.create({
      data: {
        titleId: title2.id,
        warehouseId: warehouse_id,
        currentStock: 50,
        availableStock: 50,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 3: Attempt to delete all three
    // Note: If bulk delete is not implemented, test individual deletes
    await expect(titleService.delete(title2.id)).rejects.toThrow()

    // Step 4: Verify title1 and title3 can still be deleted
    await titleService.delete(title1.id)
    await titleService.delete(title3.id)

    // Step 5: Verify only title2 remains
    const remaining = await titleService.list({ page: 1, limit: 10 })
    expect(remaining.data).toHaveLength(1)
    expect(remaining.data[0].id).toBe(title2.id)
  })

  test('delete validation message is clear and helpful', async () => {
    // Step 1: Create title with inventory
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Book with Inventory',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    await prisma.inventory.create({
      data: {
        titleId: title.id,
        warehouseId: warehouse_id,
        currentStock: 100,
        availableStock: 100,
        reservedStock: 0,
        committedStock: 0,
      },
    })

    // Step 2: Attempt delete and verify error message
    try {
      await titleService.delete(title.id)
      expect.fail('Should have thrown error')
    } catch (error: any) {
      // Step 3: Verify error message is clear
      expect(error.message).toContain('Cannot delete title')
      expect(error.message).toContain('existing inventory')

      // Message should help user understand what to do
      // (In UI, this would show: "You must deplete inventory before deleting this title")
    }
  })
})
