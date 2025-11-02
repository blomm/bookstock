'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { UserMenu } from '@/components/auth/user-menu'
import { format } from 'date-fns'
import { MovementType } from '@prisma/client'

/**
 * Stock Movements History Page
 *
 * Displays paginated history of all stock movements with filters.
 * Features:
 * - Filter by title, warehouse, movement type
 * - Date range filtering
 * - Pagination
 * - Movement details display
 */

interface StockMovement {
  id: number
  titleId: number
  warehouseId: number
  movementType: MovementType
  quantity: number
  movementDate: string
  referenceNumber: string | null
  notes: string | null
  createdBy: string | null
  title: {
    id: number
    isbn: string
    title: string
    author: string
  }
  warehouse: {
    id: number
    name: string
    code: string
  }
  sourceWarehouseId: number | null
  destinationWarehouseId: number | null
}

interface StockMovementsResponse {
  data: StockMovement[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch movements')
  }
  return res.json()
}

export default function StockMovementsPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  // State for filters and pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [titleFilter, setTitleFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Build query string
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })

    if (titleFilter) params.set('titleId', titleFilter)
    if (warehouseFilter) params.set('warehouseId', warehouseFilter)
    if (movementTypeFilter) params.set('movementType', movementTypeFilter)
    if (dateFrom) params.set('startDate', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    return params.toString()
  }, [page, limit, titleFilter, warehouseFilter, movementTypeFilter, dateFrom, dateTo])

  // Fetch movements with SWR
  const { data, error, isLoading } = useSWR<StockMovementsResponse>(
    isSignedIn ? `/api/stock-movements?${queryParams}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  )

  // Fetch titles and warehouses for filters
  const { data: titlesData } = useSWR(
    isSignedIn ? '/api/titles?limit=1000' : null,
    fetcher
  )
  const { data: warehousesData } = useSWR(
    isSignedIn ? '/api/warehouses' : null,
    fetcher
  )

  // Redirect to sign-in if not authenticated
  if (isLoaded && !isSignedIn) {
    router.push('/sign-in')
    return null
  }

  // Format movement type for display
  const formatMovementType = (type: MovementType) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  // Get badge color for movement type
  const getMovementBadgeColor = (type: MovementType) => {
    const inboundTypes = ['PRINT_RECEIVED', 'REPRINT']
    const outboundTypes = ['ONLINE_SALES', 'UK_TRADE_SALES', 'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES']
    const negativeTypes = ['DAMAGED', 'PULPED']

    if (inboundTypes.includes(type)) {
      return 'bg-green-100 text-green-800'
    } else if (outboundTypes.includes(type)) {
      return 'bg-blue-100 text-blue-800'
    } else if (negativeTypes.includes(type)) {
      return 'bg-red-100 text-red-800'
    } else if (type === 'WAREHOUSE_TRANSFER') {
      return 'bg-purple-100 text-purple-800'
    } else if (type === 'STOCK_ADJUSTMENT') {
      return 'bg-yellow-100 text-yellow-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading movements...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">Failed to load stock movements</p>
          </div>
        </main>
      </div>
    )
  }

  const movements = data?.data || []
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
  const titles = titlesData?.data || []
  const warehouses = warehousesData?.data || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
              <p className="text-sm text-gray-500 mt-1">
                History of all inventory transactions
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/inventory')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Title Filter */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <select
                id="title"
                value={titleFilter}
                onChange={(e) => {
                  setTitleFilter(e.target.value)
                  setPage(1)
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">All Titles</option>
                {titles.map((title: any) => (
                  <option key={title.id} value={title.id}>
                    {title.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Filter */}
            <div>
              <label htmlFor="warehouse" className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse
              </label>
              <select
                id="warehouse"
                value={warehouseFilter}
                onChange={(e) => {
                  setWarehouseFilter(e.target.value)
                  setPage(1)
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Type Filter */}
            <div>
              <label htmlFor="movementType" className="block text-sm font-medium text-gray-700 mb-1">
                Movement Type
              </label>
              <select
                id="movementType"
                value={movementTypeFilter}
                onChange={(e) => {
                  setMovementTypeFilter(e.target.value as MovementType | '')
                  setPage(1)
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">All Types</option>
                <optgroup label="Inbound">
                  <option value="PRINT_RECEIVED">Print Received</option>
                  <option value="REPRINT">Reprint</option>
                </optgroup>
                <optgroup label="Sales">
                  <option value="ONLINE_SALES">Online Sales</option>
                  <option value="UK_TRADE_SALES">UK Trade Sales</option>
                  <option value="US_TRADE_SALES">US Trade Sales</option>
                  <option value="ROW_TRADE_SALES">ROW Trade Sales</option>
                  <option value="DIRECT_SALES">Direct Sales</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="WAREHOUSE_TRANSFER">Warehouse Transfer</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="PULPED">Pulped</option>
                  <option value="FREE_COPIES">Free Copies</option>
                  <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
                </optgroup>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(titleFilter || warehouseFilter || movementTypeFilter || dateFrom || dateTo) && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setTitleFilter('')
                  setWarehouseFilter('')
                  setMovementTypeFilter('')
                  setDateFrom('')
                  setDateTo('')
                  setPage(1)
                }}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{movements.length}</span> of{' '}
            <span className="font-medium">{pagination.total}</span> movements
          </p>
        </div>

        {/* Movements Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {movements.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No movements found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Warehouse
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(movement.movementDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMovementBadgeColor(movement.movementType)}`}>
                          {formatMovementType(movement.movementType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{movement.title.title}</div>
                        <div className="text-sm text-gray-500">{movement.title.isbn}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {movement.warehouse.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {movement.referenceNumber || '-'}
                        {movement.notes && (
                          <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">
                            {movement.notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
