'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateStockMovementSchema, type CreateStockMovementInput, type MovementType } from '@/lib/validators/inventory'
import useSWR from 'swr'

/**
 * StockMovementModal Component
 *
 * Modal for recording stock movements with validation
 * Supports all movement types: PRINT_RECEIVED, REPRINT, SALES variants,
 * WAREHOUSE_TRANSFER, DAMAGED, FREE_COPIES, STOCK_ADJUSTMENT
 */

interface StockMovementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  preselectedTitle?: number
  preselectedWarehouse?: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function StockMovementModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedTitle,
  preselectedWarehouse,
}: StockMovementModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Fetch titles and warehouses for selectors
  const { data: titlesData } = useSWR('/api/titles?limit=1000', fetcher)
  const { data: warehousesData } = useSWR('/api/warehouses', fetcher)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CreateStockMovementInput>({
    resolver: zodResolver(CreateStockMovementSchema),
    defaultValues: {
      titleId: preselectedTitle,
      warehouseId: preselectedWarehouse,
      movementType: 'PRINT_RECEIVED' as MovementType,
      quantity: 0,
    },
  })

  const watchedMovementType = watch('movementType')
  const isTransfer = watchedMovementType === 'WAREHOUSE_TRANSFER'
  const isAdjustment = watchedMovementType === 'STOCK_ADJUSTMENT'

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset()
      setApiError(null)
    }
  }, [isOpen, reset])

  const onSubmit = async (data: CreateStockMovementInput) => {
    setIsSubmitting(true)
    setApiError(null)

    try {
      const response = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create stock movement')
      }

      onSuccess()
      reset()
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const titles = titlesData?.data || []
  const warehouses = warehousesData?.data || []

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Record Stock Movement
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* API Error */}
              {apiError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-800">{apiError}</p>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Movement Type */}
                <div>
                  <label htmlFor="movementType" className="block text-sm font-medium text-gray-700">
                    Movement Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="movementType"
                    {...register('movementType')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
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
                  {errors.movementType && (
                    <p className="mt-1 text-sm text-red-600">{errors.movementType.message}</p>
                  )}
                </div>

                {/* Title Selector */}
                <div>
                  <label htmlFor="titleId" className="block text-sm font-medium text-gray-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="titleId"
                    {...register('titleId', { valueAsNumber: true })}
                    disabled={!!preselectedTitle}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
                  >
                    <option value="">Select a title...</option>
                    {titles.map((title: any) => (
                      <option key={title.id} value={title.id}>
                        {title.title} - {title.isbn}
                      </option>
                    ))}
                  </select>
                  {errors.titleId && (
                    <p className="mt-1 text-sm text-red-600">{errors.titleId.message}</p>
                  )}
                </div>

                {/* Warehouse Selector (not for transfers) */}
                {!isTransfer && (
                  <div>
                    <label htmlFor="warehouseId" className="block text-sm font-medium text-gray-700">
                      Warehouse <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="warehouseId"
                      {...register('warehouseId', { valueAsNumber: true })}
                      disabled={!!preselectedWarehouse}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select a warehouse...</option>
                      {warehouses.map((warehouse: any) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                    {errors.warehouseId && (
                      <p className="mt-1 text-sm text-red-600">{errors.warehouseId.message}</p>
                    )}
                  </div>
                )}

                {/* Transfer-specific fields */}
                {isTransfer && (
                  <>
                    <div>
                      <label htmlFor="sourceWarehouseId" className="block text-sm font-medium text-gray-700">
                        Source Warehouse <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="sourceWarehouseId"
                        {...register('sourceWarehouseId', { valueAsNumber: true })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Select source warehouse...</option>
                        {warehouses.map((warehouse: any) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.code})
                          </option>
                        ))}
                      </select>
                      {errors.sourceWarehouseId && (
                        <p className="mt-1 text-sm text-red-600">{errors.sourceWarehouseId.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="destinationWarehouseId" className="block text-sm font-medium text-gray-700">
                        Destination Warehouse <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="destinationWarehouseId"
                        {...register('destinationWarehouseId', { valueAsNumber: true })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Select destination warehouse...</option>
                        {warehouses.map((warehouse: any) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.code})
                          </option>
                        ))}
                      </select>
                      {errors.destinationWarehouseId && (
                        <p className="mt-1 text-sm text-red-600">{errors.destinationWarehouseId.message}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Quantity */}
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    {...register('quantity', { valueAsNumber: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                  )}
                  {isAdjustment && (
                    <p className="mt-1 text-xs text-gray-500">
                      Use positive numbers to increase stock, negative to decrease
                    </p>
                  )}
                </div>

                {/* Reference Number */}
                <div>
                  <label htmlFor="referenceNumber" className="block text-sm font-medium text-gray-700">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    id="referenceNumber"
                    {...register('referenceNumber')}
                    placeholder="e.g., PO-12345, INV-67890"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.referenceNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.referenceNumber.message}</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notes {isAdjustment && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    id="notes"
                    {...register('notes')}
                    rows={3}
                    placeholder={isAdjustment ? 'Required: Explain the reason for this adjustment' : 'Optional notes about this movement'}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.notes && (
                    <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
                  )}
                  {isAdjustment && (
                    <p className="mt-1 text-xs text-gray-500">
                      Minimum 10 characters required for stock adjustments
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Recording...' : 'Record Movement'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
