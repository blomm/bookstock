'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateTitleSchema, UpdateTitleSchema, type CreateTitleInput, type UpdateTitleInput } from '@/lib/validators/title'
import { Format } from '@prisma/client'
import { useState } from 'react'

/**
 * TitleForm Component
 *
 * A comprehensive form for creating and editing book titles.
 * Features:
 * - React Hook Form for state management
 * - Zod validation integration
 * - Organized into logical sections
 * - Field-level validation feedback
 * - Price change tracking for edits
 */

interface TitleFormProps {
  mode: 'create' | 'edit'
  defaultValues?: Partial<UpdateTitleInput>
  titleId?: number
  onSuccess?: (titleId: number) => void
  onCancel?: () => void
}

export function TitleForm({
  mode,
  defaultValues,
  titleId,
  onSuccess,
  onCancel,
}: TitleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showPriceChangeReason, setShowPriceChangeReason] = useState(false)

  // Determine which schema to use
  const schema = mode === 'create' ? CreateTitleSchema : UpdateTitleSchema

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateTitleInput | UpdateTitleInput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      format: 'PAPERBACK' as Format,
      language: 'en',
    },
  })

  // Watch price fields to show price change reason in edit mode
  const watchRrp = watch('rrp')
  const watchUnitCost = watch('unitCost')
  const watchTradeDiscount = watch('tradeDiscount')

  // Check if prices changed in edit mode
  if (mode === 'edit' && defaultValues) {
    const pricesChanged =
      (watchRrp && watchRrp !== defaultValues.rrp) ||
      (watchUnitCost && watchUnitCost !== defaultValues.unitCost) ||
      (watchTradeDiscount && watchTradeDiscount !== defaultValues.tradeDiscount)

    if (pricesChanged && !showPriceChangeReason) {
      setShowPriceChangeReason(true)
    } else if (!pricesChanged && showPriceChangeReason) {
      setShowPriceChangeReason(false)
    }
  }

  const onSubmit = async (data: CreateTitleInput | UpdateTitleInput) => {
    setIsSubmitting(true)
    setApiError(null)

    try {
      const url = mode === 'create' ? '/api/titles' : `/api/titles/${titleId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save title')
      }

      const result = await response.json()
      onSuccess?.(result.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* API Error Display */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error saving title</h3>
              <p className="text-sm text-red-700 mt-1">{apiError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Core Information Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Core Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* ISBN */}
          <div className="sm:col-span-2">
            <label htmlFor="isbn" className="block text-sm font-medium text-gray-700">
              ISBN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="isbn"
              {...register('isbn')}
              placeholder="978-1-234567-89-0"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${
                errors.isbn ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            />
            {errors.isbn && (
              <p className="mt-1 text-sm text-red-600">{errors.isbn.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Enter ISBN-10 or ISBN-13 with or without hyphens</p>
          </div>

          {/* Title */}
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              {...register('title')}
              placeholder="The Opinionated Guide to React"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${
                errors.title ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Author */}
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700">
              Author <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="author"
              {...register('author')}
              placeholder="Sara Drasner"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${
                errors.author ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            />
            {errors.author && (
              <p className="mt-1 text-sm text-red-600">{errors.author.message}</p>
            )}
          </div>

          {/* Format */}
          <div>
            <label htmlFor="format" className="block text-sm font-medium text-gray-700">
              Format <span className="text-red-500">*</span>
            </label>
            <select
              id="format"
              {...register('format')}
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${
                errors.format ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            >
              <option value="PAPERBACK">Paperback</option>
              <option value="HARDCOVER">Hardcover</option>
              <option value="DIGITAL">Digital</option>
              <option value="AUDIOBOOK">Audiobook</option>
            </select>
            {errors.format && (
              <p className="mt-1 text-sm text-red-600">{errors.format.message}</p>
            )}
          </div>

          {/* Publisher */}
          <div>
            <label htmlFor="publisher" className="block text-sm font-medium text-gray-700">
              Publisher
            </label>
            <input
              type="text"
              id="publisher"
              {...register('publisher')}
              placeholder="O'Reilly Media"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.publisher && (
              <p className="mt-1 text-sm text-red-600">{errors.publisher.message}</p>
            )}
          </div>

          {/* Publication Date */}
          <div>
            <label htmlFor="publicationDate" className="block text-sm font-medium text-gray-700">
              Publication Date
            </label>
            <input
              type="date"
              id="publicationDate"
              {...register('publicationDate')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.publicationDate && (
              <p className="mt-1 text-sm text-red-600">{errors.publicationDate.message}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <input
              type="text"
              id="category"
              {...register('category')}
              placeholder="Technology"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          {/* Subcategory */}
          <div>
            <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700">
              Subcategory
            </label>
            <input
              type="text"
              id="subcategory"
              {...register('subcategory')}
              placeholder="Web Development"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.subcategory && (
              <p className="mt-1 text-sm text-red-600">{errors.subcategory.message}</p>
            )}
          </div>

          {/* Page Count */}
          <div>
            <label htmlFor="pageCount" className="block text-sm font-medium text-gray-700">
              Page Count
            </label>
            <input
              type="number"
              id="pageCount"
              {...register('pageCount', { valueAsNumber: true })}
              placeholder="350"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.pageCount && (
              <p className="mt-1 text-sm text-red-600">{errors.pageCount.message}</p>
            )}
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700">
              Language
            </label>
            <input
              type="text"
              id="language"
              {...register('language')}
              placeholder="en"
              maxLength={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.language && (
              <p className="mt-1 text-sm text-red-600">{errors.language.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">2-letter ISO 639-1 code (e.g., en, fr, de)</p>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              {...register('description')}
              placeholder="A comprehensive guide to React best practices..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Keywords */}
          <div className="sm:col-span-2">
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
              Keywords
            </label>
            <input
              type="text"
              id="keywords"
              {...register('keywords')}
              placeholder="react, javascript, web development"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.keywords && (
              <p className="mt-1 text-sm text-red-600">{errors.keywords.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Comma-separated keywords</p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* RRP */}
          <div>
            <label htmlFor="rrp" className="block text-sm font-medium text-gray-700">
              RRP (Retail Price) <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="rrp"
                step="0.01"
                {...register('rrp', { valueAsNumber: true })}
                placeholder="29.99"
                className={`block w-full pl-7 pr-3 py-2 rounded-md shadow-sm sm:text-sm border ${
                  errors.rrp ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              />
            </div>
            {errors.rrp && (
              <p className="mt-1 text-sm text-red-600">{errors.rrp.message}</p>
            )}
          </div>

          {/* Unit Cost */}
          <div>
            <label htmlFor="unitCost" className="block text-sm font-medium text-gray-700">
              Unit Cost <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="unitCost"
                step="0.01"
                {...register('unitCost', { valueAsNumber: true })}
                placeholder="8.50"
                className={`block w-full pl-7 pr-3 py-2 rounded-md shadow-sm sm:text-sm border ${
                  errors.unitCost ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              />
            </div>
            {errors.unitCost && (
              <p className="mt-1 text-sm text-red-600">{errors.unitCost.message}</p>
            )}
          </div>

          {/* Trade Discount */}
          <div>
            <label htmlFor="tradeDiscount" className="block text-sm font-medium text-gray-700">
              Trade Discount
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="number"
                id="tradeDiscount"
                step="0.01"
                {...register('tradeDiscount', { valueAsNumber: true })}
                placeholder="40.00"
                className="block w-full pr-8 py-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 border"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">%</span>
              </div>
            </div>
            {errors.tradeDiscount && (
              <p className="mt-1 text-sm text-red-600">{errors.tradeDiscount.message}</p>
            )}
          </div>

          {/* Price Change Reason (only show in edit mode when prices changed) */}
          {mode === 'edit' && showPriceChangeReason && (
            <div className="sm:col-span-3">
              <label htmlFor="priceChangeReason" className="block text-sm font-medium text-gray-700">
                Price Change Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="priceChangeReason"
                {...register('priceChangeReason')}
                placeholder="Annual price review 2025"
                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${
                  errors.priceChangeReason ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              />
              {errors.priceChangeReason && (
                <p className="mt-1 text-sm text-red-600">{errors.priceChangeReason.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">Required when changing prices</p>
            </div>
          )}
        </div>
      </div>

      {/* Physical Specifications Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Physical Specifications</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Dimensions */}
          <div>
            <label htmlFor="dimensions" className="block text-sm font-medium text-gray-700">
              Dimensions (LxWxH mm)
            </label>
            <input
              type="text"
              id="dimensions"
              {...register('dimensions')}
              placeholder="229x152x19"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.dimensions && (
              <p className="mt-1 text-sm text-red-600">{errors.dimensions.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">Format: LengthxWidthxHeight in millimeters</p>
          </div>

          {/* Weight */}
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
              Weight (grams)
            </label>
            <input
              type="number"
              id="weight"
              {...register('weight', { valueAsNumber: true })}
              placeholder="450"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.weight && (
              <p className="mt-1 text-sm text-red-600">{errors.weight.message}</p>
            )}
          </div>

          {/* Binding Type */}
          <div>
            <label htmlFor="bindingType" className="block text-sm font-medium text-gray-700">
              Binding Type
            </label>
            <input
              type="text"
              id="bindingType"
              {...register('bindingType')}
              placeholder="Perfect Bound"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.bindingType && (
              <p className="mt-1 text-sm text-red-600">{errors.bindingType.message}</p>
            )}
          </div>

          {/* Cover Finish */}
          <div>
            <label htmlFor="coverFinish" className="block text-sm font-medium text-gray-700">
              Cover Finish
            </label>
            <input
              type="text"
              id="coverFinish"
              {...register('coverFinish')}
              placeholder="Matte"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.coverFinish && (
              <p className="mt-1 text-sm text-red-600">{errors.coverFinish.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Commercial Terms Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Commercial Terms</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Royalty Rate */}
          <div>
            <label htmlFor="royaltyRate" className="block text-sm font-medium text-gray-700">
              Royalty Rate
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="number"
                id="royaltyRate"
                step="0.01"
                {...register('royaltyRate', { valueAsNumber: true })}
                placeholder="10.00"
                className="block w-full pr-8 py-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 border"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">%</span>
              </div>
            </div>
            {errors.royaltyRate && (
              <p className="mt-1 text-sm text-red-600">{errors.royaltyRate.message}</p>
            )}
          </div>

          {/* Royalty Threshold */}
          <div>
            <label htmlFor="royaltyThreshold" className="block text-sm font-medium text-gray-700">
              Royalty Threshold (units)
            </label>
            <input
              type="number"
              id="royaltyThreshold"
              {...register('royaltyThreshold', { valueAsNumber: true })}
              placeholder="1000"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.royaltyThreshold && (
              <p className="mt-1 text-sm text-red-600">{errors.royaltyThreshold.message}</p>
            )}
          </div>

          {/* Print Run Size */}
          <div>
            <label htmlFor="printRunSize" className="block text-sm font-medium text-gray-700">
              Print Run Size (units)
            </label>
            <input
              type="number"
              id="printRunSize"
              {...register('printRunSize', { valueAsNumber: true })}
              placeholder="2000"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.printRunSize && (
              <p className="mt-1 text-sm text-red-600">{errors.printRunSize.message}</p>
            )}
          </div>

          {/* Reprint Threshold */}
          <div>
            <label htmlFor="reprintThreshold" className="block text-sm font-medium text-gray-700">
              Reprint Threshold (units)
            </label>
            <input
              type="number"
              id="reprintThreshold"
              {...register('reprintThreshold', { valueAsNumber: true })}
              placeholder="500"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.reprintThreshold && (
              <p className="mt-1 text-sm text-red-600">{errors.reprintThreshold.message}</p>
            )}
          </div>

          {/* Territory Rights */}
          <div className="sm:col-span-2">
            <label htmlFor="territoryRights" className="block text-sm font-medium text-gray-700">
              Territory Rights
            </label>
            <input
              type="text"
              id="territoryRights"
              {...register('territoryRights')}
              placeholder="World English"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            {errors.territoryRights && (
              <p className="mt-1 text-sm text-red-600">{errors.territoryRights.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {mode === 'create' ? 'Creating...' : 'Saving...'}
            </>
          ) : (
            <>{mode === 'create' ? 'Create Title' : 'Save Changes'}</>
          )}
        </button>
      </div>
    </form>
  )
}
