import { PrismaClient } from '@prisma/client'

/**
 * Global Prisma Client Instance
 *
 * This file creates and exports a global Prisma client instance
 * that can be reused across the application. In development,
 * it prevents multiple instances from being created due to
 * hot reloading.
 */

const global_for_prisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In test environment, always create a new client to pick up TEST_DATABASE_URL
const shouldCache = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

export const prisma =
  (shouldCache ? global_for_prisma.prisma : undefined) ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

if (shouldCache) global_for_prisma.prisma = prisma