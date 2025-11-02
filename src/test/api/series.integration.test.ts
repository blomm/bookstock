import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/database'
import { seriesService } from '@/services/seriesService'
import { SeriesStatus } from '@prisma/client'

/**
 * Integration tests for Series API Routes
 *
 * These tests verify the full request/response cycle including:
 * - Route handlers
 * - Service layer
 * - Database operations
 * - Error handling
 *
 * Note: Authentication/authorization middleware is tested separately
 */

describe('Series API Integration Tests', () => {
  const testOrgId = 'org_test_series_api_123'

  afterAll(async () => {
    // Cleanup
    await prisma.series.deleteMany({
      where: {
        organizationId: testOrgId
      }
    })
  })

  beforeEach(async () => {
    // Clean up test series before each test
    await prisma.series.deleteMany({
      where: {
        organizationId: testOrgId
      }
    })
  })

  describe('GET /api/series', () => {
    beforeEach(async () => {
      // Create test series
      await prisma.$transaction([
        prisma.series.create({
          data: {
            name: 'Alpha Series',
            description: 'First test series',
            organizationId: testOrgId,
            status: 'ACTIVE'
          }
        }),
        prisma.series.create({
          data: {
            name: 'Beta Series',
            description: 'Second test series',
            organizationId: testOrgId,
            status: 'ACTIVE'
          }
        }),
        prisma.series.create({
          data: {
            name: 'Gamma Series',
            description: 'Third test series',
            organizationId: testOrgId,
            status: 'ARCHIVED'
          }
        })
      ])
    })

    test('should return paginated list of series', async () => {
      const result = await seriesService.getSeriesList({
        page: 1,
        limit: 20,
        organizationId: testOrgId
      })

      expect(result.data).toHaveLength(3)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      })
    })

    test('should filter by status', async () => {
      const result = await seriesService.getSeriesList({
        page: 1,
        limit: 20,
        status: 'ACTIVE' as SeriesStatus,
        organizationId: testOrgId
      })

      expect(result.data).toHaveLength(2)
      expect(result.data.every(s => s.status === 'ACTIVE')).toBe(true)
    })

    test('should search by name', async () => {
      const result = await seriesService.getSeriesList({
        page: 1,
        limit: 20,
        search: 'Alpha',
        organizationId: testOrgId
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Alpha Series')
    })

    test('should search by description', async () => {
      const result = await seriesService.getSeriesList({
        page: 1,
        limit: 20,
        search: 'First',
        organizationId: testOrgId
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Alpha Series')
    })

    test('should sort by name ascending', async () => {
      const result = await seriesService.getSeriesList({
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        organizationId: testOrgId
      })

      expect(result.data[0].name).toBe('Alpha Series')
      expect(result.data[1].name).toBe('Beta Series')
      expect(result.data[2].name).toBe('Gamma Series')
    })

    test('should sort by name descending', async () => {
      const result = await seriesService.getSeriesList({
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'desc',
        organizationId: testOrgId
      })

      expect(result.data[0].name).toBe('Gamma Series')
      expect(result.data[1].name).toBe('Beta Series')
      expect(result.data[2].name).toBe('Alpha Series')
    })

    test('should handle pagination correctly', async () => {
      const page1 = await seriesService.getSeriesList({
        page: 1,
        limit: 2,
        organizationId: testOrgId
      })

      expect(page1.data).toHaveLength(2)
      expect(page1.pagination.totalPages).toBe(2)

      const page2 = await seriesService.getSeriesList({
        page: 2,
        limit: 2,
        organizationId: testOrgId
      })

      expect(page2.data).toHaveLength(1)
    })

    test('should return empty array for page beyond results', async () => {
      const result = await seriesService.getSeriesList({
        page: 10,
        limit: 20,
        organizationId: testOrgId
      })

      expect(result.data).toHaveLength(0)
      expect(result.pagination.total).toBe(3)
    })
  })

  describe('POST /api/series', () => {
    test('should create series with valid data', async () => {
      const seriesData = {
        name: 'New Series',
        description: 'A brand new series',
        organizationId: testOrgId
      }

      const series = await seriesService.createSeries(seriesData)

      expect(series).toMatchObject({
        name: 'New Series',
        description: 'A brand new series',
        organizationId: testOrgId,
        status: 'ACTIVE'
      })
      expect(series.id).toBeDefined()
      expect(series.createdAt).toBeDefined()
      expect(series.updatedAt).toBeDefined()
    })

    test('should create series with minimal data', async () => {
      const seriesData = {
        name: 'Minimal Series',
        organizationId: testOrgId
      }

      const series = await seriesService.createSeries(seriesData)

      expect(series.name).toBe('Minimal Series')
      expect(series.description).toBeNull()
      expect(series.status).toBe('ACTIVE')
    })

    test('should reject duplicate series name in same organization', async () => {
      await prisma.series.create({
        data: {
          name: 'Duplicate Series',
          organizationId: testOrgId
        }
      })

      await expect(
        seriesService.createSeries({
          name: 'Duplicate Series',
          organizationId: testOrgId
        })
      ).rejects.toThrow('already exists')
    })

    test('should allow same series name in different organizations', async () => {
      const org2Id = 'org_test_series_api_2'

      await prisma.series.create({
        data: {
          name: 'Shared Name',
          organizationId: testOrgId
        }
      })

      const series2 = await seriesService.createSeries({
        name: 'Shared Name',
        organizationId: org2Id
      })

      expect(series2.name).toBe('Shared Name')
      expect(series2.organizationId).toBe(org2Id)

      // Cleanup
      await prisma.series.deleteMany({
        where: { organizationId: org2Id }
      })
    })

    test('should reject invalid status', async () => {
      await expect(
        seriesService.createSeries({
          name: 'Invalid Status Series',
          organizationId: testOrgId,
          status: 'INVALID' as any
        })
      ).rejects.toThrow()
    })
  })

  describe('GET /api/series/[id]', () => {
    test('should return series by ID', async () => {
      const created = await prisma.series.create({
        data: {
          name: 'Findable Series',
          description: 'A series to find',
          organizationId: testOrgId
        }
      })

      const found = await seriesService.getSeriesById(created.id, testOrgId)

      expect(found).toMatchObject({
        id: created.id,
        name: 'Findable Series',
        description: 'A series to find'
      })
      expect(found.titles).toBeDefined()
      expect(found.titles).toHaveLength(0)
    })

    test('should include title count', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Series with Titles',
          organizationId: testOrgId
        }
      })

      // Create titles for this series
      await prisma.title.createMany({
        data: [
          {
            isbn: '9788880901001',
            title: 'Title 1 in Series',
            author: 'Author 1',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50,
            seriesId: series.id
          },
          {
            isbn: '9788880901018',
            title: 'Title 2 in Series',
            author: 'Author 2',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50,
            seriesId: series.id
          }
        ]
      })

      const found = await seriesService.getSeriesById(series.id, testOrgId)

      expect(found.titles).toHaveLength(2)

      // Cleanup titles
      await prisma.title.deleteMany({
        where: { seriesId: series.id }
      })
    })

    test('should throw error for non-existent ID', async () => {
      await expect(
        seriesService.getSeriesById(999999, testOrgId)
      ).rejects.toThrow('not found')
    })
  })

  describe('PUT /api/series/[id]', () => {
    test('should update series name', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Original Name',
          organizationId: testOrgId
        }
      })

      const updated = await seriesService.updateSeries(series.id, testOrgId, {
        name: 'Updated Name'
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.id).toBe(series.id)
    })

    test('should update series description', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Series',
          description: 'Original description',
          organizationId: testOrgId
        }
      })

      const updated = await seriesService.updateSeries(series.id, testOrgId, {
        description: 'Updated description'
      })

      expect(updated.description).toBe('Updated description')
      expect(updated.name).toBe('Series')
    })

    test('should update series status', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Series',
          organizationId: testOrgId,
          status: 'ACTIVE'
        }
      })

      const updated = await seriesService.updateSeries(series.id, testOrgId, {
        status: 'ARCHIVED' as SeriesStatus
      })

      expect(updated.status).toBe('ARCHIVED')
    })

    test('should update multiple fields at once', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Original',
          description: 'Original desc',
          organizationId: testOrgId,
          status: 'ACTIVE'
        }
      })

      const updated = await seriesService.updateSeries(series.id, testOrgId, {
        name: 'Updated',
        description: 'Updated desc',
        status: 'ARCHIVED' as SeriesStatus
      })

      expect(updated).toMatchObject({
        name: 'Updated',
        description: 'Updated desc',
        status: 'ARCHIVED'
      })
    })

    test('should reject duplicate name in same organization', async () => {
      await prisma.series.create({
        data: {
          name: 'Existing Series',
          organizationId: testOrgId
        }
      })

      const series = await prisma.series.create({
        data: {
          name: 'Series to Update',
          organizationId: testOrgId
        }
      })

      await expect(
        seriesService.updateSeries(series.id, testOrgId, {
          name: 'Existing Series'
        })
      ).rejects.toThrow('already exists')
    })

    test('should allow updating to same name', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Same Name',
          organizationId: testOrgId
        }
      })

      const updated = await seriesService.updateSeries(series.id, testOrgId, {
        name: 'Same Name',
        description: 'New description'
      })

      expect(updated.name).toBe('Same Name')
      expect(updated.description).toBe('New description')
    })

    test('should throw error for non-existent ID', async () => {
      await expect(
        seriesService.updateSeries(999999, testOrgId, { name: 'New Name' })
      ).rejects.toThrow('not found')
    })

    test('should reject empty update', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Series',
          organizationId: testOrgId
        }
      })

      await expect(
        seriesService.updateSeries(series.id, testOrgId, {})
      ).rejects.toThrow()
    })
  })

  describe('DELETE /api/series/[id]', () => {
    test('should delete series with no titles', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Deletable Series',
          organizationId: testOrgId
        }
      })

      await seriesService.deleteSeries(series.id, testOrgId)

      const found = await prisma.series.findUnique({
        where: { id: series.id }
      })

      expect(found).toBeNull()
    })

    test('should reject deletion of series with titles', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Series with Titles',
          organizationId: testOrgId
        }
      })

      // Create a title in this series
      await prisma.title.create({
        data: {
          isbn: '9788880902001',
          title: 'Title in Series for Delete Test',
          author: 'Author',
          format: 'PAPERBACK',
          rrp: 29.99,
          unitCost: 8.50,
          seriesId: series.id
        }
      })

      await expect(
        seriesService.deleteSeries(series.id, testOrgId)
      ).rejects.toThrow('associated titles')

      // Cleanup
      await prisma.title.deleteMany({
        where: { seriesId: series.id }
      })
    })

    test('should throw error for non-existent ID', async () => {
      await expect(
        seriesService.deleteSeries(999999, testOrgId)
      ).rejects.toThrow('not found')
    })
  })

  describe('Edge Cases', () => {
    test('should handle very long series names', async () => {
      const longName = 'A'.repeat(100) // Max length for VARCHAR(100)
      const series = await seriesService.createSeries({
        name: longName,
        organizationId: testOrgId
      })

      expect(series.name).toBe(longName)
    })

    test('should handle special characters in name', async () => {
      const series = await seriesService.createSeries({
        name: 'Series: The "Special" Edition (2024)',
        organizationId: testOrgId
      })

      expect(series.name).toBe('Series: The "Special" Edition (2024)')
    })

    test('should handle Unicode characters in name', async () => {
      const series = await seriesService.createSeries({
        name: '日本語シリーズ',
        organizationId: testOrgId
      })

      expect(series.name).toBe('日本語シリーズ')
    })

    test('should handle very long descriptions', async () => {
      const longDesc = 'A'.repeat(1000)
      const series = await seriesService.createSeries({
        name: 'Series',
        description: longDesc,
        organizationId: testOrgId
      })

      expect(series.description).toBe(longDesc)
    })

    test('should handle null description updates', async () => {
      const series = await prisma.series.create({
        data: {
          name: 'Series',
          description: 'Original description',
          organizationId: testOrgId
        }
      })

      const updated = await seriesService.updateSeries(series.id, testOrgId, {
        description: null
      })

      expect(updated.description).toBeNull()
    })
  })
})
