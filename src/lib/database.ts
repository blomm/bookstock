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

export const prisma =
  global_for_prisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') global_for_prisma.prisma = prisma