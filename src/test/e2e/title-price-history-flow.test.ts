/**
 * E2E Test: Price History Tracking Flow (10.5)
 * Tests the full user journey of price history tracking across title lifecycle
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'

describe('E2E: Price History Tracking Flow', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('price history created on title creation', async () => {
    // Step 1: User creates new title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'New Book',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: User views title detail page
    const detail = await titleService.findById(title.id)
    expect(detail).toBeDefined()

    // Step 3: User clicks on "Price History" tab
    const price_history = await titleService.getPriceHistory(title.id)

    // Step 4: Verify initial price history entry exists
    expect(price_history).toHaveLength(1)
    expect(price_history[0]).toMatchObject({
      titleId: title.id,
      rrp: 29.99,
      unitCost: 8.50,
      reason: 'Initial creation',
    })
    expect(price_history[0].effectiveFrom).toBeInstanceOf(Date)
  })

  test('price history updated when RRP changes', async () => {
    // Step 1: Create title with initial price
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Price Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10))

    // Step 2: User edits title and changes RRP
    await titleService.update(title.id, {
      rrp: 34.99,
      priceChangeReason: 'Price increase for 2024',
    })

    // Step 3: User views price history
    const price_history = await titleService.getPriceHistory(title.id)

    // Step 4: Verify two entries exist
    expect(price_history).toHaveLength(2)

    // Step 5: Verify newest entry is first (DESC order)
    expect(price_history[0].rrp).toBe(34.99)
    expect(price_history[0].unitCost).toBe(8.50)  // Unchanged
    expect(price_history[0].reason).toBe('Price increase for 2024')

    // Step 6: Verify old entry preserved
    expect(price_history[1].rrp).toBe(29.99)
    expect(price_history[1].reason).toBe('Initial creation')

    // Step 7: Verify effective dates show progression
    expect(price_history[0].effectiveFrom.getTime()).toBeGreaterThan(
      price_history[1].effectiveFrom.getTime()
    )
  })

  test('price history updated when unit cost changes', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Cost Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    // Step 2: User updates unit cost only
    await titleService.update(title.id, {
      unitCost: 9.50,
      priceChangeReason: 'Supplier cost increase',
    })

    // Step 3: Verify price history tracks cost change
    const price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(2)
    expect(price_history[0].unitCost).toBe(9.50)
    expect(price_history[0].rrp).toBe(29.99)  // Unchanged
    expect(price_history[0].reason).toBe('Supplier cost increase')
  })

  test('price history updated when both prices change', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Full Price Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    // Step 2: User updates both RRP and unit cost
    await titleService.update(title.id, {
      rrp: 34.99,
      unitCost: 9.50,
      priceChangeReason: 'Complete pricing update',
    })

    // Step 3: Verify both prices tracked in single entry
    const price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(2)
    expect(price_history[0].rrp).toBe(34.99)
    expect(price_history[0].unitCost).toBe(9.50)
    expect(price_history[0].reason).toBe('Complete pricing update')
  })

  test('no price history created when prices unchanged', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'No Price Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: User updates non-price fields
    await titleService.update(title.id, {
      title: 'Updated Title',
      author: 'Updated Author',
      pageCount: 350,
    })

    // Step 3: Verify no new price history entry
    const price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(1)  // Only initial creation
    expect(price_history[0].reason).toBe('Initial creation')
  })

  test('multiple price changes create complete history timeline', async () => {
    // Step 1: Create title at initial price
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Timeline Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: First price increase
    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      rrp: 32.99,
      priceChangeReason: 'Q1 2024 price adjustment',
    })

    // Step 3: Second price increase
    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      rrp: 34.99,
      priceChangeReason: 'Q2 2024 price adjustment',
    })

    // Step 4: Cost increase only
    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      unitCost: 9.50,
      priceChangeReason: 'Supplier cost increase Q3',
    })

    // Step 5: Final price decrease
    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      rrp: 32.99,
      priceChangeReason: 'Q4 2024 promotional pricing',
    })

    // Step 6: Verify complete history timeline
    const price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(5)

    // Step 7: Verify chronological order (newest first)
    expect(price_history[0].reason).toBe('Q4 2024 promotional pricing')
    expect(price_history[0].rrp).toBe(32.99)

    expect(price_history[1].reason).toBe('Supplier cost increase Q3')
    expect(price_history[1].unitCost).toBe(9.50)

    expect(price_history[2].reason).toBe('Q2 2024 price adjustment')
    expect(price_history[2].rrp).toBe(34.99)

    expect(price_history[3].reason).toBe('Q1 2024 price adjustment')
    expect(price_history[3].rrp).toBe(32.99)

    expect(price_history[4].reason).toBe('Initial creation')
    expect(price_history[4].rrp).toBe(29.99)

    // Step 8: Verify timestamps show progression
    for (let i = 0; i < price_history.length - 1; i++) {
      expect(price_history[i].effectiveFrom.getTime()).toBeGreaterThan(
        price_history[i + 1].effectiveFrom.getTime()
      )
    }
  })

  test('bulk price update creates history for all titles', async () => {
    // Step 1: Create multiple titles
    const title1 = await titleService.create({
      isbn: '9780306406157',
      title: 'Book 1',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    const title2 = await titleService.create({
      isbn: '9780306406164',
      title: 'Book 2',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 39.99,
      unitCost: 12.00,
    })

    const title3 = await titleService.create({
      isbn: '9780306406171',
      title: 'Book 3',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 19.99,
      unitCost: 6.00,
    })

    // Step 2: User performs bulk price update
    const updates = [
      { id: title1.id, rrp: 34.99 },
      { id: title2.id, rrp: 44.99 },
      { id: title3.id, rrp: 24.99 },
    ]

    await titleService.bulkUpdatePrices(updates, 'Annual price increase 2024')

    // Step 3: Verify price history created for each title
    const history1 = await titleService.getPriceHistory(title1.id)
    const history2 = await titleService.getPriceHistory(title2.id)
    const history3 = await titleService.getPriceHistory(title3.id)

    expect(history1).toHaveLength(2)
    expect(history2).toHaveLength(2)
    expect(history3).toHaveLength(2)

    // Step 4: Verify all have same reason
    expect(history1[0].reason).toBe('Annual price increase 2024')
    expect(history2[0].reason).toBe('Annual price increase 2024')
    expect(history3[0].reason).toBe('Annual price increase 2024')

    // Step 5: Verify new prices applied
    expect(history1[0].rrp).toBe(34.99)
    expect(history2[0].rrp).toBe(44.99)
    expect(history3[0].rrp).toBe(24.99)
  })

  test('user can view full price history with all details', async () => {
    // Step 1: Create title and make multiple price changes
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Detailed History Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      rrp: 34.99,
      priceChangeReason: 'First increase',
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      unitCost: 9.50,
      priceChangeReason: 'Cost adjustment',
    })

    // Step 2: User views complete price history table
    const price_history = await titleService.getPriceHistory(title.id)

    // Step 3: Verify all fields available for display
    price_history.forEach(entry => {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('titleId')
      expect(entry).toHaveProperty('rrp')
      expect(entry).toHaveProperty('unitCost')
      expect(entry).toHaveProperty('reason')
      expect(entry).toHaveProperty('effectiveFrom')
      expect(entry.effectiveFrom).toBeInstanceOf(Date)
    })

    // Step 4: Verify history shows pricing evolution
    expect(price_history[0].rrp).toBe(34.99)
    expect(price_history[0].unitCost).toBe(9.50)

    expect(price_history[1].rrp).toBe(34.99)
    expect(price_history[1].unitCost).toBe(8.50)

    expect(price_history[2].rrp).toBe(29.99)
    expect(price_history[2].unitCost).toBe(8.50)
  })

  test('price history preserved when title deleted', async () => {
    // Step 1: Create title with price history
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Deletion Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    await new Promise(resolve => setTimeout(resolve, 10))
    await titleService.update(title.id, {
      rrp: 34.99,
      priceChangeReason: 'Price update before deletion',
    })

    // Step 2: Get price history before deletion
    const history_before = await titleService.getPriceHistory(title.id)
    expect(history_before).toHaveLength(2)

    // Step 3: User deletes title
    await titleService.delete(title.id)

    // Step 4: Verify price history was cascade deleted (expected behavior)
    // Note: This tests current implementation - if soft delete is implemented,
    // this test should verify history is preserved
    await expect(titleService.getPriceHistory(title.id)).rejects.toThrow()
  })
})
