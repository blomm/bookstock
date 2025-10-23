/**
 * E2E Test: Search and Filter Flow (10.3)
 * Tests the full user journey of searching and filtering titles
 */

import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { titleService } from '@/services/titleService'
import { Format } from '@prisma/client'

describe('E2E: Title Search and Filter Flow', () => {
  beforeEach(async () => {
    await cleanDatabase()

    // Create diverse test data for search and filter scenarios
    await titleService.create({
      isbn: '9780306406157',
      title: 'React Programming Guide',
      author: 'John Smith',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
      category: 'Technology',
      publisher: 'Tech Books Inc',
    })

    await titleService.create({
      isbn: '9780306406164',
      title: 'Vue.js Masterclass',
      author: 'Jane Doe',
      format: Format.HARDCOVER,
      rrp: 39.99,
      unitCost: 12.00,
      category: 'Technology',
      publisher: 'Tech Books Inc',
    })

    await titleService.create({
      isbn: '9780306406171',
      title: 'React Native Development',
      author: 'John Smith',
      format: Format.PAPERBACK,
      rrp: 34.99,
      unitCost: 9.50,
      category: 'Mobile Development',
      publisher: 'Mobile Press',
    })

    await titleService.create({
      isbn: '9780306406188',
      title: 'Cooking with Python',
      author: 'Chef Python',
      format: Format.EBOOK,
      rrp: 19.99,
      unitCost: 5.00,
      category: 'Cooking',
      publisher: 'Food Publishing',
    })

    await titleService.create({
      isbn: '9780306406195',
      title: 'Angular Development Cookbook',
      author: 'Angular Master',
      format: Format.HARDCOVER,
      rrp: 44.99,
      unitCost: 13.00,
      category: 'Technology',
      publisher: 'Tech Books Inc',
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('user can see all titles without filters', async () => {
    // Step 1: User navigates to titles page
    const result = await titleService.list({
      page: 1,
      limit: 20,
    })

    // Step 2: Verify all titles are displayed
    expect(result.data).toHaveLength(5)
    expect(result.pagination.total).toBe(5)
    expect(result.pagination.totalPages).toBe(1)
  })

  test('user can search titles by title text', async () => {
    // Step 1: User enters "React" in search box
    const result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'React',
    })

    // Step 2: Verify filtered results
    expect(result.data).toHaveLength(2)
    expect(result.data[0].title).toContain('React')
    expect(result.data[1].title).toContain('React')
  })

  test('user can search titles by author name', async () => {
    // Step 1: User searches for author "John Smith"
    const result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'John Smith',
    })

    // Step 2: Verify results
    expect(result.data).toHaveLength(2)
    expect(result.data.every(t => t.author === 'John Smith')).toBe(true)
  })

  test('user can search titles by ISBN', async () => {
    // Step 1: User searches by partial ISBN
    const result = await titleService.list({
      page: 1,
      limit: 20,
      search: '9780306406164',
    })

    // Step 2: Verify exact match
    expect(result.data).toHaveLength(1)
    expect(result.data[0].isbn).toBe('9780306406164')
    expect(result.data[0].title).toBe('Vue.js Masterclass')
  })

  test('user can filter titles by format', async () => {
    // Step 1: User selects "PAPERBACK" format filter
    const result = await titleService.list({
      page: 1,
      limit: 20,
      format: Format.PAPERBACK,
    })

    // Step 2: Verify only paperback titles shown
    expect(result.data).toHaveLength(2)
    expect(result.data.every(t => t.format === Format.PAPERBACK)).toBe(true)
  })

  test('user can filter titles by category', async () => {
    // Step 1: User enters "Technology" category filter
    const result = await titleService.list({
      page: 1,
      limit: 20,
      category: 'Technology',
    })

    // Step 2: Verify only technology titles shown
    expect(result.data).toHaveLength(3)
    expect(result.data.every(t => t.category === 'Technology')).toBe(true)
  })

  test('user can filter titles by publisher', async () => {
    // Step 1: User enters "Tech Books Inc" publisher filter
    const result = await titleService.list({
      page: 1,
      limit: 20,
      publisher: 'Tech Books Inc',
    })

    // Step 2: Verify only titles from that publisher shown
    expect(result.data).toHaveLength(3)
    expect(result.data.every(t => t.publisher === 'Tech Books Inc')).toBe(true)
  })

  test('user can combine search with format filter', async () => {
    // Step 1: User searches "React" AND filters by PAPERBACK
    const result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'React',
      format: Format.PAPERBACK,
    })

    // Step 2: Verify results match both criteria
    expect(result.data).toHaveLength(2)
    expect(result.data.every(t => t.format === Format.PAPERBACK)).toBe(true)
    expect(result.data.every(t => t.title.includes('React'))).toBe(true)
  })

  test('user can combine multiple filters', async () => {
    // Step 1: User filters by format, category, and publisher
    const result = await titleService.list({
      page: 1,
      limit: 20,
      format: Format.HARDCOVER,
      category: 'Technology',
      publisher: 'Tech Books Inc',
    })

    // Step 2: Verify results match all criteria
    expect(result.data).toHaveLength(2)
    expect(result.data.every(t => t.format === Format.HARDCOVER)).toBe(true)
    expect(result.data.every(t => t.category === 'Technology')).toBe(true)
    expect(result.data.every(t => t.publisher === 'Tech Books Inc')).toBe(true)
  })

  test('user can sort titles by title ascending', async () => {
    // Step 1: User selects sort by title A-Z
    const result = await titleService.list({
      page: 1,
      limit: 20,
      sortBy: 'title',
      sortOrder: 'asc',
    })

    // Step 2: Verify alphabetical order
    expect(result.data).toHaveLength(5)
    expect(result.data[0].title).toBe('Angular Development Cookbook')
    expect(result.data[1].title).toBe('Cooking with Python')
    expect(result.data[4].title).toBe('Vue.js Masterclass')
  })

  test('user can sort titles by title descending', async () => {
    // Step 1: User selects sort by title Z-A
    const result = await titleService.list({
      page: 1,
      limit: 20,
      sortBy: 'title',
      sortOrder: 'desc',
    })

    // Step 2: Verify reverse alphabetical order
    expect(result.data).toHaveLength(5)
    expect(result.data[0].title).toBe('Vue.js Masterclass')
    expect(result.data[4].title).toBe('Angular Development Cookbook')
  })

  test('user can paginate through results', async () => {
    // Step 1: User sets page size to 2
    const page1 = await titleService.list({
      page: 1,
      limit: 2,
      sortBy: 'title',
      sortOrder: 'asc',
    })

    // Step 2: Verify page 1 results
    expect(page1.data).toHaveLength(2)
    expect(page1.pagination.page).toBe(1)
    expect(page1.pagination.totalPages).toBe(3)
    expect(page1.pagination.total).toBe(5)

    // Step 3: User clicks next page
    const page2 = await titleService.list({
      page: 2,
      limit: 2,
      sortBy: 'title',
      sortOrder: 'asc',
    })

    // Step 4: Verify page 2 has different results
    expect(page2.data).toHaveLength(2)
    expect(page2.pagination.page).toBe(2)
    expect(page2.data[0].title).not.toBe(page1.data[0].title)

    // Step 5: User goes to final page
    const page3 = await titleService.list({
      page: 3,
      limit: 2,
      sortBy: 'title',
      sortOrder: 'asc',
    })

    // Step 6: Verify last page has remaining result
    expect(page3.data).toHaveLength(1)
    expect(page3.pagination.page).toBe(3)
  })

  test('search with no results returns empty list', async () => {
    // Step 1: User searches for non-existent text
    const result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'NonExistentBookTitle12345',
    })

    // Step 2: Verify empty results with helpful message
    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
  })

  test('case-insensitive search works correctly', async () => {
    // Step 1: User searches with different case
    const lowercase_result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'react',
    })

    const uppercase_result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'REACT',
    })

    const mixedcase_result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'ReAcT',
    })

    // Step 2: Verify all return same results
    expect(lowercase_result.data).toHaveLength(2)
    expect(uppercase_result.data).toHaveLength(2)
    expect(mixedcase_result.data).toHaveLength(2)
  })

  test('user can clear all filters and see all results again', async () => {
    // Step 1: User applies multiple filters
    const filtered_result = await titleService.list({
      page: 1,
      limit: 20,
      search: 'React',
      format: Format.PAPERBACK,
    })

    expect(filtered_result.data).toHaveLength(2)

    // Step 2: User clicks "Clear Filters" button
    const cleared_result = await titleService.list({
      page: 1,
      limit: 20,
      // No filters applied
    })

    // Step 3: Verify all titles shown again
    expect(cleared_result.data).toHaveLength(5)
  })
})
