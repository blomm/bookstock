'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Papa from 'papaparse'
import { useDropzone } from 'react-dropzone'
import { CreateTitleInput } from '@/lib/validators/title'
import { Format } from '@prisma/client'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { UserMenu } from '@/components/auth/user-menu'

/**
 * Bulk Import Page
 *
 * Allows users to import multiple titles via CSV file upload.
 * Features:
 * - CSV file upload with drag-and-drop
 * - CSV template download
 * - Client-side CSV parsing and validation
 * - Preview table for parsed data
 * - Validation checks before import
 * - Import progress indicator
 * - Results summary with error details
 * - Retry failed imports
 */

type ImportStatus = 'idle' | 'parsing' | 'validating' | 'importing' | 'complete' | 'error'

interface ParsedTitle extends Partial<CreateTitleInput> {
  _rowNumber: number
  _errors?: string[]
}

interface ImportResult {
  success: boolean
  titleId?: number
  isbn: string
  title: string
  error?: string
  rowNumber: number
}

interface ImportSummary {
  total: number
  successful: number
  failed: number
  results: ImportResult[]
}

// CSV Template structure
const CSV_TEMPLATE_HEADERS = [
  'isbn',
  'title',
  'author',
  'format',
  'rrp',
  'unitCost',
  'publisher',
  'publicationDate',
  'pageCount',
  'description',
  'category',
  'subcategory',
  'seriesId',
  'dimensions',
  'weight',
  'binding',
  'coverFinish',
  'tradeDiscount',
  'royaltyRate',
  'royaltyThreshold',
  'printRunSize',
  'reprintThreshold',
  'territoryRights',
]

