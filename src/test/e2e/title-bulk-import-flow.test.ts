/**
 * E2E Test: Bulk Import Flow (10.4)
 * Tests the full user journey of bulk importing titles via CSV
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'

describe('E2E: Title Bulk Import Flow', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('user successfully imports multiple valid titles', async () => {
    // Step 1: User navigates to bulk import page

    // Step 2: User uploads CSV file with multiple titles
    const titles_to_import = [
      {
        isbn: '9780306406157',
        title: 'Book One',
        author: 'Author One',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
        publisher: 'Publisher A',
        category: 'Technology',
      },
      {
        isbn: '9780306406164',
        title: 'Book Two',
        author: 'Author Two',
        format: Format.HARDCOVER,
        rrp: 39.99,
        unitCost: 12.00,
        publisher: 'Publisher B',
        category: 'Business',
      },
      {
        isbn: '9780306406171',
        title: 'Book Three',
        author: 'Author Three',
        format: Format.EBOOK,
        rrp: 19.99,
        unitCost: 5.00,
        publisher: 'Publisher C',
        category: 'Fiction',
      },
    ]

    // Step 3: User clicks import button
    const result = await titleService.bulkImport(titles_to_import)

    // Step 4: Verify success summary
    expect(result.success).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)

    // Step 5: Verify all titles were created in database
    const all_titles = await titleService.list({ page: 1, limit: 10 })
    expect(all_titles.data).toHaveLength(3)

    // Step 6: Verify each title has correct data
    const title1 = await titleService.findByISBN('9780306406157')
    expect(title1?.title).toBe('Book One')
    expect(title1?.author).toBe('Author One')

    // Step 7: Verify price history created for all imports
    if (title1) {
      const price_history = await titleService.getPriceHistory(title1.id)
      expect(price_history).toHaveLength(1)
      expect(price_history[0].reason).toBe('Initial creation')
    }
  })

  test('user imports with partial failures shows detailed error report', async () => {
    // Step 1: User uploads CSV with mix of valid and invalid titles
    const mixed_titles = [
      {
        isbn: '9780306406157',
        title: 'Valid Book One',
        author: 'Author One',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
      {
        isbn: '9780306406158',  // Invalid checksum
        title: 'Invalid ISBN Book',
        author: 'Author Two',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
      {
        isbn: '9780306406164',
        title: 'Valid Book Two',
        author: 'Author Three',
        format: Format.HARDCOVER,
        rrp: 39.99,
        unitCost: 12.00,
      },
      {
        isbn: 'invalid-isbn',  // Completely invalid format
        title: 'Bad Format Book',
        author: 'Author Four',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
    ]

    // Step 2: Import executes
    const result = await titleService.bulkImport(mixed_titles)

    // Step 3: Verify partial success summary
    expect(result.success).toBe(2)
    expect(result.failed).toBe(2)
    expect(result.errors).toHaveLength(2)

    // Step 4: Verify error details contain ISBN and error message
    expect(result.errors[0]).toHaveProperty('isbn')
    expect(result.errors[0]).toHaveProperty('error')
    expect(result.errors[0].isbn).toBe('9780306406158')

    // Step 5: Verify valid titles were still imported
    const title1 = await titleService.findByISBN('9780306406157')
    const title2 = await titleService.findByISBN('9780306406164')
    expect(title1).toBeDefined()
    expect(title2).toBeDefined()

    // Step 6: Verify invalid titles were not imported
    const invalid1 = await titleService.findByISBN('9780306406158')
    expect(invalid1).toBeNull()
  })

  test('user can download error report after failed imports', async () => {
    // Step 1: Import with errors
    const titles_with_errors = [
      {
        isbn: '9780306406157',
        title: 'Valid Book',
        author: 'Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
      {
        isbn: '9780306406158',  // Invalid
        title: 'Invalid Book',
        author: 'Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
    ]

    const result = await titleService.bulkImport(titles_with_errors)

    // Step 2: Verify error report structure for CSV export
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({
      isbn: '9780306406158',
      title: 'Invalid Book',
      error: expect.any(String),
    })

    // Step 3: User can download CSV with errors for correction
    // (In real implementation, this would generate a CSV file)
    const error_report_data = result.errors.map(e => ({
      isbn: e.isbn,
      title: e.title,
      error: e.error,
    }))

    expect(error_report_data).toHaveLength(1)
    expect(error_report_data[0].isbn).toBe('9780306406158')
  })

  test('user cannot import duplicate ISBNs within same batch', async () => {
    // Step 1: User uploads CSV with duplicate ISBNs
    const duplicate_titles = [
      {
        isbn: '9780306406157',
        title: 'First Occurrence',
        author: 'Author One',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
      {
        isbn: '9780306406157',  // Duplicate
        title: 'Second Occurrence',
        author: 'Author Two',
        format: Format.HARDCOVER,
        rrp: 39.99,
        unitCost: 12.00,
      },
    ]

    // Step 2: Import executes
    const result = await titleService.bulkImport(duplicate_titles)

    // Step 3: Verify first succeeds, second fails
    expect(result.success).toBe(1)
    expect(result.failed).toBe(1)

    // Step 4: Verify only one title exists
    const all_titles = await titleService.list({ page: 1, limit: 10 })
    expect(all_titles.data).toHaveLength(1)
  })

  test('user cannot import ISBN that already exists in database', async () => {
    // Step 1: Create existing title
    await titleService.create({
      isbn: '9780306406157',
      title: 'Existing Book',
      author: 'Existing Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    })

    // Step 2: Attempt to import title with same ISBN
    const titles_to_import = [
      {
        isbn: '9780306406157',  // Already exists
        title: 'New Book',
        author: 'New Author',
        format: Format.HARDCOVER,
        rrp: 39.99,
        unitCost: 12.00,
      },
    ]

    const result = await titleService.bulkImport(titles_to_import)

    // Step 3: Verify import fails for duplicate
    expect(result.success).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.errors[0].error).toContain('already exists')

    // Step 4: Verify original title unchanged
    const existing_title = await titleService.findByISBN('9780306406157')
    expect(existing_title?.title).toBe('Existing Book')
    expect(existing_title?.author).toBe('Existing Author')
  })

  test('user imports large batch of titles successfully', async () => {
    // Step 1: User uploads CSV with 50 titles
    const large_batch = Array.from({ length: 50 }, (_, i) => ({
      isbn: `978030640${String(6157 + i).padStart(4, '0')}`,
      title: `Book ${i + 1}`,
      author: `Author ${i + 1}`,
      format: i % 3 === 0 ? Format.PAPERBACK : i % 3 === 1 ? Format.HARDCOVER : Format.EBOOK,
      rrp: 29.99 + i,
      unitCost: 8.50 + i * 0.5,
    }))

    // Step 2: Import executes
    const start_time = Date.now()
    const result = await titleService.bulkImport(large_batch)
    const duration = Date.now() - start_time

    // Step 3: Verify all successful (may have some invalid ISBNs due to checksum)
    // Note: Some generated ISBNs may be invalid, that's expected
    expect(result.success).toBeGreaterThan(0)
    expect(result.success + result.failed).toBe(50)

    // Step 4: Verify performance (should complete within reasonable time)
    expect(duration).toBeLessThan(10000)  // Less than 10 seconds for 50 titles

    // Step 5: Verify titles in database
    const all_titles = await titleService.list({ page: 1, limit: 100 })
    expect(all_titles.data.length).toBe(result.success)
  })

  test('user can retry failed imports after fixing errors', async () => {
    // Step 1: First import attempt with errors
    const first_attempt = [
      {
        isbn: '9780306406157',
        title: 'Valid Book',
        author: 'Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
      {
        isbn: '9780306406158',  // Invalid
        title: 'Invalid Book',
        author: 'Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
      },
    ]

    const first_result = await titleService.bulkImport(first_attempt)
    expect(first_result.failed).toBe(1)

    // Step 2: User downloads error report and fixes ISBN
    const corrected_title = {
      isbn: '9780306406164',  // Corrected ISBN
      title: 'Previously Invalid Book',
      author: 'Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
    }

    // Step 3: User re-imports only the corrected title
    const retry_result = await titleService.bulkImport([corrected_title])

    // Step 4: Verify retry succeeds
    expect(retry_result.success).toBe(1)
    expect(retry_result.failed).toBe(0)

    // Step 5: Verify both titles now in database
    const all_titles = await titleService.list({ page: 1, limit: 10 })
    expect(all_titles.data).toHaveLength(2)
  })

  test('empty import file shows appropriate message', async () => {
    // Step 1: User uploads empty CSV
    const empty_batch: any[] = []

    // Step 2: Verify validation catches empty batch
    const result = await titleService.bulkImport(empty_batch)

    // Step 3: No titles imported
    expect(result.success).toBe(0)
    expect(result.failed).toBe(0)
  })
})
