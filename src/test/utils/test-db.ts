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
  // Delete in reverse order to handle foreign key constraints
  await testDb.stockMovement.deleteMany()
  await testDb.inventory.deleteMany()
  await testDb.priceHistory.deleteMany()
  await testDb.title.deleteMany()
  await testDb.series.deleteMany()
  await testDb.warehouse.deleteMany()
  await testDb.printer.deleteMany()

  // Reset ID sequences to avoid conflicts
  try {
    await testDb.$executeRaw`ALTER SEQUENCE titles_id_seq RESTART WITH 1`
    await testDb.$executeRaw`ALTER SEQUENCE series_id_seq RESTART WITH 1`
    await testDb.$executeRaw`ALTER SEQUENCE warehouses_id_seq RESTART WITH 1`
    await testDb.$executeRaw`ALTER SEQUENCE printers_id_seq RESTART WITH 1`
    await testDb.$executeRaw`ALTER SEQUENCE inventory_id_seq RESTART WITH 1`
    await testDb.$executeRaw`ALTER SEQUENCE price_history_id_seq RESTART WITH 1`
    await testDb.$executeRaw`ALTER SEQUENCE stock_movements_id_seq RESTART WITH 1`
  } catch (error) {
    console.warn('Could not reset sequences:', error)
  }

  // Reset test counter for each cleanup
  testCounter = 0
}

// Helper function to disconnect from database
export async function disconnectTestDb() {
  await testDb.$disconnect()
}

// Test data factories with unique identifiers
let testCounter = 0;

export const createTestSeries = async (data?: Partial<any>) => {
  testCounter++;
  return await testDb.series.create({
    data: {
      name: `Test Series ${testCounter}`,
      description: data?.description || null,
      ...data
    }
  })
}

export const createTestWarehouse = async (data?: Partial<any>) => {
  testCounter++;
  return await testDb.warehouse.create({
    data: {
      name: `Test Warehouse ${testCounter}`,
      code: `TS${testCounter}`,
      location: 'UK',
      fulfillsChannels: ['ONLINE_SALES'],
      ...data
    }
  })
}

export const createTestTitle = async (data?: Partial<any>) => {
  testCounter++;
  const isbn = data?.isbn || `978123456789${String(testCounter).padStart(1, '0')}`

  return await testDb.title.create({
    data: {
      isbn,
      title: `Test Book ${testCounter}`,
      author: 'Test Author',
      format: 'PAPERBACK',
      rrp: 19.99,
      unitCost: 5.50,
      ...data
    }
  })
}

export const createTestPrinter = async (data?: Partial<any>) => {
  testCounter++;
  return await testDb.printer.create({
    data: {
      name: `Test Printer ${testCounter}`,
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