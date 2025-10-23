/**
 * E2E Test: Complete Title Edit Flow (10.2)
 * Tests the full user journey of editing an existing title
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'

describe('E2E: Title Edit Flow', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('complete title edit flow: user updates title information successfully', async () => {
    // Step 1: Create initial title
    const initial_title = await titleService.create({
      isbn: '9780306406157',
      title: 'Original Title',
      author: 'Original Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
      publisher: 'Original Publisher',
    })

    // Step 2: User navigates to edit page and fetches title data
    const title_to_edit = await titleService.findById(initial_title.id)
    expect(title_to_edit).toBeDefined()
    expect(title_to_edit.title).toBe('Original Title')

    // Step 3: User updates title information
    const updated_title = await titleService.update(initial_title.id, {
      title: 'Updated Title',
      author: 'Updated Author',
      publisher: 'Updated Publisher',
      pageCount: 400,
    })

    // Step 4: Verify updates were applied
    expect(updated_title.title).toBe('Updated Title')
    expect(updated_title.author).toBe('Updated Author')
    expect(updated_title.publisher).toBe('Updated Publisher')
    expect(updated_title.pageCount).toBe(400)

    // Step 5: Verify original data that wasn't changed remains the same
    expect(updated_title.isbn).toBe('9780306406157')
    expect(updated_title.format).toBe(Format.PAPERBACK)
    expect(updated_title.rrp).toBe(29.99)
    expect(updated_title.unitCost).toBe(8.50)

    // Step 6: Verify user can see updated title in detail view
    const fetched_updated = await titleService.findById(initial_title.id)
    expect(fetched_updated.title).toBe('Updated Title')
    expect(fetched_updated.author).toBe('Updated Author')
  })

  test('edit title with price change creates price history', async () => {
    // Step 1: Create initial title with starting price
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Price Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Verify initial price history
    let price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(1)
    expect(price_history[0].rrp).toBe(29.99)

    // Step 2: User changes price
    const updated_title = await titleService.update(title.id, {
      rrp: 34.99,
      priceChangeReason: 'Price increase due to inflation',
    })

    // Step 3: Verify price was updated
    expect(updated_title.rrp).toBe(34.99)

    // Step 4: Verify price history was created
    price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(2)

    // Step 5: Verify latest price history entry
    const latest_entry = price_history[0]
    expect(latest_entry.rrp).toBe(34.99)
    expect(latest_entry.reason).toBe('Price increase due to inflation')

    // Step 6: Verify old price history entry is preserved
    const old_entry = price_history[1]
    expect(old_entry.rrp).toBe(29.99)
    expect(old_entry.reason).toBe('Initial creation')
  })

  test('edit title with both RRP and unit cost changes creates complete history', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Full Price Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Update both prices
    await titleService.update(title.id, {
      rrp: 34.99,
      unitCost: 9.50,
      priceChangeReason: 'Updated pricing structure',
    })

    // Step 3: Verify both prices tracked in history
    const price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(2)

    const latest = price_history[0]
    expect(latest.rrp).toBe(34.99)
    expect(latest.unitCost).toBe(9.50)
    expect(latest.reason).toBe('Updated pricing structure')
  })

  test('edit title without price change does not create price history', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'No Price Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Update non-price fields
    await titleService.update(title.id, {
      title: 'Updated Title',
      author: 'Updated Author',
      pageCount: 400,
    })

    // Step 3: Verify no new price history entry
    const price_history = await titleService.getPriceHistory(title.id)
    expect(price_history).toHaveLength(1)  // Only initial creation entry
    expect(price_history[0].reason).toBe('Initial creation')
  })

  test('edit title with duplicate ISBN fails validation', async () => {
    // Step 1: Create two titles
    const title1 = await titleService.create({
      isbn: '9780306406157',
      title: 'First Book',
      author: 'Author One',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    const title2 = await titleService.create({
      isbn: '9780306406164',
      title: 'Second Book',
      author: 'Author Two',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Attempt to change title2's ISBN to title1's ISBN
    await expect(
      titleService.update(title2.id, {
        isbn: '9780306406157',  // Duplicate
      })
    ).rejects.toThrow('Title with ISBN 9780306406157 already exists')
  })

  test('edit non-existent title fails with clear error', async () => {
    // User attempts to edit title that doesn't exist
    await expect(
      titleService.update(99999, {
        title: 'Updated Title',
      })
    ).rejects.toThrow('Title not found')
  })

  test('edit title with invalid data fails validation', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'Valid Title',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Attempt to update with invalid data
    await expect(
      titleService.update(title.id, {
        rrp: -10,  // Negative price
      })
    ).rejects.toThrow()
  })

  test('user can change ISBN to different valid ISBN', async () => {
    // Step 1: Create title
    const title = await titleService.create({
      isbn: '9780306406157',
      title: 'ISBN Change Test',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Update to new valid ISBN
    const updated_title = await titleService.update(title.id, {
      isbn: '9780306406164',  // Different valid ISBN
    })

    // Step 3: Verify ISBN was changed
    expect(updated_title.isbn).toBe('9780306406164')

    // Step 4: Verify can no longer find by old ISBN
    const found_by_old = await titleService.findByISBN('9780306406157')
    expect(found_by_old).toBeNull()

    // Step 5: Verify can find by new ISBN
    const found_by_new = await titleService.findByISBN('9780306406164')
    expect(found_by_new?.id).toBe(title.id)
  })
})