export default function BulkImportPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  const [status, setStatus] = useState<ImportStatus>('idle')
  const [parsedTitles, setParsedTitles] = useState<ParsedTitle[]>([])
  const [validTitles, setValidTitles] = useState<CreateTitleInput[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // Handle CSV file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setStatus('parsing')
    setParseError(null)
    setParsedTitles([])
    setValidTitles([])
    setImportSummary(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = results.data.map((row, index) => {
            const rowNumber = index + 2 // +2 because: +1 for 0-index, +1 for header row

            return {
              _rowNumber: rowNumber,
              isbn: row.isbn?.trim(),
              title: row.title?.trim(),
              author: row.author?.trim(),
              format: row.format?.trim().toUpperCase() as Format,
              rrp: row.rrp ? parseFloat(row.rrp) : undefined,
              unitCost: row.unitCost ? parseFloat(row.unitCost) : undefined,
              publisher: row.publisher?.trim() || undefined,
              publicationDate: row.publicationDate ? new Date(row.publicationDate) : undefined,
              pageCount: row.pageCount ? parseInt(row.pageCount) : undefined,
              description: row.description?.trim() || undefined,
              category: row.category?.trim() || undefined,
              subcategory: row.subcategory?.trim() || undefined,
              seriesId: row.seriesId ? parseInt(row.seriesId) : undefined,
              dimensions: row.dimensions?.trim() || undefined,
              weight: row.weight ? parseFloat(row.weight) : undefined,
              binding: row.binding?.trim() || undefined,
              coverFinish: row.coverFinish?.trim() || undefined,
              tradeDiscount: row.tradeDiscount ? parseFloat(row.tradeDiscount) : undefined,
              royaltyRate: row.royaltyRate ? parseFloat(row.royaltyRate) : undefined,
              royaltyThreshold: row.royaltyThreshold ? parseInt(row.royaltyThreshold) : undefined,
              printRunSize: row.printRunSize ? parseInt(row.printRunSize) : undefined,
              reprintThreshold: row.reprintThreshold ? parseInt(row.reprintThreshold) : undefined,
              territoryRights: row.territoryRights?.trim() || undefined,
            } as ParsedTitle
          })

          setParsedTitles(parsed)
          setStatus('validating')
          validateParsedTitles(parsed)
        } catch (error) {
          setParseError('Failed to parse CSV file. Please check the format.')
          setStatus('error')
        }
      },
      error: (error) => {
        setParseError(`CSV parsing error: ${error.message}`)
        setStatus('error')
      },
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: false,
  })

  // Validate parsed titles
  const validateParsedTitles = async (titles: ParsedTitle[]) => {
    const valid: CreateTitleInput[] = []
    const titlesWithErrors = titles.map(title => {
      const errors: string[] = []

      // Basic required field validation
      if (!title.isbn) errors.push('ISBN is required')
      if (!title.title) errors.push('Title is required')
      if (!title.author) errors.push('Author is required')
      if (!title.format || !['PAPERBACK', 'HARDCOVER', 'DIGITAL', 'AUDIOBOOK'].includes(title.format)) {
        errors.push('Format must be PAPERBACK, HARDCOVER, DIGITAL, or AUDIOBOOK')
      }
      if (!title.rrp || title.rrp <= 0) errors.push('RRP must be a positive number')
      if (!title.unitCost || title.unitCost <= 0) errors.push('Unit cost must be a positive number')

      // Business rules
      if (title.rrp && title.unitCost && title.rrp <= title.unitCost) {
        errors.push('RRP must be higher than unit cost')
      }

      if (errors.length === 0) {
        // Remove internal fields before adding to valid titles
        const { _rowNumber, _errors, ...titleData } = title
        valid.push(titleData as CreateTitleInput)
      }

      return {
        ...title,
        _errors: errors.length > 0 ? errors : undefined,
      }
    })

    setParsedTitles(titlesWithErrors)
    setValidTitles(valid)
    setStatus('idle')
  }

  // Handle import
  const handleImport = async () => {
    if (validTitles.length === 0) return

    setStatus('importing')
    setImportProgress(0)

    try {
      const response = await fetch('/api/titles/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ titles: validTitles }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      // Map results back to include row numbers
      const results: ImportResult[] = data.results.map((result: any) => {
        const originalTitle = parsedTitles.find(t => t.isbn === result.isbn)
        return {
          ...result,
          rowNumber: originalTitle?._rowNumber || 0,
        }
      })

      const summary: ImportSummary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }

      setImportSummary(summary)
      setStatus('complete')
      setImportProgress(100)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Import failed')
      setStatus('error')
    }
  }

  // Handle retry failed imports
  const handleRetryFailed = () => {
    if (!importSummary) return

    const failedTitles = importSummary.results
      .filter(r => !r.success)
      .map(r => {
        const original = parsedTitles.find(t => t.isbn === r.isbn)
        if (!original) return null
        const { _rowNumber, _errors, ...titleData } = original
        return titleData as CreateTitleInput
      })
      .filter(Boolean) as CreateTitleInput[]

    setValidTitles(failedTitles)
    setImportSummary(null)
    setStatus('idle')
  }

  // Download CSV template
  const downloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(','),
      // Example row
      '978-0-123456-78-9,Example Book Title,John Doe,PAPERBACK,29.99,12.50,Example Publisher,2024-01-01,350,An example book description,Fiction,Fantasy,1,210x148x25,450,Perfect Bound,Matte,40,10,1000,5000,500,World',
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'title-import-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Download error report
  const downloadErrorReport = () => {
    if (!importSummary) return

    const failedResults = importSummary.results.filter(r => !r.success)
    const csvContent = [
      'Row,ISBN,Title,Error',
      ...failedResults.map(r => `${r.rowNumber},"${r.isbn}","${r.title}","${r.error}"`),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-errors.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!isSignedIn) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in</div>
  }

  return (
    <PermissionGuard permission="title:create">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bulk Import Titles</h1>
              <p className="text-sm text-gray-600 mt-1">Upload a CSV file to import multiple titles at once</p>
            </div>
            <UserMenu />
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Download CSV Template
            </button>
            <button
              onClick={() => router.push('/titles')}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Back to Titles
            </button>
          </div>

          {/* File Upload */}
          {status === 'idle' && parsedTitles.length === 0 && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-4 text-lg text-gray-900">
                {isDragActive ? 'Drop the CSV file here' : 'Drag and drop a CSV file here, or click to select'}
              </p>
              <p className="mt-2 text-sm text-gray-500">CSV files only</p>
            </div>
          )}

          {/* Parsing Status */}
          {status === 'parsing' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-700">Parsing CSV file...</p>
            </div>
          )}

          {/* Validation Status */}
          {status === 'validating' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-700">Validating titles...</p>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="mt-1 text-sm text-red-700">{parseError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedTitles.length > 0 && status !== 'importing' && status !== 'complete' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Preview ({parsedTitles.length} titles)</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {validTitles.length} valid, {parsedTitles.length - validTitles.length} with errors
                </p>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Format</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RRP</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedTitles.slice(0, 10).map((title, index) => (
                      <tr key={index} className={title._errors ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{title._rowNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{title.isbn}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{title.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{title.author}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{title.format}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${title.rrp?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {title._errors ? (
                            <div>
                              <span className="text-red-600 font-medium">Invalid</span>
                              <ul className="mt-1 text-xs text-red-600">
                                {title._errors.map((error, i) => (
                                  <li key={i}>• {error}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <span className="text-green-600 font-medium">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedTitles.length > 10 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                  Showing first 10 of {parsedTitles.length} titles
                </div>
              )}

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                <button
                  onClick={() => {
                    setParsedTitles([])
                    setValidTitles([])
                    setStatus('idle')
                  }}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={validTitles.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Import {validTitles.length} Title{validTitles.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {status === 'importing' && (
            <div className="bg-white rounded-lg p-8">
              <div className="text-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-700">Importing titles...</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-center mt-2 text-sm text-gray-600">{importProgress}%</p>
            </div>
          )}

          {/* Results Summary */}
          {status === 'complete' && importSummary && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-medium text-gray-500">Total Processed</h3>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{importSummary.total}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
                  <h3 className="text-sm font-medium text-green-600">Successful</h3>
                  <p className="mt-2 text-3xl font-bold text-green-600">{importSummary.successful}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
                  <h3 className="text-sm font-medium text-red-600">Failed</h3>
                  <p className="mt-2 text-3xl font-bold text-red-600">{importSummary.failed}</p>
                </div>
              </div>

              {/* Error Details */}
              {importSummary.failed > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-red-50 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-red-900">Failed Imports</h2>
                      <p className="text-sm text-red-700 mt-1">{importSummary.failed} titles failed to import</p>
                    </div>
                    <button
                      onClick={downloadErrorReport}
                      className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Download Error Report
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {importSummary.results
                          .filter(r => !r.success)
                          .map((result, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.rowNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.isbn}</td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{result.title}</td>
                              <td className="px-6 py-4 text-sm text-red-600">{result.error}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                {importSummary.failed > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                  >
                    Retry Failed Imports
                  </button>
                )}
                <button
                  onClick={() => {
                    setParsedTitles([])
                    setValidTitles([])
                    setImportSummary(null)
                    setStatus('idle')
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Import More Titles
                </button>
                <button
                  onClick={() => router.push('/titles')}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Back to Titles
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </PermissionGuard>
  )
}
