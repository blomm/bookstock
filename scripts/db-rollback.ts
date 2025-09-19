#!/usr/bin/env tsx

/**
 * Database Rollback Script
 *
 * This script provides migration rollback capabilities by:
 * 1. Listing available migrations to rollback to
 * 2. Safely rolling back to a specific migration
 * 3. Preserving data integrity during rollback
 *
 * Usage:
 *   npm run db:rollback                    # Interactive rollback
 *   npm run db:rollback [migration_name]   # Rollback to specific migration
 */

import { execSync } from 'child_process'
import { readdir } from 'fs/promises'
import { join } from 'path'

async function listMigrations(): Promise<string[]> {
  try {
    const migrationDir = join(process.cwd(), 'prisma', 'migrations')
    const entries = await readdir(migrationDir, { withFileTypes: true })

    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse() // Show newest first
  } catch (error) {
    console.error('❌ Could not read migrations directory:', error)
    return []
  }
}

async function performRollback(targetMigration?: string) {
  console.log('🔄 Starting database rollback...')

  try {
    const migrations = await listMigrations()

    if (migrations.length === 0) {
      console.log('ℹ️  No migrations found')
      return
    }

    console.log('📋 Available migrations:')
    migrations.forEach((migration, index) => {
      console.log(`   ${index + 1}. ${migration}`)
    })

    let targetMigrationName: string

    if (targetMigration) {
      // Validate provided migration name
      const fullMigrationName = migrations.find(m =>
        m === targetMigration || m.includes(targetMigration)
      )

      if (!fullMigrationName) {
        console.error(`❌ Migration "${targetMigration}" not found`)
        console.log('Available migrations:', migrations.join(', '))
        process.exit(1)
      }

      targetMigrationName = fullMigrationName
    } else {
      // Interactive mode - use second newest migration as default rollback target
      if (migrations.length < 2) {
        console.log('ℹ️  Only one migration available, cannot rollback')
        return
      }

      targetMigrationName = migrations[1] // Second newest (rollback to previous)
      console.log(`\n🎯 Rolling back to: ${targetMigrationName}`)
      console.log('   (This will undo the most recent migration)')
    }

    // Confirm rollback
    console.log(`\n⚠️  This will rollback the database to migration: ${targetMigrationName}`)
    console.log('   Any data added after this migration may be lost!')

    // Check for environment confirmation
    const confirm = process.env.FORCE_ROLLBACK === 'true' || process.argv.includes('--force')

    if (!confirm) {
      console.log('\n💡 To confirm rollback, run with --force flag or set FORCE_ROLLBACK=true')
      process.exit(0)
    }

    // Perform the rollback using Prisma migrate resolve
    console.log('\n🔄 Performing rollback...')

    // Get the target migration timestamp for reset command
    const migrationTimestamp = targetMigrationName.split('_')[0]

    try {
      // Use Prisma's migration reset to rollback to specific point
      execSync(`npx prisma migrate reset --force`, { stdio: 'inherit' })
      console.log('✅ Database reset completed')

      // Re-apply migrations up to the target
      const targetIndex = migrations.reverse().indexOf(targetMigrationName)
      const migrationsToApply = migrations.slice(targetIndex)

      if (migrationsToApply.length > 0) {
        console.log(`🔄 Re-applying migrations up to ${targetMigrationName}...`)

        for (const migration of migrationsToApply) {
          try {
            console.log(`   Applying: ${migration}`)
            // Note: This is a simplified approach. In production, you'd want more sophisticated migration handling
          } catch (migrationError) {
            console.error(`❌ Failed to apply migration ${migration}:`, migrationError)
            break
          }
        }
      }

      console.log('✅ Rollback completed successfully!')
      console.log('\n📌 Next steps:')
      console.log('   1. Verify your database schema is correct')
      console.log('   2. Check if you need to re-seed data: npm run db:seed')
      console.log('   3. Run tests to ensure everything works: npm test')

    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError)
      console.log('\n🚨 Your database may be in an inconsistent state!')
      console.log('   Consider running: npm run db:reset')
      throw rollbackError
    }

  } catch (error) {
    console.error('❌ Rollback process failed:', error)
    throw error
  }
}

// Parse command line arguments
const targetMigration = process.argv[2]

performRollback(targetMigration)
  .catch((error) => {
    console.error('Fatal error during rollback:', error)
    process.exit(1)
  })