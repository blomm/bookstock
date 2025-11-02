import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import InventoryPage from '@/app/inventory/page'

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

vi.mock('@/components/inventory/LowStockAlerts', () => ({
  LowStockAlerts: () => <div data-testid="low-stock-alerts">Low Stock Alerts</div>,
}))

vi.mock('@/components/inventory/StockMovementModal', () => ({
  StockMovementModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="stock-movement-modal">Stock Movement Modal</div> : null,
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('InventoryDashboard Component', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }

  const mockInventoryResponse = {
    data: [
      {
        id: 1,
        titleId: 1,
        warehouseId: 1,
        currentStock: 100,
        reservedStock: 0,
        availableStock: 100,
        isLowStock: false,
        lastMovementDate: null,
        title: {
          id: 1,
          title: 'Test Book One',
          isbn: '9781234567890',
          author: 'John Doe',
          lowStockThreshold: 50,
        },
        warehouse: {
          id: 1,
          name: 'Main Warehouse',
          code: 'MAIN',
        },
      },
      {
        id: 2,
        titleId: 1,
        warehouseId: 2,
        currentStock: 50,
        reservedStock: 0,
        availableStock: 50,
        isLowStock: false,
        lastMovementDate: null,
        title: {
          id: 1,
          title: 'Test Book One',
          isbn: '9781234567890',
          author: 'John Doe',
          lowStockThreshold: 50,
        },
        warehouse: {
          id: 2,
          name: 'Secondary Warehouse',
          code: 'SEC',
        },
      },
      {
        id: 3,
        titleId: 2,
        warehouseId: 1,
        currentStock: 25,
        reservedStock: 0,
        availableStock: 25,
        isLowStock: true,
        lastMovementDate: null,
        title: {
          id: 2,
          title: 'Test Book Two',
          isbn: '9789876543210',
          author: 'Jane Smith',
          lowStockThreshold: 100,
        },
        warehouse: {
          id: 1,
          name: 'Main Warehouse',
          code: 'MAIN',
        },
      },
    ],
  }

  const mockWarehousesResponse = {
    data: [
      {
        id: 1,
        name: 'Main Warehouse',
        code: 'MAIN',
      },
      {
        id: 2,
        name: 'Secondary Warehouse',
        code: 'SEC',
      },
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
      if (url.includes('/api/warehouses')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockWarehousesResponse,
        } as Response)
      }
      if (url.includes('/api/inventory/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockInventoryResponse,
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

      render(<InventoryPage />)

      expect(screen.getByText('Loading inventory...')).toBeInTheDocument()
    })

    it('should redirect to sign-in if not authenticated', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      })

      render(<InventoryPage />)

      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
    })

    it('should show loading state while fetching data', () => {
      render(<InventoryPage />)

      expect(screen.getByText('Loading inventory...')).toBeInTheDocument()
    })
  })

  describe('Inventory Display', () => {
    it('should display inventory items with titles', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Test Book Two')).toBeInTheDocument()
      expect(screen.getByText('9781234567890')).toBeInTheDocument()
      expect(screen.getByText('9789876543210')).toBeInTheDocument()
    })

    it('should display total quantities', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        // Total for Test Book One = 100 + 50 = 150
        expect(screen.getByText('150')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Total for Test Book Two = 25
      expect(screen.getByText('25')).toBeInTheDocument()
    })

    it('should display warehouse breakdown', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument()
    })

    it('should display stock status badges', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('In Stock')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Low Stock')).toBeInTheDocument()
    })
  })

  describe('Filter Functionality', () => {
    it('should have warehouse filter dropdown', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Warehouse')).toBeInTheDocument()
      }, { timeout: 3000 })

      const warehouseSelect = screen.getByLabelText('Warehouse') as HTMLSelectElement
      expect(warehouseSelect.value).toBe('')
    })

    it('should have search input field', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by title or ISBN...')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should have low stock toggle', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Show Low Stock Only')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should update search input value', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by title or ISBN...')).toBeInTheDocument()
      }, { timeout: 3000 })

      const searchInput = screen.getByPlaceholderText('Search by title or ISBN...') as HTMLInputElement
      fireEvent.change(searchInput, { target: { value: 'test search' } })

      expect(searchInput.value).toBe('test search')
    })
  })

  describe('Stock Movement Modal', () => {
    it('should open stock movement modal when Record Movement button is clicked', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Record Movement')).toBeInTheDocument()
      }, { timeout: 3000 })

      const recordButton = screen.getByText('Record Movement')
      fireEvent.click(recordButton)

      await waitFor(() => {
        expect(screen.getByTestId('stock-movement-modal')).toBeInTheDocument()
      })
    })
  })

  describe('Low Stock Alerts', () => {
    it('should display low stock alerts component', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByTestId('low-stock-alerts')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve({
          ok: false,
        } as Response)
      )

      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Error loading inventory')).toBeInTheDocument()
      })

      expect(screen.getByText(/Failed to fetch inventory/)).toBeInTheDocument()
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

      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Try again')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Try again')
      fireEvent.click(retryButton)

      expect(reloadSpy).toHaveBeenCalled()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no inventory found', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockWarehousesResponse,
          } as Response)
        }
        if (url.includes('/api/inventory/dashboard')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [],
            }),
          } as Response)
        }
        return Promise.resolve({
          ok: false,
        } as Response)
      })

      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('No inventory found')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate to title detail when View button is clicked', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      const viewButtons = screen.getAllByText('View Details')
      fireEvent.click(viewButtons[0])

      expect(mockRouter.push).toHaveBeenCalledWith('/titles/1')
    })

    it('should navigate to movements page when View Movements button is clicked', async () => {
      render(<InventoryPage />)

      await waitFor(() => {
        expect(screen.getByText('View Movements')).toBeInTheDocument()
      }, { timeout: 3000 })

      const viewMovementsButton = screen.getByText('View Movements')
      fireEvent.click(viewMovementsButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/inventory/movements')
    })
  })
})
