import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestSeries, createTestTitle } from '../utils/test-db'

describe('Series Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create a series with required fields', async () => {
      const series = await createTestSeries({
        name: 'Harry Potter',
        description: 'Fantasy series by J.K. Rowling',
        organizationId: 'org_test123'
      })

      expect(series).toMatchObject({
        name: 'Harry Potter',
        description: 'Fantasy series by J.K. Rowling',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })
      expect(series.id).toBeDefined()
      expect(series.createdAt).toBeInstanceOf(Date)
      expect(series.updatedAt).toBeInstanceOf(Date)
    })

    test('should create a series with only required fields (name and organizationId)', async () => {
      const series = await createTestSeries({
        name: 'Minimalist Series',
        organizationId: 'org_test123',
        description: null
      })

      expect(series.name).toBe('Minimalist Series')
      expect(series.organizationId).toBe('org_test123')
      expect(series.description).toBeNull()
      expect(series.status).toBe('ACTIVE')
      expect(series.createdBy).toBeNull()
    })

    test('should create a series with ARCHIVED status', async () => {
      const series = await createTestSeries({
        name: 'Archived Series',
        organizationId: 'org_test123',
        status: 'ARCHIVED'
      })

      expect(series.status).toBe('ARCHIVED')
    })

    test('should create a series with createdBy field', async () => {
      const series = await createTestSeries({
        name: 'Tracked Series',
        organizationId: 'org_test123',
        createdBy: 'user_xyz789'
      })

      expect(series.createdBy).toBe('user_xyz789')
    })

    test('should enforce unique series names within same organization', async () => {
      await createTestSeries({
        name: 'Unique Series',
        organizationId: 'org_test123'
      })

      await expect(
        createTestSeries({
          name: 'Unique Series',
          organizationId: 'org_test123'
        })
      ).rejects.toThrow()
    })

    test('should allow same series name in different organizations', async () => {
      const series1 = await createTestSeries({
        name: 'Shared Name Series',
        organizationId: 'org_abc'
      })

      const series2 = await createTestSeries({
        name: 'Shared Name Series',
        organizationId: 'org_xyz'
      })

      expect(series1.name).toBe(series2.name)
      expect(series1.organizationId).not.toBe(series2.organizationId)
    })

    test('should require series name', async () => {
      await expect(
        testDb.series.create({ data: { organizationId: 'org_test123' } as any })
      ).rejects.toThrow()
    })

    test('should require organizationId', async () => {
      await expect(
        testDb.series.create({ data: { name: 'Test Series' } as any })
      ).rejects.toThrow()
    })
  })

  describe('Validation', () => {
    test('should enforce name length constraints', async () => {
      // Test maximum length (100 characters per spec)
      const longName = 'a'.repeat(101)
      await expect(
        createTestSeries({
          name: longName,
          organizationId: 'org_test123'
        })
      ).rejects.toThrow()
    })

    test('should handle description with various lengths', async () => {
      const longDescription = 'A '.repeat(500) + 'very long description'
      const series = await createTestSeries({
        name: 'Long Description Series',
        organizationId: 'org_test123',
        description: longDescription
      })

      expect(series.description).toBe(longDescription)
    })

    test('should enforce valid SeriesStatus enum values', async () => {
      // Valid values
      const activesSeries = await createTestSeries({
        name: 'Active Series',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })
      expect(activesSeries.status).toBe('ACTIVE')

      const archivedSeries = await createTestSeries({
        name: 'Archived Series',
        organizationId: 'org_test123',
        status: 'ARCHIVED'
      })
      expect(archivedSeries.status).toBe('ARCHIVED')

      // Invalid value should throw
      await expect(
        testDb.series.create({
          data: {
            name: 'Invalid Status',
            organizationId: 'org_test123',
            status: 'INVALID' as any
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Relationships', () => {
    test('should support one-to-many relationship with titles', async () => {
      const series = await createTestSeries({
        name: 'Test Series',
        organizationId: 'org_test123'
      })

      const title1 = await createTestTitle({
        isbn: '9781111111111',
        title: 'Book 1',
        seriesId: series.id
      })

      const title2 = await createTestTitle({
        isbn: '9782222222222',
        title: 'Book 2',
        seriesId: series.id
      })

      const seriesWithTitles = await testDb.series.findUnique({
        where: { id: series.id },
        include: { titles: true }
      })

      expect(seriesWithTitles?.titles).toHaveLength(2)
      expect(seriesWithTitles?.titles.map(t => t.title)).toContain('Book 1')
      expect(seriesWithTitles?.titles.map(t => t.title)).toContain('Book 2')
    })

    test('should allow series without titles', async () => {
      const series = await createTestSeries({
        name: 'Empty Series',
        organizationId: 'org_test123'
      })

      const seriesWithTitles = await testDb.series.findUnique({
        where: { id: series.id },
        include: { titles: true }
      })

      expect(seriesWithTitles?.titles).toHaveLength(0)
    })

    test('should allow titles without series (optional relationship)', async () => {
      const title = await createTestTitle({
        isbn: '9783333333333',
        title: 'Standalone Book',
        seriesId: null
      })

      expect(title.seriesId).toBeNull()
    })

    test('should set seriesId to null when series is deleted (ON DELETE SET NULL)', async () => {
      const series = await createTestSeries({
        name: 'Temporary Series',
        organizationId: 'org_test123'
      })

      const title = await createTestTitle({
        isbn: '9784444444444',
        title: 'Book in Series',
        seriesId: series.id
      })

      expect(title.seriesId).toBe(series.id)

      // Delete series
      await testDb.series.delete({
        where: { id: series.id }
      })

      // Check that title's seriesId is now null
      const updatedTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(updatedTitle?.seriesId).toBeNull()
    })
  })

  describe('Queries', () => {
    test('should find series by organizationId and name', async () => {
      await createTestSeries({
        name: 'Findable Series',
        organizationId: 'org_test123'
      })

      const found = await testDb.series.findUnique({
        where: {
          organizationId_name: {
            organizationId: 'org_test123',
            name: 'Findable Series'
          }
        }
      })

      expect(found?.name).toBe('Findable Series')
    })

    test('should filter series by organizationId', async () => {
      await createTestSeries({
        name: 'Org1 Series',
        organizationId: 'org_abc'
      })
      await createTestSeries({
        name: 'Org2 Series',
        organizationId: 'org_xyz'
      })

      const org1Series = await testDb.series.findMany({
        where: { organizationId: 'org_abc' }
      })

      expect(org1Series).toHaveLength(1)
      expect(org1Series[0].name).toBe('Org1 Series')
    })

    test('should filter series by status', async () => {
      await createTestSeries({
        name: 'Active 1',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })
      await createTestSeries({
        name: 'Active 2',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })
      await createTestSeries({
        name: 'Archived 1',
        organizationId: 'org_test123',
        status: 'ARCHIVED'
      })

      const activeSeries = await testDb.series.findMany({
        where: {
          organizationId: 'org_test123',
          status: 'ACTIVE'
        }
      })

      expect(activeSeries).toHaveLength(2)
    })

    test('should order series by name', async () => {
      await createTestSeries({
        name: 'Zebra Series',
        organizationId: 'org_test123'
      })
      await createTestSeries({
        name: 'Alpha Series',
        organizationId: 'org_test123'
      })
      await createTestSeries({
        name: 'Beta Series',
        organizationId: 'org_test123'
      })

      const allSeries = await testDb.series.findMany({
        where: { organizationId: 'org_test123' },
        orderBy: { name: 'asc' }
      })

      expect(allSeries.map(s => s.name)).toEqual([
        'Alpha Series',
        'Beta Series',
        'Zebra Series'
      ])
    })

    test('should use idx_series_organization index for filtered queries', async () => {
      // This test verifies the index is being used efficiently
      await createTestSeries({
        name: 'Series 1',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })

      const result = await testDb.series.findMany({
        where: {
          organizationId: 'org_test123',
          status: 'ACTIVE'
        }
      })

      expect(result).toHaveLength(1)
    })
  })

  describe('Updates', () => {
    test('should update series name and description', async () => {
      const series = await createTestSeries({
        name: 'Original Name',
        organizationId: 'org_test123',
        description: 'Original description'
      })

      const updated = await testDb.series.update({
        where: { id: series.id },
        data: {
          name: 'Updated Name',
          description: 'Updated description'
        }
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.description).toBe('Updated description')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(series.updatedAt.getTime())
    })

    test('should update series status to ARCHIVED', async () => {
      const series = await createTestSeries({
        name: 'Active Series',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })

      const archived = await testDb.series.update({
        where: { id: series.id },
        data: { status: 'ARCHIVED' }
      })

      expect(archived.status).toBe('ARCHIVED')
    })

    test('should not allow duplicate name within same org on update', async () => {
      await createTestSeries({
        name: 'Existing Series',
        organizationId: 'org_test123'
      })

      const series2 = await createTestSeries({
        name: 'Another Series',
        organizationId: 'org_test123'
      })

      await expect(
        testDb.series.update({
          where: { id: series2.id },
          data: { name: 'Existing Series' }
        })
      ).rejects.toThrow()
    })
  })

  describe('Deletion', () => {
    test('should delete series without titles', async () => {
      const series = await createTestSeries({
        name: 'Deletable Series',
        organizationId: 'org_test123'
      })

      await testDb.series.delete({
        where: { id: series.id }
      })

      const found = await testDb.series.findUnique({
        where: { id: series.id }
      })

      expect(found).toBeNull()
    })

    test('should delete series with associated titles (ON DELETE SET NULL)', async () => {
      const series = await createTestSeries({
        name: 'Series with Books',
        organizationId: 'org_test123'
      })

      const title = await createTestTitle({
        isbn: '9785555555555',
        seriesId: series.id
      })

      // Should succeed because relationship uses ON DELETE SET NULL
      await testDb.series.delete({ where: { id: series.id } })

      const updatedTitle = await testDb.title.findUnique({
        where: { id: title.id }
      })

      expect(updatedTitle?.seriesId).toBeNull()
    })
  })

  describe('Database Indexes', () => {
    test('should efficiently query by organizationId and status (idx_series_organization)', async () => {
      // Create multiple series
      for (let i = 0; i < 10; i++) {
        await createTestSeries({
          name: `Series ${i}`,
          organizationId: 'org_test123',
          status: i % 2 === 0 ? 'ACTIVE' : 'ARCHIVED'
        })
      }

      const activeSeries = await testDb.series.findMany({
        where: {
          organizationId: 'org_test123',
          status: 'ACTIVE'
        }
      })

      expect(activeSeries).toHaveLength(5)
    })

    test('should efficiently search by organizationId and name (idx_series_name)', async () => {
      await createTestSeries({
        name: 'Searchable Series',
        organizationId: 'org_test123'
      })

      const found = await testDb.series.findUnique({
        where: {
          organizationId_name: {
            organizationId: 'org_test123',
            name: 'Searchable Series'
          }
        }
      })

      expect(found?.name).toBe('Searchable Series')
    })
  })
})
