import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Validation schema for title merge request
const mergeTitlesSchema = z.object({
  sourceId: z.string().uuid('Invalid source title ID'),
  targetId: z.string().uuid('Invalid target title ID'),
  strategy: z.enum(['KEEP_TARGET', 'KEEP_SOURCE', 'MERGE_DATA']),
  mergeData: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    description: z.string().optional(),
    publisher: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    keywords: z.string().optional(),
    language: z.string().optional(),
    territoryRights: z.string().optional()
  }).optional(),
  reason: z.string().min(1, 'Merge reason is required').max(500)
})

// POST /api/titles/merge - Merge duplicate titles
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceId, targetId, strategy, mergeData, reason } = mergeTitlesSchema.parse(body)

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: 'Cannot merge title with itself' },
        { status: 400 }
      )
    }

    // Get both titles with all related data
    const [sourceTitle, targetTitle] = await Promise.all([
      prisma.title.findUnique({
        where: { id: sourceId },
        include: {
          inventory: {
            include: {
              warehouse: { select: { name: true, code: true } }
            }
          },
          stockMovements: true,
          priceHistory: true,
          series: true
        }
      }),
      prisma.title.findUnique({
        where: { id: targetId },
        include: {
          inventory: {
            include: {
              warehouse: { select: { name: true, code: true } }
            }
          },
          stockMovements: true,
          priceHistory: true,
          series: true
        }
      })
    ])

    if (!sourceTitle || !targetTitle) {
      return NextResponse.json(
        { error: 'One or both titles not found' },
        { status: 404 }
      )
    }

    // Validate merge conditions
    const validationResult = validateMergeConditions(sourceTitle, targetTitle)
    if (!validationResult.canMerge) {
      return NextResponse.json(
        {
          error: 'Cannot merge titles',
          code: 'MERGE_VALIDATION_FAILED',
          details: validationResult.reasons
        },
        { status: 400 }
      )
    }

    // Perform merge in transaction
    const result = await prisma.$transaction(async (tx) => {
      let finalData = targetTitle

      // Apply merge strategy
      if (strategy === 'KEEP_SOURCE') {
        // Update target with source data (keeping target ISBN)
        finalData = await tx.title.update({
          where: { id: targetId },
          data: {
            title: sourceTitle.title,
            subtitle: sourceTitle.subtitle,
            author: sourceTitle.author,
            publicationYear: sourceTitle.publicationYear,
            publisher: sourceTitle.publisher,
            description: sourceTitle.description,
            format: sourceTitle.format,
            rrp: sourceTitle.rrp,
            unitCost: sourceTitle.unitCost,
            category: sourceTitle.category,
            subcategory: sourceTitle.subcategory,
            pageCount: sourceTitle.pageCount,
            dimensions: sourceTitle.dimensions,
            weight: sourceTitle.weight,
            bindingType: sourceTitle.bindingType,
            coverFinish: sourceTitle.coverFinish,
            tradeDiscount: sourceTitle.tradeDiscount,
            royaltyRate: sourceTitle.royaltyRate,
            royaltyThreshold: sourceTitle.royaltyThreshold,
            printRunSize: sourceTitle.printRunSize,
            reprintThreshold: sourceTitle.reprintThreshold,
            keywords: sourceTitle.keywords,
            language: sourceTitle.language,
            territoryRights: sourceTitle.territoryRights,
            seriesId: sourceTitle.seriesId,
            status: sourceTitle.status
          }
        })
      } else if (strategy === 'MERGE_DATA' && mergeData) {
        // Update target with custom merged data
        finalData = await tx.title.update({
          where: { id: targetId },
          data: mergeData
        })
      }
      // KEEP_TARGET strategy requires no update

      // Merge inventory (combine stock levels by warehouse)
      for (const sourceInventory of sourceTitle.inventory) {
        const existingTargetInventory = targetTitle.inventory.find(
          inv => inv.warehouseId === sourceInventory.warehouseId
        )

        if (existingTargetInventory) {
          // Combine stock levels
          await tx.inventory.update({
            where: { id: existingTargetInventory.id },
            data: {
              currentStock: existingTargetInventory.currentStock + sourceInventory.currentStock,
              reservedStock: existingTargetInventory.reservedStock + sourceInventory.reservedStock,
              averageCost: calculateWeightedAverageCost(
                existingTargetInventory,
                sourceInventory
              ),
              totalValue: calculateTotalValue(
                existingTargetInventory.currentStock + sourceInventory.currentStock,
                calculateWeightedAverageCost(existingTargetInventory, sourceInventory)
              ),
              lastCostUpdate: new Date()
            }
          })
        } else {
          // Transfer inventory to target title
          await tx.inventory.update({
            where: { id: sourceInventory.id },
            data: { titleId: targetId }
          })
        }
      }

      // Transfer stock movements to target title
      await tx.stockMovement.updateMany({
        where: { titleId: sourceId },
        data: { titleId: targetId }
      })

      // Merge price history (keep all records, update titleId)
      await tx.priceHistory.updateMany({
        where: { titleId: sourceId },
        data: { titleId: targetId }
      })

      // Create merge audit record
      await tx.priceHistory.create({
        data: {
          titleId: targetId,
          rrp: finalData.rrp,
          unitCost: finalData.unitCost,
          tradeDiscount: finalData.tradeDiscount,
          effectiveFrom: new Date(),
          reason: `Title merge: ${reason} (merged from ${sourceTitle.isbn})`
        }
      })

      // Delete source title
      await tx.title.delete({
        where: { id: sourceId }
      })

      return finalData
    })

    return NextResponse.json({
      data: result,
      message: 'Titles merged successfully',
      summary: {
        sourceISBN: sourceTitle.isbn,
        targetISBN: targetTitle.isbn,
        strategy,
        reason,
        mergedInventory: sourceTitle.inventory.length,
        mergedMovements: sourceTitle.stockMovements.length,
        mergedPriceHistory: sourceTitle.priceHistory.length
      }
    })
  } catch (error) {
    console.error('Error merging titles:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to validate merge conditions
function validateMergeConditions(sourceTitle: any, targetTitle: any): {
  canMerge: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  // Check if titles are similar enough to merge
  if (sourceTitle.isbn === targetTitle.isbn) {
    reasons.push('Titles have the same ISBN')
  }

  // Check if authors are significantly different
  const authorSimilarity = calculateStringSimilarity(
    sourceTitle.author.toLowerCase(),
    targetTitle.author.toLowerCase()
  )

  if (authorSimilarity < 0.7) {
    reasons.push('Authors are too different to safely merge')
  }

  // Check if titles are significantly different
  const titleSimilarity = calculateStringSimilarity(
    sourceTitle.title.toLowerCase(),
    targetTitle.title.toLowerCase()
  )

  if (titleSimilarity < 0.5) {
    reasons.push('Title names are too different to safely merge')
  }

  // Check if formats are compatible
  if (sourceTitle.format !== targetTitle.format) {
    reasons.push('Different formats cannot be merged')
  }

  // Check if both titles have active inventory
  const sourceHasInventory = sourceTitle.inventory.some((inv: any) => inv.currentStock > 0)
  const targetHasInventory = targetTitle.inventory.some((inv: any) => inv.currentStock > 0)

  if (sourceHasInventory && targetHasInventory) {
    // Allow merge but warn
    console.warn('Merging titles with inventory in both - will combine stock levels')
  }

  return {
    canMerge: reasons.length === 0,
    reasons
  }
}

// Helper function to calculate string similarity (simple implementation)
function calculateStringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length)
  if (maxLength === 0) return 1

  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLength
}

// Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      )
    }
  }

  return matrix[str2.length][str1.length]
}

// Helper function to calculate weighted average cost
function calculateWeightedAverageCost(inv1: any, inv2: any): number {
  const totalQuantity = inv1.currentStock + inv2.currentStock
  if (totalQuantity === 0) return 0

  const totalValue = (inv1.currentStock * (inv1.averageCost || 0)) +
                    (inv2.currentStock * (inv2.averageCost || 0))

  return totalValue / totalQuantity
}

// Helper function to calculate total inventory value
function calculateTotalValue(quantity: number, averageCost: number): number {
  return quantity * averageCost
}