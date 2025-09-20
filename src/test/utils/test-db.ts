import { PrismaClient } from '@prisma/client'

// Create a separate test database client
export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/bookstock_test'
    }
  }
})

// Helper function to clean up database between tests
export async function cleanDatabase() {
  // Use a transaction to ensure atomicity and handle foreign key constraints
  await testDb.$transaction(async (prisma) => {
    // Delete in correct order to handle foreign key constraints
    await prisma.stockMovement.deleteMany()
    await prisma.inventory.deleteMany()
    await prisma.priceHistory.deleteMany()
    await prisma.title.deleteMany()
    await prisma.series.deleteMany()
    await prisma.warehouse.deleteMany()
    await prisma.printer.deleteMany()
  })

  // Reset ID sequences to avoid conflicts
  try {
    await testDb.$executeRaw`TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE`
    await testDb.$executeRaw`TRUNCATE TABLE inventory RESTART IDENTITY CASCADE`
    await testDb.$executeRaw`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`
    await testDb.$executeRaw`TRUNCATE TABLE titles RESTART IDENTITY CASCADE`
    await testDb.$executeRaw`TRUNCATE TABLE series RESTART IDENTITY CASCADE`
    await testDb.$executeRaw`TRUNCATE TABLE warehouses RESTART IDENTITY CASCADE`
    await testDb.$executeRaw`TRUNCATE TABLE printers RESTART IDENTITY CASCADE`
  } catch (error) {
    console.warn('Could not truncate tables:', error)
  }
}

// Helper function to disconnect from database
export async function disconnectTestDb() {
  await testDb.$disconnect()
}

// Test data factories with unique identifiers using timestamp and random
function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const createTestSeries = async (data?: Partial<any>) => {
  const uniqueId = generateUniqueId()
  return await testDb.series.create({
    data: {
      name: `Test Series ${uniqueId}`,
      description: data?.description || null,
      ...data
    }
  })
}

export const createTestWarehouse = async (data?: Partial<any>) => {
  const uniqueId = generateUniqueId()
  return await testDb.warehouse.create({
    data: {
      name: `Test Warehouse ${uniqueId}`,
      code: data?.code || `TS${uniqueId.substr(0, 8)}`,
      location: 'UK',
      fulfillsChannels: ['ONLINE_SALES'],
      ...data
    }
  })
}

export const createTestTitle = async (data?: Partial<any>) => {
  const uniqueId = generateUniqueId()
  const isbn = data?.isbn || `978${uniqueId.replace(/-/g, '').substr(0, 10)}`

  return await testDb.title.create({
    data: {
      isbn,
      title: `Test Book ${uniqueId}`,
      author: 'Test Author',
      format: 'PAPERBACK',
      rrp: 19.99,
      unitCost: 5.50,
      ...data
    }
  })
}

export const createTestPrinter = async (data?: Partial<any>) => {
  const uniqueId = generateUniqueId()
  return await testDb.printer.create({
    data: {
      name: `Test Printer ${uniqueId}`,
      code: data?.code || null,
      ...data
    }
  })
}

export const createTestPriceHistory = async (data?: Partial<any>) => {
  return await testDb.priceHistory.create({
    data: {
      titleId: 1, // Will be overridden by data
      rrp: 19.99,
      effectiveFrom: new Date('2024-01-01'),
      ...data
    }
  })
}