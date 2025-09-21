import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestSeries } from '../utils/test-db'
import {
  createImportJob,
  getImportJob,
  setDbClient,
  validateTitleData,
  TitleImportData,
  ImportOptions,
  ImportResult
} from '@/services/bulkImportService'

// Helper function to wait for import job completion
async function waitForJobCompletion(jobId: string, maxWaitTime = 30000): Promise<ImportResult> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const job = getImportJob(jobId)
    if (!job) throw new Error('Job not found')

    if (job.status === 'completed' || job.status === 'failed') {
      return {
        success: job.status === 'completed',
        created: job.created,
        errors: job.errors,
        summary: {
          total: job.summary.total,
          successful: job.summary.successful,
          failed: job.summary.failed,
          duration: job.summary.duration
        }
      }
    }

    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('Job did not complete within timeout')
}

// Bulk import using actual service
async function simulateBulkImport(titleData: TitleImportData[], options: ImportOptions = {}): Promise<ImportResult> {
  const jobId = await createImportJob(titleData, options)
  return await waitForJobCompletion(jobId)
}

// Use the service validation function
function validateTitleDataLocal(data: any): string[] {
  const errors = validateTitleData(data, 1) // Row 1 for testing
  return errors.map(error => error.error)
}

describe('Title Bulk Import', () => {
  beforeEach(async () => {
    setDbClient(testDb)
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Successful Bulk Import', () => {
    test('should import multiple valid titles atomically', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Bulk Book 1',
          author: 'Author 1',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          title: 'Bulk Book 2',
          author: 'Author 2',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9783333333333',
          title: 'Bulk Book 3',
          author: 'Author 3',
          format: 'DIGITAL',
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      const result = await simulateBulkImport(titleData, { useTransaction: true, validateFirst: false })

      expect(result.success).toBe(true)
      expect(result.created).toHaveLength(3)
      expect(result.summary?.successful).toBe(3)
      expect(result.summary?.failed).toBe(0)

      // Verify in database
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(3)
    })

    test('should import titles with complete metadata', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Complete Metadata Book 1',
          author: 'Complete Author 1',
          format: 'PAPERBACK',
          rrp: 24.99,
          unitCost: 6.25,
          pageCount: 320,
          publicationDate: new Date('2024-01-15'),
          publisher: 'Complete Publishers',
          category: 'Fiction',
          subcategory: 'Science Fiction',
          dimensions: '198x129x20',
          weight: 350,
          bindingType: 'Perfect bound',
          coverFinish: 'Gloss',
          tradeDiscount: 40.0,
          royaltyRate: 12.5,
          royaltyThreshold: 1500,
          printRunSize: 2500,
          reprintThreshold: 500,
          description: 'A complete science fiction novel',
          keywords: 'science fiction, space, adventure',
          language: 'en-GB',
          territoryRights: 'UK, Ireland'
        },
        {
          isbn: '9782222222222',
          title: 'Complete Metadata Book 2',
          author: 'Complete Author 2',
          format: 'HARDCOVER',
          rrp: 34.99,
          unitCost: 8.75,
          pageCount: 450,
          publicationDate: new Date('2024-02-20'),
          publisher: 'Complete Publishers',
          category: 'Non-fiction',
          subcategory: 'Technology',
          dimensions: '234x156x32',
          weight: 720,
          bindingType: 'Case bound',
          coverFinish: 'Matte',
          tradeDiscount: 45.0,
          royaltyRate: 15.0,
          royaltyThreshold: 2000,
          printRunSize: 3000,
          reprintThreshold: 600,
          description: 'A comprehensive technology guide',
          keywords: 'technology, programming, guide',
          language: 'en-US',
          territoryRights: 'World'
        }
      ]

      const result = await simulateBulkImport(titleData, { useTransaction: true })

      expect(result.success).toBe(true)
      expect(result.created).toHaveLength(2)

      // Verify complete metadata was stored
      const titles = await testDb.title.findMany({
        orderBy: { isbn: 'asc' }
      })

      expect(titles[0].pageCount).toBe(320)
      expect(titles[0].publisher).toBe('Complete Publishers')
      expect(titles[0].royaltyRate?.toNumber()).toBe(12.5)
      expect(titles[1].pageCount).toBe(450)
      expect(titles[1].territoryRights).toBe('World')
    })

    test('should import titles with series relationships', async () => {
      const series1 = await createTestSeries({ name: 'Fantasy Series' })
      const series2 = await createTestSeries({ name: 'Tech Series' })

      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Fantasy Book 1',
          author: 'Fantasy Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series1.id
        },
        {
          isbn: '9782222222222',
          title: 'Fantasy Book 2',
          author: 'Fantasy Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series1.id
        },
        {
          isbn: '9783333333333',
          title: 'Tech Guide',
          author: 'Tech Author',
          format: 'HARDCOVER',
          rrp: 34.99,
          unitCost: 8.75,
          seriesId: series2.id
        }
      ]

      const result = await simulateBulkImport(titleData, { useTransaction: true })

      expect(result.success).toBe(true)
      expect(result.created).toHaveLength(3)

      // Verify series relationships
      const series1WithTitles = await testDb.series.findUnique({
        where: { id: series1.id },
        include: { titles: true }
      })
      expect(series1WithTitles?.titles).toHaveLength(2)

      const series2WithTitles = await testDb.series.findUnique({
        where: { id: series2.id },
        include: { titles: true }
      })
      expect(series2WithTitles?.titles).toHaveLength(1)
    })
  })

  describe('Validation and Error Handling', () => {
    test('should validate required fields before import', () => {
      const invalidData = [
        {
          // Missing ISBN
          title: 'Missing ISBN Book',
          author: 'Author 1',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          // Missing title
          author: 'Author 2',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9783333333333',
          title: 'Valid Title',
          // Missing author
          format: 'DIGITAL',
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      invalidData.forEach((data, index) => {
        const errors = validateTitleDataLocal(data)
        expect(errors.length).toBeGreaterThan(0)
      })
    })

    test('should rollback entire transaction on validation error', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Valid Book 1',
          author: 'Author 1',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          title: 'Valid Book 2',
          author: 'Author 2',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9781111111111', // Duplicate ISBN
          title: 'Duplicate Book',
          author: 'Author 3',
          format: 'DIGITAL',
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      const result = await simulateBulkImport(titleData, { useTransaction: true })

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)

      // Verify no titles were created
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(0)
    })

    test('should handle partial import with error reporting', async () => {
      // Create existing title to cause conflict
      await testDb.title.create({
        data: {
          isbn: '9781111111111',
          title: 'Existing Book',
          author: 'Existing Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        }
      })

      const titleData = [
        {
          isbn: '9782222222222',
          title: 'New Valid Book',
          author: 'New Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9781111111111', // Duplicate
          title: 'Duplicate Book',
          author: 'Duplicate Author',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9783333333333',
          title: 'Another Valid Book',
          author: 'Another Author',
          format: 'DIGITAL',
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      const result = await simulateBulkImport(titleData, {
        continueOnError: true
      })

      expect(result.success).toBe(false)
      expect(result.created).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0].isbn).toBe('9781111111111')

      // Verify partial import succeeded
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(3) // 1 existing + 2 new
    })

    test('should validate ISBN format during import', async () => {
      const titleData = [
        {
          isbn: '978123456789', // Too short
          title: 'Invalid ISBN Book 1',
          author: 'Author 1',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '97812345678901', // Too long
          title: 'Invalid ISBN Book 2',
          author: 'Author 2',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: 'abcd1234567890', // Contains letters
          title: 'Invalid ISBN Book 3',
          author: 'Author 3',
          format: 'DIGITAL',
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      titleData.forEach(data => {
        const errors = validateTitleDataLocal(data)
        expect(errors).toContain('ISBN must be 10 or 13 digits')
      })
    })

    test('should validate format enum values', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Invalid Format Book',
          author: 'Author 1',
          format: 'INVALID_FORMAT',
          rrp: 19.99,
          unitCost: 5.50
        }
      ]

      const errors = validateTitleDataLocal(titleData[0])
      expect(errors).toContain('Format must be one of: HARDCOVER, PAPERBACK, DIGITAL, AUDIOBOOK')
    })

    test('should validate numeric fields', async () => {
      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Invalid Numbers Book',
          author: 'Author 1',
          format: 'PAPERBACK',
          rrp: -19.99, // Negative price
          unitCost: 'invalid' // Non-numeric
        }
      ]

      const errors = validateTitleDataLocal(titleData[0])
      expect(errors).toContain('RRP must be a positive number')
      expect(errors).toContain('Unit cost must be a positive number')
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large bulk import efficiently', async () => {
      const batchSize = 100
      const titleData = Array.from({ length: batchSize }, (_, i) => ({
        isbn: `978${i.toString().padStart(10, '0')}`,
        title: `Performance Book ${i + 1}`,
        author: `Performance Author ${i + 1}`,
        format: 'PAPERBACK' as const,
        rrp: 19.99,
        unitCost: 5.50
      }))

      const result = await simulateBulkImport(titleData, { useTransaction: true })

      expect(result.success).toBe(true)
      expect(result.created).toHaveLength(batchSize)
      expect(result.summary?.duration).toBeLessThan(10000) // Under 10 seconds

      // Verify all were created
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(batchSize)
    })

    test('should handle mixed complexity import efficiently', async () => {
      const titleData = [
        // Simple title
        {
          isbn: '9781111111111',
          title: 'Simple Book',
          author: 'Simple Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        // Complex title with all metadata
        {
          isbn: '9782222222222',
          title: 'Complex Book',
          author: 'Complex Author',
          format: 'HARDCOVER',
          rrp: 34.99,
          unitCost: 8.75,
          pageCount: 456,
          publicationDate: new Date('2024-03-15'),
          publisher: 'Complex Publishers',
          category: 'Technology',
          subcategory: 'Programming',
          dimensions: '234x156x28',
          weight: 650,
          bindingType: 'Perfect bound',
          coverFinish: 'Matte',
          tradeDiscount: 45.0,
          royaltyRate: 12.5,
          royaltyThreshold: 2000,
          printRunSize: 3000,
          reprintThreshold: 600,
          description: 'A complex technology book',
          keywords: 'technology, programming, complex',
          language: 'en-GB',
          territoryRights: 'UK, Ireland'
        }
      ]

      const result = await simulateBulkImport(titleData, { useTransaction: true })

      expect(result.success).toBe(true)
      expect(result.created).toHaveLength(2)

      // Verify both simple and complex data were stored correctly
      const titles = await testDb.title.findMany({ orderBy: { isbn: 'asc' } })
      expect(titles[0].pageCount).toBeNull() // Simple book
      expect(titles[1].pageCount).toBe(456) // Complex book
    })

    test('should process import batches sequentially', async () => {
      const batch1 = Array.from({ length: 25 }, (_, i) => ({
        isbn: `9781${i.toString().padStart(9, '0')}`,
        title: `Batch 1 Book ${i + 1}`,
        author: `Batch 1 Author ${i + 1}`,
        format: 'PAPERBACK' as const,
        rrp: 19.99,
        unitCost: 5.50
      }))

      const batch2 = Array.from({ length: 25 }, (_, i) => ({
        isbn: `9782${i.toString().padStart(9, '0')}`,
        title: `Batch 2 Book ${i + 1}`,
        author: `Batch 2 Author ${i + 1}`,
        format: 'HARDCOVER' as const,
        rrp: 29.99,
        unitCost: 8.75
      }))

      // Process batches sequentially
      const result1 = await simulateBulkImport(batch1, { useTransaction: true })
      const result2 = await simulateBulkImport(batch2, { useTransaction: true })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.created).toHaveLength(25)
      expect(result2.created).toHaveLength(25)

      // Verify total count
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(50)
    })
  })

  describe('Import Progress and Reporting', () => {
    test('should track import progress accurately', async () => {
      const titleData = Array.from({ length: 10 }, (_, i) => ({
        isbn: `978${i.toString().padStart(10, '0')}`,
        title: `Progress Book ${i + 1}`,
        author: `Progress Author ${i + 1}`,
        format: 'PAPERBACK' as const,
        rrp: 19.99,
        unitCost: 5.50
      }))

      const result = await simulateBulkImport(titleData, { useTransaction: true })

      expect(result.summary).toBeDefined()
      expect(result.summary?.total).toBe(10)
      expect(result.summary?.successful).toBe(10)
      expect(result.summary?.failed).toBe(0)
      expect(result.summary?.duration).toBeGreaterThan(0)
    })

    test('should provide detailed error reporting', async () => {
      // Create existing title
      await testDb.title.create({
        data: {
          isbn: '9783333333333',
          title: 'Existing Book',
          author: 'Existing Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        }
      })

      const titleData = [
        {
          isbn: '9781111111111',
          title: 'Valid Book 1',
          author: 'Author 1',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        {
          isbn: '9782222222222',
          title: 'Valid Book 2',
          author: 'Author 2',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        },
        {
          isbn: '9783333333333', // Duplicate
          title: 'Duplicate Book',
          author: 'Duplicate Author',
          format: 'DIGITAL',
          rrp: 14.99,
          unitCost: 2.00
        }
      ]

      const result = await simulateBulkImport(titleData, { continueOnError: true })

      expect(result.errors).toHaveLength(1)
      expect(result.errors![0].row).toBe(3)
      expect(result.errors![0].isbn).toBe('9783333333333')
      expect(result.errors![0].title).toBe('Duplicate Book')
      expect(result.errors![0].error).toContain('Unique constraint')

      expect(result.summary?.total).toBe(3)
      expect(result.summary?.successful).toBe(2)
      expect(result.summary?.failed).toBe(1)
    })

    test('should handle import with mixed success and failure scenarios', async () => {
      const titleData = [
        // Valid title
        {
          isbn: '9781111111111',
          title: 'Valid Book',
          author: 'Valid Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50
        },
        // Invalid ISBN format
        {
          isbn: '978111111111', // Too short
          title: 'Invalid ISBN Book',
          author: 'Invalid Author',
          format: 'HARDCOVER',
          rrp: 29.99,
          unitCost: 8.75
        }
      ]

      // Pre-validate to catch format errors
      const validationErrors = titleData
        .map((data, index) => ({
          row: index + 1,
          data,
          errors: validateTitleDataLocal(data)
        }))
        .filter(item => item.errors.length > 0)

      expect(validationErrors).toHaveLength(1)
      expect(validationErrors[0].errors).toContain('ISBN must be 10 or 13 digits')

      // Only import valid data
      const validData = titleData.filter((_, index) =>
        !validationErrors.find(error => error.row === index + 1)
      )

      const result = await simulateBulkImport(validData, { useTransaction: true })

      expect(result.success).toBe(true)
      expect(result.created).toHaveLength(1)
    })
  })
})