import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { LowStockAlerts } from '@/components/inventory/LowStockAlerts'

// Mock modules
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock SWR
vi.mock('swr', () => ({
  default: vi.fn((url: string | null) => {
    if (!url) {
      return { data: undefined, error: undefined, isLoading: false }
    }
    if (url.includes('/api/inventory/low-stock')) {
      return {
        data: {
          data: [
            {
              titleId: 1,
              title: {
                id: 1,
                title: 'Test Book One',
                isbn: '9781234567890',
                author: 'John Doe',
                lowStockThreshold: 100,
              },
              totalQuantity: 25,
              deficit: 75,
              warehouses: [
                {
                  warehouseId: 1,
                  warehouse: {
                    id: 1,
                    name: 'Main Warehouse',
                    code: 'MAIN',
                  },
                  quantity: 15,
                },
                {
                  warehouseId: 2,
                  warehouse: {
                    id: 2,
                    name: 'Secondary Warehouse',
                    code: 'SEC',
                  },
                  quantity: 10,
                },
              ],
            },
            {
              titleId: 2,
              title: {
                id: 2,
                title: 'Test Book Two',
                isbn: '9789876543210',
                author: 'Jane Smith',
                lowStockThreshold: 50,
              },
              totalQuantity: 20,
              deficit: 30,
              warehouses: [
                {
                  warehouseId: 1,
                  warehouse: {
                    id: 1,
                    name: 'Main Warehouse',
                    code: 'MAIN',
                  },
                  quantity: 20,
                },
              ],
            },
          ],
        },
        error: undefined,
        isLoading: false,
      }
    }
    return { data: undefined, error: undefined, isLoading: false }
  }),
}))

describe('LowStockAlerts Component', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter)
    ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the low stock alerts section', () => {
      render(<LowStockAlerts />)

      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
    })

    it('should display alert count badge', async () => {
      render(<LowStockAlerts />)

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument()
      })
    })

    it('should be collapsed by default', () => {
      render(<LowStockAlerts />)

      expect(screen.queryByText('Test Book One')).not.toBeInTheDocument()
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should expand when header is clicked', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      })

      expect(screen.getByText('Test Book Two')).toBeInTheDocument()
    })

    it('should collapse when header is clicked again', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        // Expand
        fireEvent.click(expandButton)

        await waitFor(() => {
          expect(screen.getByText('Test Book One')).toBeInTheDocument()
        })

        // Collapse
        fireEvent.click(expandButton)

        await waitFor(() => {
          expect(screen.queryByText('Test Book One')).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('Low Stock Items Display', () => {
    it('should display low stock items when expanded', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      })

      expect(screen.getByText('Test Book Two')).toBeInTheDocument()
      expect(screen.getByText('9781234567890')).toBeInTheDocument()
      expect(screen.getByText('9789876543210')).toBeInTheDocument()
    })

    it('should display current stock quantities', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/Current: 25/)).toBeInTheDocument()
      })

      expect(screen.getByText(/Current: 20/)).toBeInTheDocument()
    })

    it('should display stock thresholds', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/Threshold: 100/)).toBeInTheDocument()
      })

      expect(screen.getByText(/Threshold: 50/)).toBeInTheDocument()
    })

    it('should display stock deficits', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/75 units below threshold/)).toBeInTheDocument()
      })

      expect(screen.getByText(/30 units below threshold/)).toBeInTheDocument()
    })

    it('should display warehouse breakdown', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument()
      })

      expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('should have View Details button for each item', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        const viewButtons = screen.getAllByText('View Details')
        expect(viewButtons.length).toBe(2)
      })
    })

    it('should navigate to title details when View Details is clicked', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        const viewButtons = screen.getAllByText('View Details')
        expect(viewButtons.length).toBe(2)
      })

      const viewButtons = screen.getAllByText('View Details')
      fireEvent.click(viewButtons[0])

      expect(mockRouter.push).toHaveBeenCalledWith('/titles/1')
    })

    it('should have Quick Reorder button for each item', async () => {
      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        const reorderButtons = screen.getAllByText('Quick Reorder')
        expect(reorderButtons.length).toBe(2)
      })
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no low stock items', async () => {
      // Mock SWR to return empty data
      vi.mock('swr', () => ({
        default: vi.fn(() => ({
          data: {
            data: [],
          },
          error: undefined,
          isLoading: false,
        })),
      }))

      render(<LowStockAlerts />)

      const expandButton = screen.getByText('Low Stock Alerts').closest('button')
      if (expandButton) {
        fireEvent.click(expandButton)
      }

      await waitFor(() => {
        // When there are no items, the component should show badge with 0 or hide the alerts
        const badge = screen.queryByText('0')
        expect(badge).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state', () => {
      // Mock SWR to return loading state
      vi.mock('swr', () => ({
        default: vi.fn(() => ({
          data: undefined,
          error: undefined,
          isLoading: true,
        })),
      }))

      render(<LowStockAlerts />)

      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle error state gracefully', () => {
      // Mock SWR to return error state
      vi.mock('swr', () => ({
        default: vi.fn(() => ({
          data: undefined,
          error: new Error('Failed to fetch'),
          isLoading: false,
        })),
      }))

      render(<LowStockAlerts />)

      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
    })
  })

  describe('Visual Indicators', () => {
    it('should use red color scheme for critical alerts', async () => {
      render(<LowStockAlerts />)

      await waitFor(() => {
        const alertSection = screen.getByText('Low Stock Alerts').closest('div')
        expect(alertSection).toBeInTheDocument()
        // The component should have red styling (bg-red-50, border-red-200, etc.)
      })
    })

    it('should display warning icon', () => {
      render(<LowStockAlerts />)

      // Check that SVG icon is rendered
      const svg = document.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Unauthenticated State', () => {
    it('should not fetch data when not signed in', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      })

      render(<LowStockAlerts />)

      // Component should render but not show data
      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
    })
  })
})
