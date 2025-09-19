#!/usr/bin/env tsx

/**
 * Database Reset Script
 *
 * This script provides a safe way to reset the database by:
 * 1. Dropping all data while preserving schema
 * 2. Reseeding with fresh test data
 *
 * Usage:
 *   npm run db:reset
 *   npm run db:reset:prod (for production - requires confirmation)
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

async function resetDatabase(environment: 'dev' | 'test' | 'prod' = 'dev') {
  console.log(`🔄 Starting database reset for ${environment} environment...`)

  // Safety check for production
  if (environment === 'prod') {
    const confirm = process.env.FORCE_RESET === 'true'
    if (!confirm) {
      console.error('❌ Production reset requires FORCE_RESET=true environment variable')
      process.exit(1)
    }
    console.warn('⚠️  PRODUCTION DATABASE RESET - THIS WILL DELETE ALL DATA!')
  }

  try {
    // Step 1: Clear all data in correct order (respecting foreign keys)
    console.log('🗑️  Clearing existing data...')

    await prisma.stockMovement.deleteMany()
    console.log('   ✓ Cleared stock movements')

    await prisma.inventory.deleteMany()
    console.log('   ✓ Cleared inventory records')

    await prisma.priceHistory.deleteMany()
    console.log('   ✓ Cleared price history')

    await prisma.title.deleteMany()
    console.log('   ✓ Cleared titles')

    await prisma.series.deleteMany()
    console.log('   ✓ Cleared series')

    await prisma.warehouse.deleteMany()
    console.log('   ✓ Cleared warehouses')

    await prisma.printer.deleteMany()
    console.log('   ✓ Cleared printers')

    // Step 2: Reset auto-increment sequences
    console.log('🔢 Resetting ID sequences...')

    const tables = ['series', 'warehouses', 'printers', 'titles', 'inventory', 'price_history', 'stock_movements']
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`)
    }
    console.log('   ✓ Reset all ID sequences')

    // Step 3: Re-seed database
    console.log('🌱 Re-seeding database...')

    if (environment === 'test') {
      // For tests, run minimal seed
      execSync('DATABASE_URL="postgresql://test:test@localhost:5433/bookstock_test" tsx prisma/seed.ts', { stdio: 'inherit' })
    } else {
      // For dev/prod, run full seed
      execSync('tsx prisma/seed.ts', { stdio: 'inherit' })
    }

    console.log('✅ Database reset completed successfully!')

  } catch (error) {
    console.error('❌ Database reset failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const environment = process.argv[2] as 'dev' | 'test' | 'prod' || 'dev'

if (!['dev', 'test', 'prod'].includes(environment)) {
  console.error('❌ Invalid environment. Use: dev, test, or prod')
  process.exit(1)
}

resetDatabase(environment)
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })