import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import StockMovementsPage from '@/app/inventory/movements/page'

// Mock modules
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(() => ({
    user: {
      id: 'user_test123',
      publicMetadata: { role: 'admin' },
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
    },
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}))

vi.mock('@/components/auth/permission-guard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('StockMovementsPage Component', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }

  const mockMovementsResponse = {
    data: [
      {
        id: 1,
        titleId: 1,
        warehouseId: 1,
        movementType: 'PRINT_RECEIVED',
        quantity: 100,
        referenceNumber: 'PO-12345',
        notes: 'Initial stock',
        createdAt: '2025-01-15T10:00:00Z',
        title: {
          id: 1,
          title: 'Test Book One',
          isbn: '9781234567890',
        },
        warehouse: {
          id: 1,
          name: 'Main Warehouse',
          code: 'MAIN',
        },
        sourceWarehouse: null,
        destinationWarehouse: null,
      },
      {
        id: 2,
        titleId: 1,
        warehouseId: 1,
        movementType: 'ONLINE_SALES',
        quantity: -10,
        referenceNumber: 'ORD-67890',
        notes: null,
        createdAt: '2025-01-16T14:30:00Z',
        title: {
          id: 1,
          title: 'Test Book One',
          isbn: '9781234567890',
        },
        warehouse: {
          id: 1,
          name: 'Main Warehouse',
          code: 'MAIN',
        },
        sourceWarehouse: null,
        destinationWarehouse: null,
      },
      {
        id: 3,
        titleId: 2,
        warehouseId: null,
        movementType: 'WAREHOUSE_TRANSFER',
        quantity: 50,
        referenceNumber: 'TRF-001',
        notes: 'Stock rebalancing',
        createdAt: '2025-01-17T09:15:00Z',
        title: {
          id: 2,
          title: 'Test Book Two',
          isbn: '9789876543210',
        },
        warehouse: null,
        sourceWarehouse: {
          id: 1,
          name: 'Main Warehouse',
          code: 'MAIN',
        },
        destinationWarehouse: {
          id: 2,
          name: 'Secondary Warehouse',
          code: 'SEC',
        },
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    },
  }

  const mockTitlesResponse = {
    data: [
      { id: 1, title: 'Test Book One', isbn: '9781234567890' },
      { id: 2, title: 'Test Book Two', isbn: '9789876543210' },
    ],
  }

  const mockWarehousesResponse = {
    data: [
      { id: 1, name: 'Main Warehouse', code: 'MAIN' },
      { id: 2, name: 'Secondary Warehouse', code: 'SEC' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter)
    ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    })

    // Mock fetch responses
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/titles')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockTitlesResponse,
        } as Response)
      }
      if (url.includes('/api/warehouses')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockWarehousesResponse,
        } as Response)
      }
      if (url.includes('/api/stock-movements')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockMovementsResponse,
        } as Response)
      }
      return Promise.resolve({
        ok: false,
      } as Response)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication and Loading States', () => {
    it('should show loading spinner when auth is not loaded', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: false,
      })

      render(<StockMovementsPage />)

      expect(screen.getByText('Loading stock movements...')).toBeInTheDocument()
    })

    it('should redirect to sign-in if not authenticated', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      })

      render(<StockMovementsPage />)

      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
    })

    it('should show loading state while fetching data', () => {
      render(<StockMovementsPage />)

      expect(screen.getByText('Loading stock movements...')).toBeInTheDocument()
    })
  })

  describe('Movement Display', () => {
    it('should display stock movements table with data', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Test Book Two')).toBeInTheDocument()
      expect(screen.getByText('9781234567890')).toBeInTheDocument()
      expect(screen.getByText('9789876543210')).toBeInTheDocument()
    })

    it('should display movement types with badges', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('PRINT_RECEIVED')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('ONLINE_SALES')).toBeInTheDocument()
      expect(screen.getByText('WAREHOUSE_TRANSFER')).toBeInTheDocument()
    })

    it('should display quantities with correct signs', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('+100')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('-10')).toBeInTheDocument()
      expect(screen.getByText('+50')).toBeInTheDocument()
    })

    it('should display warehouse information', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument()
    })

    it('should display reference numbers when available', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('PO-12345')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('ORD-67890')).toBeInTheDocument()
      expect(screen.getByText('TRF-001')).toBeInTheDocument()
    })

    it('should display formatted dates', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        // Check that at least one date is displayed
        // The exact format depends on date-fns formatting
        const dateElements = screen.getAllByText(/Jan.*15.*2025|15.*Jan.*2025/)
        expect(dateElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('Filter Functionality', () => {
    it('should have title filter dropdown', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument()
      }, { timeout: 3000 })

      const titleSelect = screen.getByLabelText('Title') as HTMLSelectElement
      expect(titleSelect.value).toBe('')
    })

    it('should have warehouse filter dropdown', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Warehouse')).toBeInTheDocument()
      }, { timeout: 3000 })

      const warehouseSelect = screen.getByLabelText('Warehouse') as HTMLSelectElement
      expect(warehouseSelect.value).toBe('')
    })

    it('should have movement type filter dropdown', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Movement Type')).toBeInTheDocument()
      }, { timeout: 3000 })

      const typeSelect = screen.getByLabelText('Movement Type') as HTMLSelectElement
      expect(typeSelect.value).toBe('')
    })

    it('should have date range filters', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('From Date')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByLabelText('To Date')).toBeInTheDocument()
    })

    it('should update filter values when changed', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument()
      }, { timeout: 3000 })

      const titleSelect = screen.getByLabelText('Title') as HTMLSelectElement
      fireEvent.change(titleSelect, { target: { value: '1' } })

      expect(titleSelect.value).toBe('1')
    })
  })

  describe('Pagination', () => {
    it('should display pagination when multiple pages exist', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/titles')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTitlesResponse,
          } as Response)
        }
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockWarehousesResponse,
          } as Response)
        }
        if (url.includes('/api/stock-movements')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ...mockMovementsResponse,
              pagination: {
                page: 1,
                limit: 20,
                total: 50,
                totalPages: 3,
              },
            }),
          } as Response)
        }
        return Promise.resolve({
          ok: false,
        } as Response)
      })

      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Page.*1.*of.*3/)).toBeInTheDocument()
      }, { timeout: 3000 })

      const prevButtons = screen.getAllByText('Previous')
      const nextButtons = screen.getAllByText('Next')

      expect(prevButtons[0]).toBeDisabled()
      expect(nextButtons[0]).not.toBeDisabled()
    })

    it('should not display pagination for single page', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.queryByText(/Page.*of/)).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve({
          ok: false,
        } as Response)
      )

      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Error loading stock movements')).toBeInTheDocument()
      })

      expect(screen.getByText(/Failed to fetch stock movements/)).toBeInTheDocument()
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('should allow retry on error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve({
          ok: false,
        } as Response)
      )

      const reloadSpy = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      })

      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Try again')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Try again')
      fireEvent.click(retryButton)

      expect(reloadSpy).toHaveBeenCalled()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no movements found', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/titles')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTitlesResponse,
          } as Response)
        }
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockWarehousesResponse,
          } as Response)
        }
        if (url.includes('/api/stock-movements')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [],
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
              },
            }),
          } as Response)
        }
        return Promise.resolve({
          ok: false,
        } as Response)
      })

      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('No stock movements found')).toBeInTheDocument()
      })
    })
  })

  describe('Results Summary', () => {
    it('should display results summary', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        const summaryText = screen.getByText(/Showing/)
        expect(summaryText).toBeInTheDocument()
        const parent = summaryText.closest('p')
        expect(parent).toHaveTextContent('Showing 3 of 3 movements')
      }, { timeout: 3000 })
    })
  })

  describe('Navigation', () => {
    it('should navigate back to inventory dashboard when Back button is clicked', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Back to Inventory')).toBeInTheDocument()
      }, { timeout: 3000 })

      const backButton = screen.getByText('Back to Inventory')
      fireEvent.click(backButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/inventory')
    })
  })

  describe('Transfer Movement Display', () => {
    it('should display source and destination for transfers', async () => {
      render(<StockMovementsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Main Warehouse.*→.*Secondary Warehouse/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})
