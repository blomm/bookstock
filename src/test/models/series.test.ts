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
        description: 'Fantasy series by J.K. Rowling'
      })

      expect(series).toMatchObject({
        name: 'Harry Potter',
        description: 'Fantasy series by J.K. Rowling'
      })
      expect(series.id).toBeDefined()
      expect(series.createdAt).toBeInstanceOf(Date)
      expect(series.updatedAt).toBeInstanceOf(Date)
    })

    test('should create a series with only name (description optional)', async () => {
      const series = await createTestSeries({
        name: 'Minimalist Series'
      })

      expect(series.name).toBe('Minimalist Series')
      expect(series.description).toBeNull()
    })

    test('should enforce unique series names', async () => {
      await createTestSeries({ name: 'Unique Series' })

      await expect(
        createTestSeries({ name: 'Unique Series' })
      ).rejects.toThrow()
    })

    test('should require series name', async () => {
      await expect(
        testDb.series.create({ data: {} as any })
      ).rejects.toThrow()
    })
  })

  describe('Validation', () => {
    test('should enforce name length constraints', async () => {
      // Test maximum length (255 characters)
      const longName = 'a'.repeat(256)
      await expect(
        createTestSeries({ name: longName })
      ).rejects.toThrow()
    })

    test('should handle description with various lengths', async () => {
      const longDescription = 'A '.repeat(500) + 'very long description'
      const series = await createTestSeries({
        name: 'Long Description Series',
        description: longDescription
      })

      expect(series.description).toBe(longDescription)
    })
  })

  describe('Relationships', () => {
    test('should support one-to-many relationship with titles', async () => {
      const series = await createTestSeries({
        name: 'Test Series'
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
        name: 'Empty Series'
      })

      const seriesWithTitles = await testDb.series.findUnique({
        where: { id: series.id },
        include: { titles: true }
      })

      expect(seriesWithTitles?.titles).toHaveLength(0)
    })
  })

  describe('Queries', () => {
    test('should find series by name', async () => {
      await createTestSeries({ name: 'Findable Series' })

      const found = await testDb.series.findUnique({
        where: { name: 'Findable Series' }
      })

      expect(found?.name).toBe('Findable Series')
    })

    test('should support case-sensitive name searches', async () => {
      await createTestSeries({ name: 'CaseSensitive' })

      const found = await testDb.series.findUnique({
        where: { name: 'casesensitive' }
      })

      expect(found).toBeNull()
    })

    test('should order series by name', async () => {
      await createTestSeries({ name: 'Zebra Series' })
      await createTestSeries({ name: 'Alpha Series' })
      await createTestSeries({ name: 'Beta Series' })

      const allSeries = await testDb.series.findMany({
        orderBy: { name: 'asc' }
      })

      expect(allSeries.map(s => s.name)).toEqual([
        'Alpha Series',
        'Beta Series',
        'Zebra Series'
      ])
    })
  })

  describe('Updates', () => {
    test('should update series name and description', async () => {
      const series = await createTestSeries({
        name: 'Original Name',
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
      expect(updated.updatedAt.getTime()).toBeGreaterThan(series.updatedAt.getTime())
    })

    test('should update only description', async () => {
      const series = await createTestSeries({
        name: 'Constant Name',
        description: 'Original description'
      })

      const updated = await testDb.series.update({
        where: { id: series.id },
        data: { description: 'New description' }
      })

      expect(updated.name).toBe('Constant Name')
      expect(updated.description).toBe('New description')
    })
  })

  describe('Deletion', () => {
    test('should delete series without titles', async () => {
      const series = await createTestSeries({ name: 'Deletable Series' })

      await testDb.series.delete({
        where: { id: series.id }
      })

      const found = await testDb.series.findUnique({
        where: { id: series.id }
      })

      expect(found).toBeNull()
    })

    test('should handle deletion with associated titles', async () => {
      const series = await createTestSeries({ name: 'Series with Books' })
      await createTestTitle({
        isbn: '9783333333333',
        seriesId: series.id
      })

      // Should fail due to foreign key constraint
      await expect(
        testDb.series.delete({ where: { id: series.id } })
      ).rejects.toThrow()
    })
  })
})