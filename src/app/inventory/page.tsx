'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { UserMenu } from '@/components/auth/user-menu'
import { StockMovementModal } from '@/components/inventory/StockMovementModal'
import { QuickStockAdjustmentModal } from '@/components/inventory/QuickStockAdjustmentModal'
import { LowStockAlerts } from '@/components/inventory/LowStockAlerts'

/**
 * Inventory Dashboard Page
 *
 * Displays real-time inventory levels across multiple warehouses.
 * Features:
 * - Filter by warehouse
 * - Search by title or ISBN
 * - Low stock indicators with badges
 * - Quick stock adjustment modal
 * - Real-time updates after movements
 */

interface InventoryItem {
  id: number
  titleId: number
  warehouseId: number
  currentStock: number
  reservedStock: number
  availableStock: number
  isLowStock: boolean
  lastMovementDate: string | null
  title: {
    id: number
    isbn: string
    title: string
    author: string
    lowStockThreshold: number | null
  }
  warehouse: {
    id: number
    name: string
    code: string
  }
}

interface InventoryDashboardResponse {
  data: InventoryItem[]
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('Failed to fetch inventory')
    throw error
  }
  return res.json()
}

export default function InventoryDashboardPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  // State for filters
  const [warehouseFilter, setWarehouseFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [showQuickAdjustModal, setShowQuickAdjustModal] = useState(false)
  const [quickAdjustData, setQuickAdjustData] = useState<{
    titleId: number
    titleName: string
    titleIsbn: string
    warehouseId: number
    warehouseName: string
    currentStock: number
  } | null>(null)

  // Debounce search input
  const debounceTimeout = useMemo(() => {
    let timeout: NodeJS.Timeout
    return (value: string) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        setDebouncedSearch(value)
      }, 300)
    }
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    debounceTimeout(value)
  }, [debounceTimeout])

  // Build query string
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (warehouseFilter) params.set('warehouseId', warehouseFilter)
    return params.toString()
  }, [warehouseFilter])

  // Fetch inventory with SWR
  const { data, error, isLoading } = useSWR<InventoryDashboardResponse>(
    isSignedIn ? `/api/inventory/dashboard?${queryParams}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  )

  // Fetch warehouses for filter dropdown
  const { data: warehousesData } = useSWR(
    isSignedIn ? '/api/warehouses' : null,
    fetcher
  )

  // Redirect to sign-in if not authenticated
  if (isLoaded && !isSignedIn) {
    router.push('/sign-in')
    return null
  }

  // Filter inventory client-side for search and low stock
  const filteredInventory = useMemo(() => {
    if (!data?.data) return []

    let filtered = data.data

    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.title.toLowerCase().includes(searchLower) ||
        item.title.author.toLowerCase().includes(searchLower) ||
        item.title.isbn.toLowerCase().includes(searchLower)
      )
    }

    // Apply low stock filter
    if (showLowStockOnly) {
      filtered = filtered.filter(item => item.isLowStock)
    }

    return filtered
  }, [data, debouncedSearch, showLowStockOnly])

  // Group inventory by title for better display
  const groupedInventory = useMemo(() => {
    const groups = new Map<number, {
      title: InventoryItem['title']
      warehouses: Array<{
        warehouse: InventoryItem['warehouse']
        currentStock: number
        reservedStock: number
        availableStock: number
        isLowStock: boolean
        inventoryId: number
      }>
      totalStock: number
      hasLowStock: boolean
    }>()

    filteredInventory.forEach(item => {
      if (!groups.has(item.titleId)) {
        groups.set(item.titleId, {
          title: item.title,
          warehouses: [],
          totalStock: 0,
          hasLowStock: false
        })
      }

      const group = groups.get(item.titleId)!
      group.warehouses.push({
        warehouse: item.warehouse,
        currentStock: item.currentStock,
        reservedStock: item.reservedStock,
        availableStock: item.availableStock,
        isLowStock: item.isLowStock,
        inventoryId: item.id
      })
      group.totalStock += item.currentStock
      if (item.isLowStock) group.hasLowStock = true
    })

    return Array.from(groups.values())
  }, [filteredInventory])

  const handleMovementSuccess = () => {
    // Revalidate inventory data
    mutate(`/api/inventory/dashboard?${queryParams}`)
    setShowMovementModal(false)
    setSelectedItem(null)
  }

  const handleQuickAdjustSuccess = () => {
    // Revalidate inventory data
    mutate(`/api/inventory/dashboard?${queryParams}`)
    setShowQuickAdjustModal(false)
    setQuickAdjustData(null)
  }

  const openQuickAdjust = (
    titleId: number,
    titleName: string,
    titleIsbn: string,
    warehouseId: number,
    warehouseName: string,
    currentStock: number
  ) => {
    setQuickAdjustData({
      titleId,
      titleName,
      titleIsbn,
      warehouseId,
      warehouseName,
      currentStock,
    })
    setShowQuickAdjustModal(true)
  }

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading inventory...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading inventory</h3>
                <p className="text-sm text-red-700 mt-2">
                  {error.message || 'An unexpected error occurred'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 text-sm font-medium text-red-800 hover:text-red-900 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const warehouses = warehousesData?.data || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time stock levels across warehouses
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <PermissionGuard requiredPermission="inventory:update">
                <button
                  onClick={() => router.push('/inventory/movements')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View Movements
                </button>
              </PermissionGuard>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Low Stock Alerts */}
        <LowStockAlerts />

        {/* Search and Filters */}
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Search */}
            <div className="sm:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Title, author, or ISBN..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            {/* Warehouse Filter */}
            <div>
              <label htmlFor="warehouse" className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse
              </label>
              <select
                id="warehouse"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle for Low Stock Only */}
          <div className="mt-4 flex items-center">
            <input
              id="low-stock-only"
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="low-stock-only" className="ml-2 block text-sm text-gray-900">
              Show only low stock items
            </label>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{groupedInventory.length}</span> titles
            {showLowStockOnly && ' with low stock'}
          </p>
        </div>

        {/* Inventory Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {groupedInventory.length === 0 ? (
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No inventory found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {debouncedSearch || warehouseFilter || showLowStockOnly
                  ? 'Try adjusting your search or filters'
                  : 'Start by adding inventory through stock movements'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ISBN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Stock
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Warehouse Breakdown
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedInventory.map((group) => (
                    <tr key={group.title.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{group.title.title}</div>
                        <div className="text-sm text-gray-500">{group.title.author}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {group.title.isbn}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{group.totalStock}</div>
                        {group.title.lowStockThreshold !== null && (
                          <div className="text-xs text-gray-500">Threshold: {group.title.lowStockThreshold}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {group.warehouses.map((wh) => (
                            <div
                              key={wh.warehouse.id}
                              className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${
                                wh.isLowStock
                                  ? 'bg-red-100 text-red-800'
                                  : wh.currentStock === 0
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              <span className="font-semibold">{wh.warehouse.code}:</span>
                              <span className="ml-1">{wh.currentStock}</span>
                              {wh.reservedStock > 0 && (
                                <span className="ml-1 text-xs opacity-75">({wh.availableStock} avail)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {group.hasLowStock ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Low Stock
                          </span>
                        ) : group.totalStock === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={() => router.push(`/titles/${group.title.id}`)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            View Details
                          </button>
                          <PermissionGuard requiredPermission="inventory:update">
                            <div className="flex flex-col gap-1">
                              {group.warehouses.map((wh) => (
                                <button
                                  key={wh.warehouse.id}
                                  onClick={() => openQuickAdjust(
                                    group.title.id,
                                    group.title.title,
                                    group.title.isbn,
                                    wh.warehouse.id,
                                    wh.warehouse.name,
                                    wh.currentStock
                                  )}
                                  className="text-xs text-gray-600 hover:text-gray-900 underline"
                                  title={`Quick adjust ${wh.warehouse.code}`}
                                >
                                  Adjust {wh.warehouse.code}
                                </button>
                              ))}
                            </div>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Stock Movement Modal */}
      {showMovementModal && selectedItem && (
        <StockMovementModal
          isOpen={showMovementModal}
          onClose={() => {
            setShowMovementModal(false)
            setSelectedItem(null)
          }}
          onSuccess={handleMovementSuccess}
          preselectedTitle={selectedItem.title.id}
          preselectedWarehouse={selectedItem.warehouseId}
        />
      )}

      {/* Quick Stock Adjustment Modal */}
      {showQuickAdjustModal && quickAdjustData && (
        <QuickStockAdjustmentModal
          isOpen={showQuickAdjustModal}
          onClose={() => {
            setShowQuickAdjustModal(false)
            setQuickAdjustData(null)
          }}
          onSuccess={handleQuickAdjustSuccess}
          titleId={quickAdjustData.titleId}
          titleName={quickAdjustData.titleName}
          titleIsbn={quickAdjustData.titleIsbn}
          warehouseId={quickAdjustData.warehouseId}
          warehouseName={quickAdjustData.warehouseName}
          currentStock={quickAdjustData.currentStock}
        />
      )}
    </div>
  )
}
