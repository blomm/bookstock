import { PrismaClient, Prisma, Format, TitleStatus } from '@prisma/client'
import { parse as parseCSV } from 'csv-parse/sync'
import { audit } from 'isbn3'

const prisma = new PrismaClient()

// Allow dependency injection for testing
let dbClient = prisma

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Import interfaces
export interface ImportResult {
  success: boolean
  jobId: string
  created?: any[]
  errors?: ImportError[]
  summary: ImportSummary
}

export interface ImportError {
  row: number
  isbn?: string
  title?: string
  field?: string
  error: string
  data: any
}

export interface ImportSummary {
  total: number
  successful: number
  failed: number
  skipped: number
  duration: number
  startTime: Date
  endTime?: Date
}

export interface ImportJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  summary: ImportSummary
  errors: ImportError[]
  created: any[]
  options: ImportOptions
  createdAt: Date
  updatedAt: Date
}

export interface ImportOptions {
  useTransaction?: boolean
  validateFirst?: boolean
  continueOnError?: boolean
  batchSize?: number
  skipDuplicates?: boolean
  updateExisting?: boolean
  dryRun?: boolean
}

export interface TitleImportData {
  isbn: string
  title: string
  author: string
  format: string
  rrp: number
  unitCost: number
  pageCount?: number
  publicationDate?: string | Date
  publisher?: string
  category?: string
  subcategory?: string
  dimensions?: string
  weight?: number
  bindingType?: string
  coverFinish?: string
  tradeDiscount?: number
  royaltyRate?: number
  royaltyThreshold?: number
  printRunSize?: number
  reprintThreshold?: number
  description?: string
  keywords?: string
  language?: string
  territoryRights?: string
  seriesId?: number
  seriesName?: string
  status?: string
}

// In-memory job store (in production, this would be Redis or database)
const jobs = new Map<string, ImportJob>()

// Validation functions
export function validateTitleData(data: TitleImportData, row: number): ImportError[] {
  const errors: ImportError[] = []

  // Required fields validation
  if (!data.isbn) {
    errors.push({
      row,
      field: 'isbn',
      error: 'ISBN is required',
      data
    })
  }

  if (!data.title) {
    errors.push({
      row,
      field: 'title',
      error: 'Title is required',
      data
    })
  }

  if (!data.author) {
    errors.push({
      row,
      field: 'author',
      error: 'Author is required',
      data
    })
  }

  if (!data.format) {
    errors.push({
      row,
      field: 'format',
      error: 'Format is required',
      data
    })
  }

  // Numeric field validation
  if (typeof data.rrp !== 'number' || data.rrp <= 0) {
    errors.push({
      row,
      field: 'rrp',
      error: 'RRP must be a positive number',
      data
    })
  }

  if (typeof data.unitCost !== 'number' || data.unitCost <= 0) {
    errors.push({
      row,
      field: 'unitCost',
      error: 'Unit cost must be a positive number',
      data
    })
  }

  // ISBN format validation
  if (data.isbn) {
    const cleanISBN = data.isbn.replace(/[-\s]/g, '')
    if (!/^\d+$/.test(cleanISBN) || (cleanISBN.length !== 10 && cleanISBN.length !== 13)) {
      errors.push({
        row,
        isbn: data.isbn,
        field: 'isbn',
        error: 'ISBN must be 10 or 13 digits',
        data
      })
    }
  }

  // Format enum validation
  if (data.format && !['HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK'].includes(data.format)) {
    errors.push({
      row,
      field: 'format',
      error: 'Format must be one of: HARDCOVER, PAPERBACK, DIGITAL, AUDIOBOOK',
      data
    })
  }

  // Status enum validation
  if (data.status && !['ACTIVE', 'DISCONTINUED', 'PRE_ORDER'].includes(data.status)) {
    errors.push({
      row,
      field: 'status',
      error: 'Status must be one of: ACTIVE, DISCONTINUED, PRE_ORDER',
      data
    })
  }

  // Optional numeric field validation
  if (data.pageCount !== undefined && (typeof data.pageCount !== 'number' || data.pageCount <= 0)) {
    errors.push({
      row,
      field: 'pageCount',
      error: 'Page count must be a positive number',
      data
    })
  }

  if (data.weight !== undefined && (typeof data.weight !== 'number' || data.weight <= 0)) {
    errors.push({
      row,
      field: 'weight',
      error: 'Weight must be a positive number',
      data
    })
  }

  if (data.tradeDiscount !== undefined && (typeof data.tradeDiscount !== 'number' || data.tradeDiscount < 0 || data.tradeDiscount > 100)) {
    errors.push({
      row,
      field: 'tradeDiscount',
      error: 'Trade discount must be between 0 and 100',
      data
    })
  }

  if (data.royaltyRate !== undefined && (typeof data.royaltyRate !== 'number' || data.royaltyRate < 0 || data.royaltyRate > 100)) {
    errors.push({
      row,
      field: 'royaltyRate',
      error: 'Royalty rate must be between 0 and 100',
      data
    })
  }

  // Date validation
  if (data.publicationDate) {
    const date = new Date(data.publicationDate)
    if (isNaN(date.getTime())) {
      errors.push({
        row,
        field: 'publicationDate',
        error: 'Invalid publication date format',
        data
      })
    }
  }

  return errors
}

