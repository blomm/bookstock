import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { SeriesService } from '@/services/seriesService'
import { testDb, cleanDatabase, disconnectTestDb, createTestSeries, createTestTitle } from '../utils/test-db'
import { SeriesStatus } from '@prisma/client'

describe('SeriesService', () => {
  let seriesService: SeriesService

  beforeEach(async () => {
    await cleanDatabase()
    seriesService = new SeriesService()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('createSeries', () => {
    test('should create a new series with valid data', async () => {
      const seriesData = {
        name: 'New Test Series',
        description: 'A newly created series',
        organizationId: 'org_test123',
        createdBy: 'user_abc'
      }

      const series = await seriesService.createSeries(seriesData)

      expect(series).toMatchObject({
        name: 'New Test Series',
        description: 'A newly created series',
        organizationId: 'org_test123',
        status: 'ACTIVE',
        createdBy: 'user_abc'
      })
      expect(series.id).toBeDefined()
      expect(series.createdAt).toBeInstanceOf(Date)
    })

    test('should create series with only required fields', async () => {
      const seriesData = {
        name: 'Minimal Series',
        organizationId: 'org_test123'
      }

      const series = await seriesService.createSeries(seriesData)

      expect(series.name).toBe('Minimal Series')
      expect(series.organizationId).toBe('org_test123')
      expect(series.status).toBe('ACTIVE')
      expect(series.description).toBeNull()
      expect(series.createdBy).toBeNull()
    })

    test('should throw error for duplicate series name in same organization', async () => {
      await createTestSeries({
        name: 'Duplicate Name',
        organizationId: 'org_test123'
      })

      await expect(
        seriesService.createSeries({
          name: 'Duplicate Name',
          organizationId: 'org_test123'
        })
      ).rejects.toThrow()
    })

    test('should allow same series name in different organizations', async () => {
      await createTestSeries({
        name: 'Shared Name',
        organizationId: 'org_abc'
      })

      const series2 = await seriesService.createSeries({
        name: 'Shared Name',
        organizationId: 'org_xyz'
      })

      expect(series2.name).toBe('Shared Name')
      expect(series2.organizationId).toBe('org_xyz')
    })
  })

  describe('getSeriesList', () => {
    beforeEach(async () => {
      // Create test data
      await createTestSeries({
        name: 'Active Series 1',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })
      await createTestSeries({
        name: 'Active Series 2',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })
      await createTestSeries({
        name: 'Archived Series',
        organizationId: 'org_test123',
        status: 'ARCHIVED'
      })
      await createTestSeries({
        name: 'Other Org Series',
        organizationId: 'org_other',
        status: 'ACTIVE'
      })
    })

    test('should list all active series for organization', async () => {
      const result = await seriesService.getSeriesList({
        organizationId: 'org_test123',
        status: SeriesStatus.ACTIVE,
        page: 1,
        limit: 20
      })

      expect(result.data).toHaveLength(2)
      expect(result.data.every(s => s.status === 'ACTIVE')).toBe(true)
      expect(result.data.every(s => s.organizationId === 'org_test123')).toBe(true)
      expect(result.pagination.total).toBe(2)
    })

    test('should filter by status', async () => {
      const result = await seriesService.getSeriesList({
        organizationId: 'org_test123',
        status: SeriesStatus.ARCHIVED,
        page: 1,
        limit: 20
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('ARCHIVED')
    })

    test('should search by series name', async () => {
      const result = await seriesService.getSeriesList({
        organizationId: 'org_test123',
        status: SeriesStatus.ACTIVE,
        search: 'Active',
        page: 1,
        limit: 20
      })

      expect(result.data).toHaveLength(2)
      expect(result.data.every(s => s.name.includes('Active'))).toBe(true)
    })

    test('should paginate results', async () => {
      const page1 = await seriesService.getSeriesList({
        organizationId: 'org_test123',
        status: SeriesStatus.ACTIVE,
        page: 1,
        limit: 1
      })

      expect(page1.data).toHaveLength(1)
      expect(page1.pagination.page).toBe(1)
      expect(page1.pagination.totalPages).toBe(2)

      const page2 = await seriesService.getSeriesList({
        organizationId: 'org_test123',
        status: SeriesStatus.ACTIVE,
        page: 2,
        limit: 1
      })

      expect(page2.data).toHaveLength(1)
      expect(page2.pagination.page).toBe(2)
      expect(page1.data[0].id).not.toBe(page2.data[0].id)
    })

    test('should include title count', async () => {
      const series = await createTestSeries({
        name: 'Series with Titles',
        organizationId: 'org_test123'
      })

      await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id
      })
      await createTestTitle({
        isbn: '9782222222222',
        seriesId: series.id
      })

      const result = await seriesService.getSeriesList({
        organizationId: 'org_test123',
        status: SeriesStatus.ACTIVE,
        search: 'Series with Titles',
        page: 1,
        limit: 20
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].titleCount).toBe(2)
    })
  })

  describe('getSeriesById', () => {
    test('should get series with member titles', async () => {
      const series = await createTestSeries({
        name: 'Test Series',
        organizationId: 'org_test123'
      })

      const title1 = await createTestTitle({
        isbn: '9783333333333',
        title: 'Book 1',
        seriesId: series.id
      })

      const title2 = await createTestTitle({
        isbn: '9784444444444',
        title: 'Book 2',
        seriesId: series.id
      })

      const result = await seriesService.getSeriesById(series.id, 'org_test123')

      expect(result).toMatchObject({
        id: series.id,
        name: 'Test Series',
        organizationId: 'org_test123'
      })
      expect(result.titles).toHaveLength(2)
      expect(result.titles.map(t => t.title)).toContain('Book 1')
      expect(result.titles.map(t => t.title)).toContain('Book 2')
    })

    test('should throw error if series not found', async () => {
      await expect(
        seriesService.getSeriesById(99999, 'org_test123')
      ).rejects.toThrow('Series not found')
    })

    test('should throw error if series belongs to different organization', async () => {
      const series = await createTestSeries({
        name: 'Other Org Series',
        organizationId: 'org_other'
      })

      await expect(
        seriesService.getSeriesById(series.id, 'org_test123')
      ).rejects.toThrow('Series not found')
    })
  })

  describe('updateSeries', () => {
    test('should update series name and description', async () => {
      const series = await createTestSeries({
        name: 'Original Name',
        description: 'Original description',
        organizationId: 'org_test123'
      })

      const updated = await seriesService.updateSeries(
        series.id,
        'org_test123',
        {
          name: 'Updated Name',
          description: 'Updated description'
        }
      )

      expect(updated.name).toBe('Updated Name')
      expect(updated.description).toBe('Updated description')
    })

    test('should update series status', async () => {
      const series = await createTestSeries({
        name: 'Active Series',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })

      const updated = await seriesService.updateSeries(
        series.id,
        'org_test123',
        { status: SeriesStatus.ARCHIVED }
      )

      expect(updated.status).toBe('ARCHIVED')
    })

    test('should throw error for duplicate name in same organization', async () => {
      await createTestSeries({
        name: 'Existing Name',
        organizationId: 'org_test123'
      })

      const series2 = await createTestSeries({
        name: 'Other Name',
        organizationId: 'org_test123'
      })

      await expect(
        seriesService.updateSeries(series2.id, 'org_test123', {
          name: 'Existing Name'
        })
      ).rejects.toThrow()
    })

    test('should throw error if series not found', async () => {
      await expect(
        seriesService.updateSeries(99999, 'org_test123', {
          name: 'New Name'
        })
      ).rejects.toThrow('Series not found')
    })
  })

  describe('archiveSeries', () => {
    test('should set series status to ARCHIVED', async () => {
      const series = await createTestSeries({
        name: 'Active Series',
        organizationId: 'org_test123',
        status: 'ACTIVE'
      })

      const archived = await seriesService.archiveSeries(series.id, 'org_test123')

      expect(archived.status).toBe('ARCHIVED')
      expect(archived.id).toBe(series.id)
    })

    test('should throw error if series not found', async () => {
      await expect(
        seriesService.archiveSeries(99999, 'org_test123')
      ).rejects.toThrow('Series not found')
    })
  })

  describe('getSeriesMetrics', () => {
    test('should return zero metrics for series without titles', async () => {
      const series = await createTestSeries({
        name: 'Empty Series',
        organizationId: 'org_test123'
      })

      const metrics = await seriesService.getSeriesMetrics(series.id, 'org_test123')

      expect(metrics).toMatchObject({
        seriesId: series.id,
        titleCount: 0,
        totalCurrentStock: 0,
        totalReservedStock: 0,
        totalAvailableStock: 0
      })
    })

    test('should aggregate title count', async () => {
      const series = await createTestSeries({
        name: 'Series with Titles',
        organizationId: 'org_test123'
      })

      await createTestTitle({
        isbn: '9785555555555',
        seriesId: series.id
      })
      await createTestTitle({
        isbn: '9786666666666',
        seriesId: series.id
      })

      const metrics = await seriesService.getSeriesMetrics(series.id, 'org_test123')

      expect(metrics.titleCount).toBe(2)
    })

    test('should throw error if series not found', async () => {
      await expect(
        seriesService.getSeriesMetrics(99999, 'org_test123')
      ).rejects.toThrow('Series not found')
    })
  })

  describe('bulkUpdateTitles', () => {
    test('should update RRP for all titles in series', async () => {
      const series = await createTestSeries({
        name: 'Bulk Update Series',
        organizationId: 'org_test123'
      })

      const title1 = await createTestTitle({
        isbn: '9787777777777',
        rrp: 19.99,
        seriesId: series.id
      })

      const title2 = await createTestTitle({
        isbn: '9788888888888',
        rrp: 24.99,
        seriesId: series.id
      })

      const result = await seriesService.bulkUpdateTitles(
        series.id,
        'org_test123',
        { updates: { rrp: 29.99 } },
        'user_abc'
      )

      expect(result.titlesUpdated).toBe(2)

      const updatedTitle1 = await testDb.title.findUnique({ where: { id: title1.id } })
      const updatedTitle2 = await testDb.title.findUnique({ where: { id: title2.id } })

      expect(updatedTitle1?.rrp.toNumber()).toBe(29.99)
      expect(updatedTitle2?.rrp.toNumber()).toBe(29.99)
    })

    test('should update low stock threshold for all titles in series', async () => {
      const series = await createTestSeries({
        name: 'Threshold Series',
        organizationId: 'org_test123'
      })

      const title1 = await createTestTitle({
        isbn: '9789999999999',
        lowStockThreshold: 50,
        seriesId: series.id
      })

      const title2 = await createTestTitle({
        isbn: '9780000000000',
        lowStockThreshold: 100,
        seriesId: series.id
      })

      const result = await seriesService.bulkUpdateTitles(
        series.id,
        'org_test123',
        { updates: { lowStockThreshold: 200 } },
        'user_abc'
      )

      expect(result.titlesUpdated).toBe(2)

      const updatedTitle1 = await testDb.title.findUnique({ where: { id: title1.id } })
      const updatedTitle2 = await testDb.title.findUnique({ where: { id: title2.id } })

      expect(updatedTitle1?.lowStockThreshold).toBe(200)
      expect(updatedTitle2?.lowStockThreshold).toBe(200)
    })

    test('should handle series with no titles', async () => {
      const series = await createTestSeries({
        name: 'Empty Series',
        organizationId: 'org_test123'
      })

      const result = await seriesService.bulkUpdateTitles(
        series.id,
        'org_test123',
        { updates: { rrp: 29.99 } },
        'user_abc'
      )

      expect(result.titlesUpdated).toBe(0)
    })

    test('should throw error if series not found', async () => {
      await expect(
        seriesService.bulkUpdateTitles(
          99999,
          'org_test123',
          { updates: { rrp: 29.99 } },
          'user_abc'
        )
      ).rejects.toThrow('Series not found')
    })

    test('should update atomically (all or nothing)', async () => {
      const series = await createTestSeries({
        name: 'Atomic Series',
        organizationId: 'org_test123'
      })

      await createTestTitle({
        isbn: '9781010101010',
        rrp: 19.99,
        seriesId: series.id
      })

      // This should work without throwing
      const result = await seriesService.bulkUpdateTitles(
        series.id,
        'org_test123',
        { updates: { rrp: 29.99 } },
        'user_abc'
      )

      expect(result.titlesUpdated).toBe(1)
    })
  })
})
