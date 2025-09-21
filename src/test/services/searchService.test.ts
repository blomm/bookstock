import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestSeries, createTestWarehouse } from '../utils/test-db'
import {
  searchTitles,
  searchTitlesByISBN,
  suggestSearchTerms,
  getPopularSearches,
  getSearchPerformanceStats,
  setDbClient,
  SearchQuery,
  SearchFilters
} from '@/services/searchService'

describe('Search Service', () => {
  beforeEach(async () => {
    setDbClient(testDb)
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Full-text Search', () => {
    test('should search titles by title field', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Great Expectations',
        author: 'Charles Dickens'
      })

      const results = await searchTitles({
        query: 'Great'
      })

      expect(results.titles).toHaveLength(2)
      expect(results.titles.every(t => t.title.includes('Great'))).toBe(true)
    })

    test('should search titles by author field', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'This Side of Paradise',
        author: 'F. Scott Fitzgerald'
      })

      const results = await searchTitles({
        query: 'Fitzgerald'
      })

      expect(results.titles).toHaveLength(2)
      expect(results.titles.every(t => t.author.includes('Fitzgerald'))).toBe(true)
    })

    test('should search titles by ISBN', async () => {
      await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'Test Author'
      })

      const results = await searchTitles({
        query: '9781234567890'
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].isbn).toBe('9781234567890')
    })

    test('should search with multiple terms (AND logic)', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Harry Potter and the Stone',
        author: 'J.K. Rowling'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Harry Potter and the Chamber',
        author: 'J.K. Rowling'
      })

      await createTestTitle({
        isbn: '9783333333333',
        title: 'Lord of the Rings',
        author: 'J.R.R. Tolkien'
      })

      const results = await searchTitles({
        query: 'Harry Potter'
      })

      expect(results.titles).toHaveLength(2)
      expect(results.titles.every(t =>
        t.title.includes('Harry') && t.title.includes('Potter')
      )).toBe(true)
    })

    test('should handle case-insensitive search', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'UPPERCASE TITLE',
        author: 'lowercase author'
      })

      const results = await searchTitles({
        query: 'uppercase'
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].title).toBe('UPPERCASE TITLE')
    })

    test('should search across series names', async () => {
      const series = await createTestSeries({
        name: 'Harry Potter Series'
      })

      await createTestTitle({
        isbn: '9781111111111',
        title: 'Book One',
        author: 'J.K. Rowling',
        seriesId: series.id
      })

      const results = await searchTitles({
        query: 'Harry Potter'
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].series?.name).toBe('Harry Potter Series')
    })
  })

  describe('Advanced Filtering', () => {
    test('should filter by format', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Hardcover Book',
        format: 'HARDCOVER'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Paperback Book',
        format: 'PAPERBACK'
      })

      const results = await searchTitles({
        filters: {
          format: ['HARDCOVER']
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].format).toBe('HARDCOVER')
    })

    test('should filter by multiple formats', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Hardcover Book',
        format: 'HARDCOVER'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Paperback Book',
        format: 'PAPERBACK'
      })

      await createTestTitle({
        isbn: '9783333333333',
        title: 'Digital Book',
        format: 'DIGITAL'
      })

      const results = await searchTitles({
        filters: {
          format: ['HARDCOVER', 'PAPERBACK']
        }
      })

      expect(results.titles).toHaveLength(2)
      expect(results.titles.every(t =>
        t.format === 'HARDCOVER' || t.format === 'PAPERBACK'
      )).toBe(true)
    })

    test('should filter by category', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Fiction Book',
        category: 'Fiction'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Non-Fiction Book',
        category: 'Non-Fiction'
      })

      const results = await searchTitles({
        filters: {
          category: ['Fiction']
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].category).toBe('Fiction')
    })

    test('should filter by publisher', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Penguin Book',
        publisher: 'Penguin Random House'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'HarperCollins Book',
        publisher: 'HarperCollins'
      })

      const results = await searchTitles({
        filters: {
          publisher: ['Penguin Random House']
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].publisher).toBe('Penguin Random House')
    })

    test('should filter by price range', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Cheap Book',
        rrp: 9.99
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Expensive Book',
        rrp: 29.99
      })

      const results = await searchTitles({
        filters: {
          priceRange: {
            min: 10,
            max: 30
          }
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].title).toBe('Expensive Book')
    })

    test('should filter by series', async () => {
      const series1 = await createTestSeries({ name: 'Series One' })
      const series2 = await createTestSeries({ name: 'Series Two' })

      await createTestTitle({
        isbn: '9781111111111',
        title: 'Book in Series One',
        seriesId: series1.id
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Book in Series Two',
        seriesId: series2.id
      })

      const results = await searchTitles({
        filters: {
          seriesId: [series1.id]
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].seriesId).toBe(series1.id)
    })

    test('should filter by status', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Active Book',
        status: 'ACTIVE'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Discontinued Book',
        status: 'DISCONTINUED'
      })

      const results = await searchTitles({
        filters: {
          status: ['ACTIVE']
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].status).toBe('ACTIVE')
    })

    test('should filter by inventory availability', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW1'
      })

      const titleWithInventory = await createTestTitle({
        isbn: '9781111111111',
        title: 'Book with Stock'
      })

      const titleWithoutInventory = await createTestTitle({
        isbn: '9782222222222',
        title: 'Book without Stock'
      })

      // Add inventory for one title
      await testDb.inventory.create({
        data: {
          titleId: titleWithInventory.id,
          warehouseId: warehouse.id,
          currentStock: 10,
          reservedStock: 0
        }
      })

      const results = await searchTitles({
        filters: {
          hasInventory: true
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].title).toBe('Book with Stock')
    })
  })

  describe('Search Result Ranking and Relevance', () => {
    test('should rank exact title matches higher', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Great Expectations',
        author: 'Charles Dickens'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald'
      })

      const results = await searchTitles({
        query: 'Great Expectations',
        sorting: { field: 'relevance', direction: 'desc' }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].title).toBe('Great Expectations')
    })

    test('should rank ISBN matches very highly', async () => {
      await createTestTitle({
        isbn: '9781234567890',
        title: 'Book with Matching ISBN',
        author: 'Author One'
      })

      await createTestTitle({
        isbn: '9780987654321',
        title: 'Book with Title Match 1234567890',
        author: 'Author Two'
      })

      const results = await searchTitles({
        query: '1234567890',
        sorting: { field: 'relevance', direction: 'desc' }
      })

      expect(results.titles).toHaveLength(2)
      expect(results.titles[0].isbn).toBe('9781234567890')
      expect(results.titles[0].searchScore).toBeGreaterThan(results.titles[1].searchScore!)
    })

    test('should include match reasons in search results', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'JavaScript Programming',
        author: 'John Doe',
        description: 'A comprehensive guide to JavaScript development'
      })

      const results = await searchTitles({
        query: 'JavaScript'
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].matchReasons).toContain('Title contains "javascript"')
      expect(results.titles[0].matchReasons).toContain('Description contains "javascript"')
    })

    test('should boost scores for exact phrase matches', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Harry Potter and the Stone',
        author: 'J.K. Rowling'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Harry and Potter separately',
        author: 'Different Author'
      })

      const results = await searchTitles({
        query: 'Harry Potter',
        sorting: { field: 'relevance', direction: 'desc' }
      })

      expect(results.titles).toHaveLength(2)
      expect(results.titles[0].title).toBe('Harry Potter and the Stone')
      expect(results.titles[0].searchScore).toBeGreaterThan(results.titles[1].searchScore!)
    })
  })

  describe('Pagination and Sorting', () => {
    test('should paginate search results', async () => {
      // Create 25 test titles
      for (let i = 1; i <= 25; i++) {
        await createTestTitle({
          isbn: `978${i.toString().padStart(10, '0')}`,
          title: `Test Book ${i}`,
          author: 'Test Author'
        })
      }

      const page1 = await searchTitles({
        query: 'Test Book',
        pagination: { page: 1, limit: 10 }
      })

      const page2 = await searchTitles({
        query: 'Test Book',
        pagination: { page: 2, limit: 10 }
      })

      expect(page1.titles).toHaveLength(10)
      expect(page2.titles).toHaveLength(10)
      expect(page1.pagination.total).toBe(25)
      expect(page1.pagination.totalPages).toBe(3)

      // Ensure no overlap between pages
      const page1Ids = page1.titles.map(t => t.id)
      const page2Ids = page2.titles.map(t => t.id)
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false)
    })

    test('should sort by title alphabetically', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Zebra Book'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Alpha Book'
      })

      await createTestTitle({
        isbn: '9783333333333',
        title: 'Beta Book'
      })

      const results = await searchTitles({
        sorting: { field: 'title', direction: 'asc' }
      })

      expect(results.titles.map(t => t.title)).toEqual([
        'Alpha Book',
        'Beta Book',
        'Zebra Book'
      ])
    })

    test('should sort by price', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Expensive Book',
        rrp: 29.99
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Cheap Book',
        rrp: 9.99
      })

      await createTestTitle({
        isbn: '9783333333333',
        title: 'Medium Book',
        rrp: 19.99
      })

      const results = await searchTitles({
        sorting: { field: 'rrp', direction: 'asc' }
      })

      expect(results.titles.map(t => Number(t.rrp))).toEqual([9.99, 19.99, 29.99])
    })
  })

  describe('ISBN Search', () => {
    test('should find titles by partial ISBN', async () => {
      await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book'
      })

      const results = await searchTitlesByISBN('1234567')

      expect(results).toHaveLength(1)
      expect(results[0].isbn).toBe('9781234567890')
    })

    test('should handle ISBN with hyphens and spaces', async () => {
      await createTestTitle({
        isbn: '9781234567890',
        title: 'Test Book'
      })

      const results = await searchTitlesByISBN('978-1-234-567-890')

      expect(results).toHaveLength(1)
      expect(results[0].isbn).toBe('9781234567890')
    })
  })

  describe('Search Suggestions', () => {
    test('should suggest terms based on title words', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'JavaScript Programming Guide',
        author: 'John Doe'
      })

      const suggestions = await suggestSearchTerms('Java', 5)

      expect(suggestions).toContain('JavaScript')
    })

    test('should suggest terms based on author names', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Test Book',
        author: 'J.K. Rowling'
      })

      const suggestions = await suggestSearchTerms('Row', 5)

      expect(suggestions).toContain('Rowling')
    })

    test('should limit suggestion results', async () => {
      // Create titles with many matching words
      for (let i = 1; i <= 20; i++) {
        await createTestTitle({
          isbn: `978${i.toString().padStart(10, '0')}`,
          title: `JavaScript Book ${i}`,
          author: 'Author'
        })
      }

      const suggestions = await suggestSearchTerms('Java', 5)

      expect(suggestions.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Popular Searches', () => {
    test('should return popular categories and publishers', async () => {
      // Create titles in popular categories
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Fiction Book 1',
        category: 'Fiction',
        publisher: 'Popular Publisher'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'Fiction Book 2',
        category: 'Fiction',
        publisher: 'Popular Publisher'
      })

      const popular = await getPopularSearches(5)

      expect(popular.length).toBeGreaterThan(0)
      expect(popular.some(p => p.term === 'Fiction')).toBe(true)
      expect(popular.some(p => p.term === 'Popular Publisher')).toBe(true)
    })
  })

  describe('Performance and Analytics', () => {
    test('should return performance statistics', async () => {
      const stats = await getSearchPerformanceStats()

      expect(stats).toHaveProperty('totalTitles')
      expect(stats).toHaveProperty('indexedFields')
      expect(stats).toHaveProperty('recommendedIndexes')
      expect(Array.isArray(stats.indexedFields)).toBe(true)
      expect(Array.isArray(stats.recommendedIndexes)).toBe(true)
    })

    test('should include execution time in search results', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Performance Test Book'
      })

      const results = await searchTitles({
        query: 'Performance'
      })

      expect(results.searchMeta).toHaveProperty('executionTime')
      expect(typeof results.searchMeta.executionTime).toBe('number')
      expect(results.searchMeta.executionTime).toBeGreaterThan(0)
    })

    test('should track total matches in search meta', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestTitle({
          isbn: `978${i.toString().padStart(10, '0')}`,
          title: `Performance Test Book ${i}`
        })
      }

      const results = await searchTitles({
        query: 'Performance Test',
        pagination: { page: 1, limit: 2 }
      })

      expect(results.searchMeta.totalMatches).toBe(5)
      expect(results.titles).toHaveLength(2) // Limited by pagination
    })
  })

  describe('Combined Search and Filter Operations', () => {
    test('should combine search query with filters', async () => {
      const series = await createTestSeries({ name: 'Test Series' })

      await createTestTitle({
        isbn: '9781111111111',
        title: 'JavaScript Programming',
        format: 'HARDCOVER',
        seriesId: series.id,
        category: 'Programming'
      })

      await createTestTitle({
        isbn: '9782222222222',
        title: 'JavaScript Guide',
        format: 'PAPERBACK',
        seriesId: series.id,
        category: 'Programming'
      })

      await createTestTitle({
        isbn: '9783333333333',
        title: 'Python Programming',
        format: 'HARDCOVER',
        seriesId: series.id,
        category: 'Programming'
      })

      const results = await searchTitles({
        query: 'JavaScript',
        filters: {
          format: ['HARDCOVER'],
          seriesId: [series.id]
        }
      })

      expect(results.titles).toHaveLength(1)
      expect(results.titles[0].title).toBe('JavaScript Programming')
      expect(results.titles[0].format).toBe('HARDCOVER')
    })

    test('should return empty results when no matches found', async () => {
      await createTestTitle({
        isbn: '9781111111111',
        title: 'Test Book',
        format: 'HARDCOVER'
      })

      const results = await searchTitles({
        query: 'Nonexistent Book'
      })

      expect(results.titles).toHaveLength(0)
      expect(results.pagination.total).toBe(0)
      expect(results.searchMeta.totalMatches).toBe(0)
    })
  })
})