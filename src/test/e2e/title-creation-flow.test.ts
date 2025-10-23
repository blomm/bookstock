/**
 * E2E Test: Complete Title Creation Flow (10.1)
 * Tests the full user journey of creating a new title from start to finish
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestUser } from '../utils/test-db'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'

describe('E2E: Title Creation Flow', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('complete title creation flow: user creates a new title successfully', async () => {
    // Step 1: User navigates to create title page (simulated by having valid data)
    const new_title_data = {
      isbn: '9780306406157',
      title: 'Test Book for E2E',
      author: 'E2E Test Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
      publisher: 'Test Publisher',
      pageCount: 350,
      category: 'Technology',
      publicationDate: new Date('2024-01-15'),
      tradeDiscount: 40.0,
      royaltyRate: 10.0,
    }

    // Step 2: User fills out the form and submits
    const created_title = await titleService.create(new_title_data)

    // Step 3: Verify title was created with correct data
    expect(created_title).toBeDefined()
    expect(created_title.id).toBeDefined()
    expect(created_title.isbn).toBe('9780306406157')
    expect(created_title.title).toBe('Test Book for E2E')
    expect(created_title.author).toBe('E2E Test Author')
    expect(created_title.format).toBe(Format.PAPERBACK)
    expect(created_title.rrp).toBe(29.99)
    expect(created_title.unitCost).toBe(8.50)

    // Step 4: User is redirected to detail page - verify we can fetch the title
    const fetched_title = await titleService.findById(created_title.id)
    expect(fetched_title).toBeDefined()
    expect(fetched_title.id).toBe(created_title.id)
    expect(fetched_title.title).toBe('Test Book for E2E')

    // Step 5: Verify price history was automatically created
    const price_history = await titleService.getPriceHistory(created_title.id)
    expect(price_history).toHaveLength(1)
    expect(price_history[0].rrp).toBe(29.99)
    expect(price_history[0].unitCost).toBe(8.50)
    expect(price_history[0].reason).toBe('Initial creation')

    // Step 6: Verify title appears in list
    const title_list = await titleService.list({
      page: 1,
      limit: 20,
      search: 'E2E Test'
    })
    expect(title_list.data).toHaveLength(1)
    expect(title_list.data[0].id).toBe(created_title.id)
  })

  test('title creation with duplicate ISBN should fail with clear error', async () => {
    // Step 1: Create first title
    await titleService.create({
      isbn: '9780306406157',
      title: 'First Book',
      author: 'Author One',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Attempt to create title with same ISBN
    await expect(
      titleService.create({
        isbn: '9780306406157',
        title: 'Second Book',
        author: 'Author Two',
        format: Format.HARDCOVER,
        rrp: 39.99,
        unitCost: 12.00,
      })
    ).rejects.toThrow('Title with ISBN 9780306406157 already exists')
  })

  test('title creation with invalid ISBN should fail validation', async () => {
    // User enters invalid ISBN
    await expect(
      titleService.create({
        isbn: '9780306406158', // Invalid checksum
        title: 'Invalid ISBN Book',
        author: 'Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      })
    ).rejects.toThrow('Invalid ISBN-13 checksum')
  })

  test('title creation with missing required fields should fail validation', async () => {
    // User tries to submit incomplete form
    await expect(
      titleService.create({
        isbn: '9780306406157',
        title: '',  // Missing title
        author: 'Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      })
    ).rejects.toThrow()
  })

  test('title creation normalizes ISBN before saving', async () => {
    // User enters ISBN with hyphens
    const created_title = await titleService.create({
      isbn: '978-0-306-40615-7',  // With hyphens
      title: 'Book with Formatted ISBN',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Verify ISBN stored without hyphens
    expect(created_title.isbn).toBe('9780306406157')

    // Verify user can find it with either format
    const found_by_normalized = await titleService.findByISBN('9780306406157')
    const found_by_formatted = await titleService.findByISBN('978-0-306-40615-7')

    expect(found_by_normalized?.id).toBe(created_title.id)
    expect(found_by_formatted?.id).toBe(created_title.id)
  })
})
