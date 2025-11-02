'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

/**
 * QuickStockAdjustmentModal Component
 *
 * Simplified modal for quick stock adjustments directly from the inventory dashboard.
 * Pre-fills title and warehouse information, only requiring quantity and reason.
 */

const QuickAdjustmentSchema = z.object({
  quantity: z.number().int().refine((val) => val !== 0, {
    message: 'Quantity cannot be zero',
  }),
  notes: z.string().min(10, 'Please provide at least 10 characters explaining the adjustment'),
})

type QuickAdjustmentInput = z.infer<typeof QuickAdjustmentSchema>

interface QuickStockAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  titleId: number
  titleName: string
  titleIsbn: string
  warehouseId: number
  warehouseName: string
  currentStock: number
}

export function QuickStockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  titleId,
  titleName,
  titleIsbn,
  warehouseId,
  warehouseName,
  currentStock,
}: QuickStockAdjustmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<QuickAdjustmentInput>({
    resolver: zodResolver(QuickAdjustmentSchema),
    defaultValues: {
      quantity: 0,
      notes: '',
    },
  })

  const watchedQuantity = watch('quantity')
  const projectedStock = currentStock + (watchedQuantity || 0)

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset()
      setApiError(null)
    }
  }, [isOpen, reset])

  const onSubmit = async (data: QuickAdjustmentInput) => {
    setIsSubmitting(true)
    setApiError(null)

    try {
      const payload = {
        titleId,
        warehouseId,
        movementType: 'STOCK_ADJUSTMENT',
        quantity: data.quantity,
        notes: data.notes,
      }

      const response = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create stock adjustment')
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
                  Quick Stock Adjustment
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

              {/* Pre-filled Information */}
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Title Information</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Title:</span> {titleName}
                  </p>
                  <p>
                    <span className="font-medium">ISBN:</span> {titleIsbn}
                  </p>
                  <p>
                    <span className="font-medium">Warehouse:</span> {warehouseName}
                  </p>
                  <p>
                    <span className="font-medium">Current Stock:</span>{' '}
                    <span className="font-semibold text-gray-900">{currentStock} units</span>
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Quantity */}
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                    Adjustment Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    {...register('quantity', { valueAsNumber: true })}
                    placeholder="e.g., 10 or -5"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Use positive numbers to increase stock, negative to decrease
                  </p>
                </div>

                {/* Projected Stock Display */}
                {watchedQuantity !== 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm">
                      <span className="font-medium text-blue-900">Projected Stock:</span>{' '}
                      <span className={`font-semibold ${projectedStock < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {projectedStock} units
                      </span>
                    </p>
                    {projectedStock < 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Warning: This adjustment will result in negative stock
                      </p>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Reason for Adjustment <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="notes"
                    {...register('notes')}
                    rows={4}
                    placeholder="Please explain why this adjustment is necessary (minimum 10 characters)"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.notes && (
                    <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Examples: "Physical count discrepancy", "Damaged items found during inspection", "Returns processing"
                  </p>
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
                {isSubmitting ? 'Adjusting...' : 'Confirm Adjustment'}
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