function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '')
}

function sanitizeTitleData(data: TitleImportData): any {
  const sanitized: any = {
    isbn: normalizeISBN(data.isbn),
    title: data.title?.trim(),
    author: data.author?.trim(),
    format: data.format as Format,
    rrp: data.rrp,
    unitCost: data.unitCost
  }

  // Optional fields
  if (data.pageCount) sanitized.pageCount = data.pageCount
  if (data.publicationDate) sanitized.publicationDate = new Date(data.publicationDate)
  if (data.publisher) sanitized.publisher = data.publisher.trim()
  if (data.category) sanitized.category = data.category.trim()
  if (data.subcategory) sanitized.subcategory = data.subcategory.trim()
  if (data.dimensions) sanitized.dimensions = data.dimensions.trim()
  if (data.weight) sanitized.weight = data.weight
  if (data.bindingType) sanitized.bindingType = data.bindingType.trim()
  if (data.coverFinish) sanitized.coverFinish = data.coverFinish.trim()
  if (data.tradeDiscount) sanitized.tradeDiscount = data.tradeDiscount
  if (data.royaltyRate) sanitized.royaltyRate = data.royaltyRate
  if (data.royaltyThreshold) sanitized.royaltyThreshold = data.royaltyThreshold
  if (data.printRunSize) sanitized.printRunSize = data.printRunSize
  if (data.reprintThreshold) sanitized.reprintThreshold = data.reprintThreshold
  if (data.description) sanitized.description = data.description.trim()
  if (data.keywords) sanitized.keywords = data.keywords.trim()
  if (data.language) sanitized.language = data.language.trim()
  if (data.territoryRights) sanitized.territoryRights = data.territoryRights.trim()
  if (data.seriesId) sanitized.seriesId = data.seriesId
  if (data.status) sanitized.status = data.status as TitleStatus

  return sanitized
}

// CSV parsing functions
export function parseCSV(csvContent: string): TitleImportData[] {
  try {
    const records = parseCSV(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Convert numeric fields
        if (['rrp', 'unitCost', 'pageCount', 'weight', 'tradeDiscount', 'royaltyRate', 'royaltyThreshold', 'printRunSize', 'reprintThreshold', 'seriesId'].includes(context.column as string)) {
          const num = parseFloat(value)
          return isNaN(num) ? value : num
        }
        return value
      }
    })

    return records as TitleImportData[]
  } catch (error) {
    throw new Error(`CSV parsing error: ${error.message}`)
  }
}

// Main import functions
export async function createImportJob(
  data: TitleImportData[],
  options: ImportOptions = {}
): Promise<string> {
  const jobId = generateJobId()
  const startTime = new Date()

  const job: ImportJob = {
    id: jobId,
    status: 'pending',
    progress: 0,
    summary: {
      total: data.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      startTime
    },
    errors: [],
    created: [],
    options: {
      batchSize: 50,
      continueOnError: true,
      validateFirst: true,
      ...options
    },
    createdAt: startTime,
    updatedAt: startTime
  }

  jobs.set(jobId, job)

  // Start processing asynchronously
  processImportJob(jobId, data).catch(error => {
    const job = jobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.errors.push({
        row: -1,
        error: `Import job failed: ${error.message}`,
        data: null
      })
      job.updatedAt = new Date()
    }
  })

  return jobId
}

