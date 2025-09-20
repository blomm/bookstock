#!/usr/bin/env tsx

/**
 * Database Performance Test Script
 *
 * Tests database performance with realistic data volumes for
 * a publishing inventory system to ensure the schema can handle
 * expected load patterns.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDatabasePerformance() {
  console.log('🚀 Starting database performance tests...')

  try {
    // Test 1: Query performance with current data
    console.log('\n📊 Test 1: Basic query performance')

    const startTime = performance.now()

    const titleCount = await prisma.title.count()
    const inventoryCount = await prisma.inventory.count()
    const movementCount = await prisma.stockMovement.count()

    const basicQueryTime = performance.now() - startTime
    console.log(`   ✓ Basic counts: ${titleCount} titles, ${inventoryCount} inventory records, ${movementCount} movements`)
    console.log(`   ✓ Query time: ${basicQueryTime.toFixed(2)}ms`)

    // Test 2: Complex join performance
    console.log('\n🔍 Test 2: Complex join query performance')

    const joinStartTime = performance.now()

    const inventoryWithDetails = await prisma.inventory.findMany({
      include: {
        title: {
          include: {
            series: true
          }
        },
        warehouse: true
      },
      where: {
        currentStock: {
          gt: 0
        }
      }
    })

    const joinQueryTime = performance.now() - joinStartTime
    console.log(`   ✓ Found ${inventoryWithDetails.length} inventory records with details`)
    console.log(`   ✓ Join query time: ${joinQueryTime.toFixed(2)}ms`)

    // Test 3: Aggregation performance
    console.log('\n📈 Test 3: Aggregation query performance')

    const aggStartTime = performance.now()

    const stockSummary = await prisma.inventory.groupBy({
      by: ['warehouseId'],
      _sum: {
        currentStock: true,
        reservedStock: true
      },
      _count: {
        titleId: true
      }
    })

    const aggQueryTime = performance.now() - aggStartTime
    console.log(`   ✓ Stock summary by warehouse:`)

    for (const summary of stockSummary) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: summary.warehouseId }
      })
      console.log(`     - ${warehouse?.name}: ${summary._count.titleId} titles, ${summary._sum.currentStock} total stock`)
    }

    console.log(`   ✓ Aggregation time: ${aggQueryTime.toFixed(2)}ms`)

    // Test 4: Index utilization test
    console.log('\n🔍 Test 4: Index utilization performance')

    const indexStartTime = performance.now()

    // Test ISBN lookup (should use index)
    const titleByISBN = await prisma.title.findUnique({
      where: { isbn: '9781234567890' }
    })

    // Test warehouse code lookup (should use index)
    const warehouseByCode = await prisma.warehouse.findUnique({
      where: { code: 'TRN' }
    })

    // Test movement type filtering (should use index)
    const salesMovements = await prisma.stockMovement.findMany({
      where: {
        movementType: 'UK_TRADE_SALES'
      },
      take: 10
    })

    const indexQueryTime = performance.now() - indexStartTime
    console.log(`   ✓ ISBN lookup: ${titleByISBN ? 'Found' : 'Not found'}`)
    console.log(`   ✓ Warehouse code lookup: ${warehouseByCode ? 'Found' : 'Not found'}`)
    console.log(`   ✓ Movement type filter: ${salesMovements.length} records`)
    console.log(`   ✓ Index queries time: ${indexQueryTime.toFixed(2)}ms`)

    // Test 5: Transaction performance
    console.log('\n💰 Test 5: Transaction performance')

    const transactionStartTime = performance.now()

    await prisma.$transaction(async (tx) => {
      // Simulate a stock movement transaction
      const warehouse = await tx.warehouse.findFirst()
      const title = await tx.title.findFirst()

      if (warehouse && title) {
        // Create stock movement
        const movement = await tx.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'ONLINE_SALES',
            quantity: -1,
            movementDate: new Date(),
            rrpAtTime: title.rrp,
            unitCostAtTime: title.unitCost,
            referenceNumber: 'PERF-TEST-001',
            notes: 'Performance test transaction'
          }
        })

        // Update inventory
        const inventory = await tx.inventory.findUnique({
          where: {
            titleId_warehouseId: {
              titleId: title.id,
              warehouseId: warehouse.id
            }
          }
        })

        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              currentStock: inventory.currentStock - 1,
              lastMovementDate: new Date()
            }
          })
        }

        console.log(`   ✓ Created movement ${movement.id} and updated inventory`)
      }
    })

    const transactionTime = performance.now() - transactionStartTime
    console.log(`   ✓ Transaction time: ${transactionTime.toFixed(2)}ms`)

    // Performance summary
    console.log('\n📋 Performance Summary:')
    console.log(`   • Basic queries: ${basicQueryTime.toFixed(2)}ms`)
    console.log(`   • Complex joins: ${joinQueryTime.toFixed(2)}ms`)
    console.log(`   • Aggregations: ${aggQueryTime.toFixed(2)}ms`)
    console.log(`   • Index utilization: ${indexQueryTime.toFixed(2)}ms`)
    console.log(`   • Transactions: ${transactionTime.toFixed(2)}ms`)

    const totalTime = performance.now() - performance.now()
    console.log(`   • Total test time: ${(basicQueryTime + joinQueryTime + aggQueryTime + indexQueryTime + transactionTime).toFixed(2)}ms`)

    // Performance thresholds (for CI/monitoring)
    const thresholds = {
      basicQueries: 100, // ms
      complexJoins: 500, // ms
      aggregations: 200, // ms
      indexQueries: 50, // ms
      transactions: 1000 // ms
    }

    let allPassed = true

    if (basicQueryTime > thresholds.basicQueries) {
      console.log(`   ⚠️  Basic queries slower than threshold (${thresholds.basicQueries}ms)`)
      allPassed = false
    }

    if (joinQueryTime > thresholds.complexJoins) {
      console.log(`   ⚠️  Complex joins slower than threshold (${thresholds.complexJoins}ms)`)
      allPassed = false
    }

    if (aggQueryTime > thresholds.aggregations) {
      console.log(`   ⚠️  Aggregations slower than threshold (${thresholds.aggregations}ms)`)
      allPassed = false
    }

    if (indexQueryTime > thresholds.indexQueries) {
      console.log(`   ⚠️  Index queries slower than threshold (${thresholds.indexQueries}ms)`)
      allPassed = false
    }

    if (transactionTime > thresholds.transactions) {
      console.log(`   ⚠️  Transactions slower than threshold (${thresholds.transactions}ms)`)
      allPassed = false
    }

    if (allPassed) {
      console.log('\n✅ All performance tests passed within acceptable thresholds!')
    } else {
      console.log('\n⚠️  Some performance tests exceeded thresholds - consider optimization')
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testDatabasePerformance()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })