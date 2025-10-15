import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TitleForm } from '@/components/titles/TitleForm'
import { Format } from '@prisma/client'

// Mock fetch
global.fetch = vi.fn()

describe('TitleForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Form Rendering', () => {
    it('should render all required fields in create mode', () => {
      render(<TitleForm mode="create" />)

      // Core required fields
      expect(screen.getByLabelText(/ISBN/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Title/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Author/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Format/)).toBeInTheDocument()
      expect(screen.getByLabelText(/RRP/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Unit Cost/)).toBeInTheDocument()
    })

    it('should render all form sections', () => {
      render(<TitleForm mode="create" />)

      expect(screen.getByText('Core Information')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
      expect(screen.getByText('Physical Specifications')).toBeInTheDocument()
      expect(screen.getByText('Commercial Terms')).toBeInTheDocument()
    })

    it('should render optional fields', () => {
      render(<TitleForm mode="create" />)

      // Optional fields
      expect(screen.getByLabelText(/Publisher/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Publication Date/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Category/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Dimensions/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Weight/)).toBeInTheDocument()
    })

    it('should render create button in create mode', () => {
      render(<TitleForm mode="create" />)

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).not.toBeDisabled()
    })

    it('should render save button in edit mode', () => {
      render(<TitleForm mode="edit" titleId={1} />)

      const submitButton = screen.getByRole('button', { name: /Save Changes/i })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).not.toBeDisabled()
    })

    it('should render cancel button when onCancel provided', () => {
      const onCancel = vi.fn()
      render(<TitleForm mode="create" onCancel={onCancel} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      expect(cancelButton).toBeInTheDocument()
    })

    it('should not render cancel button when onCancel not provided', () => {
      render(<TitleForm mode="create" />)

      const cancelButton = screen.queryByRole('button', { name: /Cancel/i })
      expect(cancelButton).not.toBeInTheDocument()
    })
  })

  describe('Form Pre-population', () => {
    const mockDefaultValues = {
      isbn: '9781234567890',
      title: 'Test Book',
      author: 'Test Author',
      format: 'PAPERBACK' as Format,
      rrp: 29.99,
      unitCost: 8.50,
      publisher: 'Test Publisher',
      category: 'Technology',
      description: 'Test description',
    }

    it('should pre-populate form fields with default values', () => {
      render(<TitleForm mode="edit" titleId={1} defaultValues={mockDefaultValues} />)

      const isbnInput = screen.getByLabelText(/ISBN/) as HTMLInputElement
      const titleInput = screen.getByLabelText(/^Title/) as HTMLInputElement
      const authorInput = screen.getByLabelText(/Author/) as HTMLInputElement

      expect(isbnInput.value).toBe('9781234567890')
      expect(titleInput.value).toBe('Test Book')
      expect(authorInput.value).toBe('Test Author')
    })
  })

  describe('Form Validation', () => {
    it('should show validation error for empty ISBN', async () => {
      render(<TitleForm mode="create" />)

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/ISBN must be at least 10 characters/i)).toBeInTheDocument()
      })
    })

    it('should show validation error for empty title', async () => {
      render(<TitleForm mode="create" />)

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Title is required/i)).toBeInTheDocument()
      })
    })

    it('should show validation error for empty author', async () => {
      render(<TitleForm mode="create" />)

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Author is required/i)).toBeInTheDocument()
      })
    })

    it('should validate ISBN format', async () => {
      render(<TitleForm mode="create" />)

      const isbnInput = screen.getByLabelText(/ISBN/)
      fireEvent.change(isbnInput, { target: { value: 'invalid' } })
      fireEvent.blur(isbnInput)

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Invalid ISBN/i)).toBeInTheDocument()
      })
    })

    it('should validate positive RRP', async () => {
      render(<TitleForm mode="create" />)

      const rrpInput = screen.getByLabelText(/RRP/)
      fireEvent.change(rrpInput, { target: { value: '-10' } })

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/RRP must be positive/i)).toBeInTheDocument()
      })
    })

    it('should validate positive unit cost', async () => {
      render(<TitleForm mode="create" />)

      const unitCostInput = screen.getByLabelText(/Unit Cost/)
      fireEvent.change(unitCostInput, { target: { value: '-5' } })

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Unit cost must be positive/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    const validFormData = {
      isbn: '9781234567890',
      title: 'Test Book',
      author: 'Test Author',
      format: 'PAPERBACK',
      rrp: '29.99',
      unitCost: '8.50',
    }

    it('should submit form with valid data in create mode', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, ...validFormData }),
      } as Response)

      const onSuccess = vi.fn()
      render(<TitleForm mode="create" onSuccess={onSuccess} />)

      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/ISBN/), { target: { value: validFormData.isbn } })
      fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: validFormData.title } })
      fireEvent.change(screen.getByLabelText(/Author/), { target: { value: validFormData.author } })
      fireEvent.change(screen.getByLabelText(/RRP/), { target: { value: validFormData.rrp } })
      fireEvent.change(screen.getByLabelText(/Unit Cost/), { target: { value: validFormData.unitCost } })

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/titles',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(1)
      })
    })

    it('should display loading state during submission', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: async () => ({ id: 1 }) } as Response), 100))
      )

      render(<TitleForm mode="create" />)

      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/ISBN/), { target: { value: '9781234567890' } })
      fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Author/), { target: { value: 'Author' } })
      fireEvent.change(screen.getByLabelText(/RRP/), { target: { value: '29.99' } })
      fireEvent.change(screen.getByLabelText(/Unit Cost/), { target: { value: '8.50' } })

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Creating.../i)).toBeInTheDocument()
      })
    })

    it('should display API error on failed submission', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Duplicate ISBN' }),
      } as Response)

      render(<TitleForm mode="create" />)

      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/ISBN/), { target: { value: '9781234567890' } })
      fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Author/), { target: { value: 'Author' } })
      fireEvent.change(screen.getByLabelText(/RRP/), { target: { value: '29.99' } })
      fireEvent.change(screen.getByLabelText(/Unit Cost/), { target: { value: '8.50' } })

      const submitButton = screen.getByRole('button', { name: /Create Title/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Duplicate ISBN/i)).toBeInTheDocument()
      })
    })

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn()
      render(<TitleForm mode="create" onCancel={onCancel} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('Edit Mode Price Change Tracking', () => {
    const defaultValues = {
      isbn: '9781234567890',
      title: 'Test Book',
      author: 'Test Author',
      format: 'PAPERBACK' as Format,
      rrp: 29.99,
      unitCost: 8.50,
    }

    it('should not show price change reason field initially', () => {
      render(<TitleForm mode="edit" titleId={1} defaultValues={defaultValues} />)

      expect(screen.queryByLabelText(/Price Change Reason/i)).not.toBeInTheDocument()
    })

    it('should show price change reason field when RRP changes', async () => {
      render(<TitleForm mode="edit" titleId={1} defaultValues={defaultValues} />)

      const rrpInput = screen.getByLabelText(/RRP/)
      fireEvent.change(rrpInput, { target: { value: '34.99' } })

      await waitFor(() => {
        expect(screen.getByLabelText(/Price Change Reason/i)).toBeInTheDocument()
      })
    })

    it('should show price change reason field when unit cost changes', async () => {
      render(<TitleForm mode="edit" titleId={1} defaultValues={defaultValues} />)

      const unitCostInput = screen.getByLabelText(/Unit Cost/)
      fireEvent.change(unitCostInput, { target: { value: '9.00' } })

      await waitFor(() => {
        expect(screen.getByLabelText(/Price Change Reason/i)).toBeInTheDocument()
      })
    })
  })

  describe('Format Selection', () => {
    it('should render all format options', () => {
      render(<TitleForm mode="create" />)

      const formatSelect = screen.getByLabelText(/^Format/)

      expect(formatSelect).toContainHTML('<option value="PAPERBACK">Paperback</option>')
      expect(formatSelect).toContainHTML('<option value="HARDCOVER">Hardcover</option>')
      expect(formatSelect).toContainHTML('<option value="DIGITAL">Digital</option>')
      expect(formatSelect).toContainHTML('<option value="AUDIOBOOK">Audiobook</option>')
    })

    it('should allow changing format', () => {
      render(<TitleForm mode="create" />)

      const formatSelect = screen.getByLabelText(/^Format/) as HTMLSelectElement

      fireEvent.change(formatSelect, { target: { value: 'HARDCOVER' } })

      expect(formatSelect.value).toBe('HARDCOVER')
    })
  })

  describe('Helper Text', () => {
    it('should display ISBN helper text', () => {
      render(<TitleForm mode="create" />)

      expect(screen.getByText(/Enter ISBN-10 or ISBN-13/i)).toBeInTheDocument()
    })

    it('should display dimensions helper text', () => {
      render(<TitleForm mode="create" />)

      expect(screen.getByText(/Format: LengthxWidthxHeight/i)).toBeInTheDocument()
    })

    it('should display language helper text', () => {
      render(<TitleForm mode="create" />)

      expect(screen.getByText(/2-letter ISO 639-1 code/i)).toBeInTheDocument()
    })

    it('should display keywords helper text', () => {
      render(<TitleForm mode="create" />)

      expect(screen.getByText(/Comma-separated keywords/i)).toBeInTheDocument()
    })
  })
})