async function processImportJob(jobId: string, data: TitleImportData[]): Promise<void> {
  const job = jobs.get(jobId)
  if (!job) throw new Error('Job not found')

  try {
    job.status = 'processing'
    job.updatedAt = new Date()

    const { options } = job
    let processedCount = 0

    // Validation phase
    if (options.validateFirst) {
      for (let i = 0; i < data.length; i++) {
        const validationErrors = validateTitleData(data[i], i + 1)
        if (validationErrors.length > 0) {
          job.errors.push(...validationErrors)
          job.summary.failed++

          if (!options.continueOnError) {
            job.status = 'failed'
            job.summary.endTime = new Date()
            job.summary.duration = job.summary.endTime.getTime() - job.summary.startTime.getTime()
            job.updatedAt = new Date()
            return
          }
        }
      }
    }

    // Filter out invalid records if continuing on error
    const validData = options.continueOnError
      ? data.filter((_, index) => !job.errors.find(error => error.row === index + 1))
      : data

    if (options.dryRun) {
      job.summary.successful = validData.length
      job.summary.total = data.length
      job.status = 'completed'
      job.progress = 100
      job.summary.endTime = new Date()
      job.summary.duration = job.summary.endTime.getTime() - job.summary.startTime.getTime()
      job.updatedAt = new Date()
      return
    }

    // Process in batches
    const batchSize = options.batchSize || 50
    const batches = []
    for (let i = 0; i < validData.length; i += batchSize) {
      batches.push(validData.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      if (options.useTransaction) {
        // Process entire batch as single transaction
        try {
          const sanitizedBatch = batch.map(sanitizeTitleData)
          const created = await dbClient.$transaction(
            sanitizedBatch.map(data => dbClient.title.create({ data }))
          )
          job.created.push(...created)
          job.summary.successful += created.length
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // Handle unique constraint violation
            job.errors.push({
              row: -1,
              error: `Batch failed due to duplicate ISBN in transaction`,
              data: batch
            })
            job.summary.failed += batch.length
          } else {
            job.errors.push({
              row: -1,
              error: `Batch transaction failed: ${error.message}`,
              data: batch
            })
            job.summary.failed += batch.length
          }

          if (!options.continueOnError) {
            throw error
          }
        }
      } else {
        // Process each item individually
        for (let i = 0; i < batch.length; i++) {
          const item = batch[i]
          const originalIndex = data.findIndex(d => d.isbn === item.isbn && d.title === item.title)

          try {
            // Check for duplicates if skipDuplicates is enabled
            if (options.skipDuplicates) {
              const existing = await dbClient.title.findUnique({
                where: { isbn: normalizeISBN(item.isbn) }
              })

              if (existing) {
                if (options.updateExisting) {
                  const updated = await dbClient.title.update({
                    where: { isbn: normalizeISBN(item.isbn) },
                    data: sanitizeTitleData(item)
                  })
                  job.created.push(updated)
                  job.summary.successful++
                } else {
                  job.summary.skipped++
                }
                continue
              }
            }

            const sanitized = sanitizeTitleData(item)
            const created = await dbClient.title.create({ data: sanitized })
            job.created.push(created)
            job.summary.successful++
          } catch (error) {
            const importError: ImportError = {
              row: originalIndex + 1,
              isbn: item.isbn,
              title: item.title,
              error: error.message,
              data: item
            }

            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              importError.error = `Duplicate ISBN: ${item.isbn}`
            }

            job.errors.push(importError)
            job.summary.failed++

            if (!options.continueOnError) {
              throw error
            }
          }

          processedCount++
          job.progress = Math.round((processedCount / validData.length) * 100)
          job.updatedAt = new Date()
        }
      }

      // Update progress after each batch
      if (options.useTransaction) {
        processedCount += batch.length
        job.progress = Math.round((processedCount / validData.length) * 100)
        job.updatedAt = new Date()
      }
    }

    job.status = 'completed'
    job.progress = 100
    job.summary.endTime = new Date()
    job.summary.duration = job.summary.endTime.getTime() - job.summary.startTime.getTime()
    job.updatedAt = new Date()

  } catch (error) {
    job.status = 'failed'
    job.summary.endTime = new Date()
    job.summary.duration = job.summary.endTime.getTime() - job.summary.startTime.getTime()
    job.updatedAt = new Date()
    throw error
  }
}

