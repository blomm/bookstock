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
  // Delete in correct order to handle foreign key constraints
  // Most dependent tables first, then independent tables
  
  // 1. Delete audit logs (references users)
  await testDb.auditLog.deleteMany()
  
  // 2. Delete user roles (references users and roles)
  await testDb.userRole.deleteMany()
  
  // 3. Delete stock movements (references titles, warehouses, printers)
  await testDb.stockMovement.deleteMany()
  
  // 4. Delete price history (references titles)
  await testDb.priceHistory.deleteMany()
  
  // 5. Delete inventory (references titles and warehouses)
  await testDb.inventory.deleteMany()
  
  // 6. Delete titles (references series)
  await testDb.title.deleteMany()
  
  // 7. Delete independent tables
  await testDb.series.deleteMany()
  await testDb.warehouse.deleteMany()
  await testDb.printer.deleteMany()
  
  // 8. Delete authentication tables (users reference roles through userRoles)
  await testDb.user.deleteMany()
  await testDb.role.deleteMany()
}

// Helper function to disconnect from database
export async function disconnectTestDb() {
  await testDb.$disconnect()
}

// Test data factories
export const createTestSeries = async (data?: Partial<any>) => {
  const uniqueName = `Test Series ${Date.now()}-${Math.random()}`
  return await testDb.series.create({
    data: {
      name: uniqueName,
      description: 'A test series for unit testing',
      organizationId: 'org_test_default',
      status: 'ACTIVE',
      ...data
    }
  })
}

export const createTestWarehouse = async (data?: Partial<any>) => {
  const uniqueCode = `T${Date.now().toString().slice(-6)}`
  return await testDb.warehouse.create({
    data: {
      name: 'Test Warehouse',
      code: uniqueCode,
      location: 'UK',
      fulfillsChannels: ['ONLINE_SALES'],
      ...data
    }
  })
}

export const createTestTitle = async (data?: Partial<any>) => {
  const uniqueIsbn = `978${Date.now().toString().slice(-9)}`
  return await testDb.title.create({
    data: {
      isbn: uniqueIsbn,
      title: 'Test Book',
      author: 'Test Author',
      format: 'PAPERBACK',
      rrp: 19.99,
      unitCost: 5.50,
      ...data
    }
  })
}

export const createTestPrinter = async (data?: Partial<any>) => {
  const uniqueName = `Test Printer ${Date.now()}-${Math.random()}`
  return await testDb.printer.create({
    data: {
      name: uniqueName,
      ...data
    }
  })
}

export const createTestUser = async (data?: Partial<any>) => {
  const uniqueClerkId = `clerk_test_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const uniqueEmail = `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`
  return await testDb.user.create({
    data: {
      clerkId: uniqueClerkId,
      email: uniqueEmail,
      ...data
    }
  })
}

export const createTestRole = async (data?: Partial<any>) => {
  const uniqueName = `Test Role ${Date.now()}-${Math.random()}`
  return await testDb.role.create({
    data: {
      name: uniqueName,
      permissions: ['test:read'],
      ...data
    }
  })
}
