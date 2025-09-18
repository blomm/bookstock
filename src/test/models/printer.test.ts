import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestPrinter } from '../utils/test-db'

describe('Printer Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create printer with required fields only', async () => {
      const printer = await createTestPrinter({
        name: 'Lightning Source UK'
      })

      expect(printer).toMatchObject({
        name: 'Lightning Source UK',
        isActive: true
      })
      expect(printer.id).toBeDefined()
      expect(printer.createdAt).toBeInstanceOf(Date)
      expect(printer.updatedAt).toBeInstanceOf(Date)
      expect(printer.code).toBeNull()
      expect(printer.location).toBeNull()
      expect(printer.contactEmail).toBeNull()
      expect(printer.contactPhone).toBeNull()
      expect(printer.website).toBeNull()
      expect(printer.specialties).toBeNull()
      expect(printer.notes).toBeNull()
    })

    test('should create printer with all fields', async () => {
      const printer = await createTestPrinter({
        name: 'Pureprint Group',
        code: 'PPG',
        location: 'UK',
        contactEmail: 'orders@pureprint.com',
        contactPhone: '+44 1825 768611',
        website: 'https://www.pureprint.com',
        specialties: ['Digital', 'Offset', 'Large Format'],
        isActive: true,
        notes: 'Primary UK printer for high-volume runs'
      })

      expect(printer.name).toBe('Pureprint Group')
      expect(printer.code).toBe('PPG')
      expect(printer.location).toBe('UK')
      expect(printer.contactEmail).toBe('orders@pureprint.com')
      expect(printer.contactPhone).toBe('+44 1825 768611')
      expect(printer.website).toBe('https://www.pureprint.com')
      expect(printer.specialties).toEqual(['Digital', 'Offset', 'Large Format'])
      expect(printer.isActive).toBe(true)
      expect(printer.notes).toBe('Primary UK printer for high-volume runs')
    })

    test('should enforce unique code constraint', async () => {
      await createTestPrinter({
        name: 'First Printer',
        code: 'UNIQUE'
      })

      await expect(
        createTestPrinter({
          name: 'Second Printer',
          code: 'UNIQUE'
        })
      ).rejects.toThrow()
    })

    test('should allow null codes for multiple printers', async () => {
      const printer1 = await createTestPrinter({
        name: 'Printer One',
        code: null
      })
      const printer2 = await createTestPrinter({
        name: 'Printer Two',
        code: null
      })

      expect(printer1.code).toBeNull()
      expect(printer2.code).toBeNull()
    })

    test('should default isActive to true', async () => {
      const printer = await testDb.printer.create({
        data: {
          name: 'Default Active Printer'
        }
      })

      expect(printer.isActive).toBe(true)
    })
  })

  describe('Validation', () => {
    test('should require name field', async () => {
      await expect(
        testDb.printer.create({
          data: {} as any
        })
      ).rejects.toThrow()
    })

    test('should enforce field length constraints', async () => {
      // Name too long (150 char limit)
      const longName = 'a'.repeat(151)
      await expect(
        createTestPrinter({ name: longName })
      ).rejects.toThrow()

      // Code too long (20 char limit)
      const longCode = 'a'.repeat(21)
      await expect(
        createTestPrinter({ code: longCode })
      ).rejects.toThrow()

      // Location too long (100 char limit)
      const longLocation = 'a'.repeat(101)
      await expect(
        createTestPrinter({ location: longLocation })
      ).rejects.toThrow()

      // Contact email too long (255 char limit)
      const longEmail = 'a'.repeat(246) + '@test.com'
      await expect(
        createTestPrinter({ contactEmail: longEmail })
      ).rejects.toThrow()

      // Contact phone too long (50 char limit)
      const longPhone = '1'.repeat(51)
      await expect(
        createTestPrinter({ contactPhone: longPhone })
      ).rejects.toThrow()

      // Website too long (255 char limit)
      const longWebsite = 'https://' + 'a'.repeat(249) + '.com'
      await expect(
        createTestPrinter({ website: longWebsite })
      ).rejects.toThrow()
    })

    test('should handle JSON specialties field', async () => {
      const printer = await createTestPrinter({
        name: 'Specialty Printer',
        specialties: ['Digital', 'Offset', 'Large Format', 'Bookbinding']
      })

      expect(Array.isArray(printer.specialties)).toBe(true)
      expect(printer.specialties).toHaveLength(4)
      expect(printer.specialties).toContain('Digital')
      expect(printer.specialties).toContain('Bookbinding')
    })

    test('should handle empty specialties array', async () => {
      const printer = await createTestPrinter({
        name: 'No Specialties Printer',
        specialties: []
      })

      expect(printer.specialties).toEqual([])
    })

    test('should handle complex JSON specialties', async () => {
      const complexSpecialties = [
        { type: 'Digital', maxPages: 1000 },
        { type: 'Offset', minQuantity: 500 }
      ]

      const printer = await createTestPrinter({
        name: 'Complex Printer',
        specialties: complexSpecialties
      })

      expect(printer.specialties).toEqual(complexSpecialties)
    })
  })

  describe('Queries', () => {
    test('should find printer by code', async () => {
      await createTestPrinter({
        name: 'Findable Printer',
        code: 'FIND'
      })

      const found = await testDb.printer.findUnique({
        where: { code: 'FIND' }
      })

      expect(found?.name).toBe('Findable Printer')
    })

    test('should search printers by name', async () => {
      await createTestPrinter({ name: 'Lightning Source UK' })
      await createTestPrinter({ name: 'Lightning Source US' })
      await createTestPrinter({ name: 'Pureprint Group' })

      const lightningPrinters = await testDb.printer.findMany({
        where: { name: { contains: 'Lightning Source' } }
      })

      expect(lightningPrinters).toHaveLength(2)
    })

    test('should filter by location', async () => {
      await createTestPrinter({ name: 'UK Printer 1', location: 'UK' })
      await createTestPrinter({ name: 'UK Printer 2', location: 'UK' })
      await createTestPrinter({ name: 'US Printer', location: 'US' })

      const ukPrinters = await testDb.printer.findMany({
        where: { location: 'UK' }
      })

      expect(ukPrinters).toHaveLength(2)
    })

    test('should filter by active status', async () => {
      await createTestPrinter({ name: 'Active Printer', isActive: true })
      await createTestPrinter({ name: 'Inactive Printer', isActive: false })

      const activePrinters = await testDb.printer.findMany({
        where: { isActive: true }
      })

      expect(activePrinters).toHaveLength(1)
      expect(activePrinters[0].name).toBe('Active Printer')
    })

    test('should order printers by name', async () => {
      await createTestPrinter({ name: 'Zebra Print' })
      await createTestPrinter({ name: 'Alpha Print' })
      await createTestPrinter({ name: 'Beta Print' })

      const ordered = await testDb.printer.findMany({
        orderBy: { name: 'asc' }
      })

      expect(ordered.map(p => p.name)).toEqual(['Alpha Print', 'Beta Print', 'Zebra Print'])
    })
  })

  describe('Updates', () => {
    test('should update printer contact information', async () => {
      const printer = await createTestPrinter({
        name: 'Updatable Printer',
        contactEmail: 'old@example.com',
        contactPhone: '+44 1111 111111'
      })

      const updated = await testDb.printer.update({
        where: { id: printer.id },
        data: {
          contactEmail: 'new@example.com',
          contactPhone: '+44 2222 222222',
          website: 'https://newwebsite.com'
        }
      })

      expect(updated.contactEmail).toBe('new@example.com')
      expect(updated.contactPhone).toBe('+44 2222 222222')
      expect(updated.website).toBe('https://newwebsite.com')
      expect(updated.updatedAt.getTime()).toBeGreaterThan(printer.updatedAt.getTime())
    })

    test('should update specialties', async () => {
      const printer = await createTestPrinter({
        name: 'Specialty Printer',
        specialties: ['Digital']
      })

      const updated = await testDb.printer.update({
        where: { id: printer.id },
        data: {
          specialties: ['Digital', 'Offset', 'Large Format']
        }
      })

      expect(updated.specialties).toEqual(['Digital', 'Offset', 'Large Format'])
    })

    test('should deactivate printer', async () => {
      const printer = await createTestPrinter({
        name: 'Soon Inactive',
        isActive: true
      })

      const updated = await testDb.printer.update({
        where: { id: printer.id },
        data: {
          isActive: false,
          notes: 'Deactivated due to quality issues'
        }
      })

      expect(updated.isActive).toBe(false)
      expect(updated.notes).toBe('Deactivated due to quality issues')
    })
  })

  describe('Deletion', () => {
    test('should delete printer without relationships', async () => {
      const printer = await createTestPrinter({ name: 'Deletable Printer' })

      await testDb.printer.delete({
        where: { id: printer.id }
      })

      const found = await testDb.printer.findUnique({
        where: { id: printer.id }
      })

      expect(found).toBeNull()
    })
  })

  describe('Business Logic Validation', () => {
    test('should handle realistic printer data', async () => {
      const printer = await createTestPrinter({
        name: 'Lightning Source UK',
        code: 'LSUK',
        location: 'Milton Keynes, UK',
        contactEmail: 'customer.service@lightningsource.com',
        contactPhone: '+44 1908 844100',
        website: 'https://www.lightningsource.com',
        specialties: [
          'Print-on-Demand',
          'Digital Printing',
          'Distribution',
          'Paperback',
          'Hardcover'
        ],
        isActive: true,
        notes: 'Primary UK printer for POD titles. Excellent turnaround times and quality.'
      })

      expect(printer.name).toBe('Lightning Source UK')
      expect(printer.code).toBe('LSUK')
      expect(printer.location).toBe('Milton Keynes, UK')
      expect(printer.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(printer.website).toMatch(/^https?:\/\//)
      expect(printer.specialties).toContain('Print-on-Demand')
      expect(printer.isActive).toBe(true)
    })

    test('should handle international printer variations', async () => {
      const usPrinter = await createTestPrinter({
        name: 'Lightning Source US',
        code: 'LSUS',
        location: 'La Vergne, TN, USA',
        contactPhone: '+1 615 213 5815'
      })

      const euPrinter = await createTestPrinter({
        name: 'European Print Solutions',
        code: 'EPS',
        location: 'Berlin, Germany',
        contactPhone: '+49 30 12345678',
        specialties: ['Offset Printing', 'Perfect Binding', 'Multilingual']
      })

      expect(usPrinter.location).toContain('USA')
      expect(usPrinter.contactPhone).toMatch(/^\+1/)
      expect(euPrinter.location).toContain('Germany')
      expect(euPrinter.contactPhone).toMatch(/^\+49/)
      expect(euPrinter.specialties).toContain('Multilingual')
    })

    test('should validate printer capabilities for different book types', async () => {
      const podPrinter = await createTestPrinter({
        name: 'POD Specialist',
        specialties: ['Print-on-Demand', 'Digital', 'Small Runs']
      })

      const offsetPrinter = await createTestPrinter({
        name: 'Offset Specialist',
        specialties: ['Offset', 'Large Runs', 'Perfect Binding', 'Case Binding']
      })

      expect(podPrinter.specialties).toContain('Print-on-Demand')
      expect(offsetPrinter.specialties).toContain('Offset')
      expect(offsetPrinter.specialties).toContain('Case Binding')
    })
  })
})