// Job management functions
export function getImportJob(jobId: string): ImportJob | undefined {
  return jobs.get(jobId)
}

export function getAllImportJobs(): ImportJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function cancelImportJob(jobId: string): Promise<boolean> {
  const job = jobs.get(jobId)
  if (!job) return false

  if (job.status === 'pending' || job.status === 'processing') {
    job.status = 'cancelled'
    job.summary.endTime = new Date()
    job.summary.duration = job.summary.endTime.getTime() - job.summary.startTime.getTime()
    job.updatedAt = new Date()
    return true
  }

  return false
}

export async function retryImportJob(jobId: string): Promise<string> {
  const originalJob = jobs.get(jobId)
  if (!originalJob) throw new Error('Job not found')

  // Extract original data from errors and created items
  const originalData: TitleImportData[] = [
    ...originalJob.created.map(title => ({
      isbn: title.isbn,
      title: title.title,
      author: title.author,
      format: title.format,
      rrp: Number(title.rrp),
      unitCost: Number(title.unitCost),
      // Add other fields as needed
    })),
    ...originalJob.errors.map(error => error.data).filter(Boolean)
  ]

  // Only retry failed items
  const failedData = originalJob.errors.map(error => error.data).filter(Boolean)

  return createImportJob(failedData, originalJob.options)
}

export async function rollbackImportJob(jobId: string): Promise<boolean> {
  const job = jobs.get(jobId)
  if (!job || job.created.length === 0) return false

  try {
    const titleIds = job.created.map(title => title.id)

    // Delete created titles in transaction
    await dbClient.$transaction([
      dbClient.title.deleteMany({
        where: {
          id: { in: titleIds }
        }
      })
    ])

    // Update job status
    job.status = 'cancelled'
    job.created = []
    job.summary.successful = 0
    job.updatedAt = new Date()

    return true
  } catch (error) {
    console.error('Rollback failed:', error)
    return false
  }
}

// Utility functions
function generateJobId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getImportTemplate(): string {
  const headers = [
    'isbn',
    'title',
    'author',
    'format',
    'rrp',
    'unitCost',
    'pageCount',
    'publicationDate',
    'publisher',
    'category',
    'subcategory',
    'dimensions',
    'weight',
    'bindingType',
    'coverFinish',
    'tradeDiscount',
    'royaltyRate',
    'royaltyThreshold',
    'printRunSize',
    'reprintThreshold',
    'description',
    'keywords',
    'language',
    'territoryRights',
    'seriesId',
    'seriesName',
    'status'
  ]

  const sampleData = [
    '9781234567890',
    'Sample Book Title',
    'Sample Author',
    'PAPERBACK',
    '19.99',
    '5.50',
    '320',
    '2024-01-15',
    'Sample Publisher',
    'Fiction',
    'Science Fiction',
    '198x129x20',
    '350',
    'Perfect bound',
    'Gloss',
    '40.0',
    '12.5',
    '1500',
    '2500',
    '500',
    'A sample book description',
    'sample, book, fiction',
    'en-GB',
    'UK, Ireland',
    '',
    'Sample Series',
    'ACTIVE'
  ]

  return [headers.join(','), sampleData.join(',')].join('\n')
}

// Series lookup and creation
export async function createOrFindSeries(seriesName: string): Promise<number> {
  const existing = await dbClient.series.findUnique({
    where: { name: seriesName }
  })

  if (existing) {
    return existing.id
  }

  const created = await dbClient.series.create({
    data: { name: seriesName }
  })

  return created.id
}