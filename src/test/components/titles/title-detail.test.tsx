import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import TitleDetailPage from '@/app/titles/[id]/page'
import { Format } from '@prisma/client'

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

describe('TitleDetailPage Component', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }

  const mockTitleDetail = {
    id: 1,
    isbn: '9781234567890',
    title: 'The Opinionated Guide to React',
    author: 'Sara Drasner',
    format: 'PAPERBACK' as Format,
    rrp: '29.99',
    unitCost: '8.50',
    tradeDiscount: '40.00',
    publisher: "O'Reilly Media",
    publicationDate: '2025-03-01T00:00:00Z',
    pageCount: 350,
    description: 'A comprehensive guide to React development with opinionated best practices.',
    category: 'Technology',
    subcategory: 'Web Development',
    dimensions: '229x152x19',
    weight: 500,
    binding: 'Perfect Bound',
    coverFinish: 'Matte',
    royaltyRate: '15.00',
    royaltyThreshold: 1000,
    printRunSize: 5000,
    reprintThreshold: 500,
    territory: 'World English',
    seriesId: 1,
    seriesSequence: 1,
    series: {
      id: 1,
      name: 'Opinionated Guides',
    },
    priceHistory: [
      {
        id: 1,
        rrp: '29.99',
        unitCost: '8.50',
        tradeDiscount: '40.00',
        effectiveFrom: '2025-01-01T00:00:00Z',
        effectiveTo: null,
        reason: 'Initial price',
      },
    ],
    inventory: [
      {
        id: 1,
        warehouseId: 1,
        warehouse: {
          id: 1,
          name: 'Turnaround UK',
          code: 'TRN',
        },
        currentStock: 1500,
        reservedStock: 50,
      },
      {
        id: 2,
        warehouseId: 2,
        warehouse: {
          id: 2,
          name: 'Gardners',
          code: 'GAR',
        },
        currentStock: 800,
        reservedStock: 20,
      },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter)
    ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockTitleDetail,
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should display loading state initially', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: true,
        isLoaded: false,
      })

      render(<TitleDetailPage params={{ id: '1' }} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByText('Loading title details...')).toBeInTheDocument()
    })

    it('should render title header with key information', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('The Opinionated Guide to React')).toBeInTheDocument()
      })

      // Check key info in header - verify content is present
      const main = screen.getByRole('main')
      expect(main).toHaveTextContent('Sara Drasner')
      expect(main).toHaveTextContent('9781234567890')
      expect(main).toHaveTextContent('Opinionated Guides')
    })

    it('should render metadata section', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Metadata')).toBeInTheDocument()
      })

      expect(screen.getByText('PAPERBACK')).toBeInTheDocument()
      expect(screen.getByText("O'Reilly Media")).toBeInTheDocument()
      expect(screen.getByText('350')).toBeInTheDocument()
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Web Development')).toBeInTheDocument()
      expect(screen.getByText('A comprehensive guide to React development with opinionated best practices.')).toBeInTheDocument()
    })

    it('should render pricing section with formatted currency', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Pricing')).toBeInTheDocument()
      })

      // Multiple price values exist in history table, so use getAllByText
      expect(screen.getAllByText('£29.99').length).toBeGreaterThan(0)
      expect(screen.getAllByText('£8.50').length).toBeGreaterThan(0)
      expect(screen.getAllByText('40.00%').length).toBeGreaterThan(0)
    })

    it('should render physical specifications section', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Physical Specifications')).toBeInTheDocument()
      })

      expect(screen.getByText('229x152x19')).toBeInTheDocument()
      expect(screen.getByText('500g')).toBeInTheDocument()
      expect(screen.getByText('Perfect Bound')).toBeInTheDocument()
      expect(screen.getByText('Matte')).toBeInTheDocument()
    })

    it('should render commercial terms section', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Commercial Terms')).toBeInTheDocument()
      })

      expect(screen.getByText('15.00%')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('5000')).toBeInTheDocument()
      expect(screen.getByText('500')).toBeInTheDocument()
      expect(screen.getByText('World English')).toBeInTheDocument()
    })

    it('should render price history table', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Price History')).toBeInTheDocument()
      })

      expect(screen.getByText('Current')).toBeInTheDocument()
      expect(screen.getByText('Initial price')).toBeInTheDocument()
    })

    it('should render inventory summary with warehouses', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Inventory Summary')).toBeInTheDocument()
      })

      // Check total inventory (there may be multiple instances of these numbers)
      expect(screen.getAllByText('2300').length).toBeGreaterThan(0) // 1500 + 800
      expect(screen.getAllByText('70').length).toBeGreaterThan(0) // 50 + 20

      // Check warehouse details
      expect(screen.getByText('Turnaround UK')).toBeInTheDocument()
      expect(screen.getByText('TRN')).toBeInTheDocument()
      expect(screen.getAllByText('1500').length).toBeGreaterThan(0)
      expect(screen.getAllByText('50').length).toBeGreaterThan(0)
      expect(screen.getAllByText('1450').length).toBeGreaterThan(0) // Available: 1500 - 50

      expect(screen.getByText('Gardners')).toBeInTheDocument()
      expect(screen.getByText('GAR')).toBeInTheDocument()
      expect(screen.getAllByText('800').length).toBeGreaterThan(0)
      expect(screen.getAllByText('20').length).toBeGreaterThan(0)
      expect(screen.getAllByText('780').length).toBeGreaterThan(0) // Available: 800 - 20
    })

    it('should not render inventory section when no inventory', async () => {
      const titleWithoutInventory = {
        ...mockTitleDetail,
        inventory: []
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => titleWithoutInventory,
      } as Response)

      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('The Opinionated Guide to React')).toBeInTheDocument()
      })

      // Wait for all sections to be loaded
      await waitFor(() => {
        expect(screen.getByText('Price History')).toBeInTheDocument()
      })

      // Inventory section should not exist when no inventory
      expect(screen.queryByText('Inventory Summary')).not.toBeInTheDocument()
    })

    it('should render edit and delete buttons', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should navigate back when back button is clicked', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('The Opinionated Guide to React')).toBeInTheDocument()
      })

      const backButton = screen.getAllByRole('button')[0] // First button is back
      fireEvent.click(backButton)

      expect(mockRouter.back).toHaveBeenCalled()
    })

    it('should navigate to edit page when edit button is clicked', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit')
      fireEvent.click(editButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/titles/1/edit')
    })
  })

  describe('Delete Functionality', () => {
    it('should show delete confirmation dialog when delete button is clicked', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Delete Title')).toBeInTheDocument()
      })

      // Check dialog content using container query
      const dialog = screen.getByText('Delete Title').closest('div')
      expect(dialog).toHaveTextContent('Are you sure you want to delete')
      expect(dialog).toHaveTextContent('The Opinionated Guide to React')
    })

    it('should show warning in delete dialog when title has inventory', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        const dialog = screen.getByText('Delete Title').closest('div')
        expect(dialog).toHaveTextContent('Warning: This title has 2300 units in inventory and cannot be deleted')
      })
    })

    it('should close delete dialog when cancel is clicked', async () => {
      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      expect(screen.getByText('Delete Title')).toBeInTheDocument()

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Delete Title')).not.toBeInTheDocument()
      })
    })

    it('should delete title successfully and redirect', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTitleDetail,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, message: 'Title deleted successfully' }),
        } as Response)

      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      const confirmDeleteButton = screen.getAllByText('Delete')[1] // Second Delete button in dialog
      fireEvent.click(confirmDeleteButton)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/titles')
      })
    })

    it('should display error when delete fails', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTitleDetail,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Cannot delete title with existing inventory' }),
        } as Response)

      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      const confirmDeleteButton = screen.getAllByText('Delete')[1]
      fireEvent.click(confirmDeleteButton)

      await waitFor(() => {
        const dialog = screen.getByText('Delete Title').closest('div')
        expect(dialog).toHaveTextContent('Cannot delete title with existing inventory')
      })

      expect(mockRouter.push).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Title not found' }),
      } as Response)

      render(<TitleDetailPage params={{ id: '999' }} />)

      await waitFor(() => {
        expect(screen.getByText('Error loading title')).toBeInTheDocument()
      })

      expect(screen.getByText('Title not found')).toBeInTheDocument()
    })

    it('should allow navigation back on error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Title not found' }),
      } as Response)

      render(<TitleDetailPage params={{ id: '999' }} />)

      await waitFor(() => {
        expect(screen.getByText('Go back')).toBeInTheDocument()
      })

      const goBackButton = screen.getByText('Go back')
      fireEvent.click(goBackButton)

      expect(mockRouter.back).toHaveBeenCalled()
    })
  })

  describe('Optional Fields', () => {
    it('should display N/A for missing optional fields', async () => {
      const titleWithoutOptionals = {
        ...mockTitleDetail,
        publisher: null,
        publicationDate: null,
        pageCount: null,
        description: null,
        category: null,
        subcategory: null,
        dimensions: null,
        weight: null,
        binding: null,
        coverFinish: null,
        royaltyRate: null,
        royaltyThreshold: null,
        printRunSize: null,
        reprintThreshold: null,
        territory: null,
        series: null,
        seriesSequence: null,
        tradeDiscount: null,
        priceHistory: [],
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => titleWithoutOptionals,
      } as Response)

      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        expect(screen.getByText('The Opinionated Guide to React')).toBeInTheDocument()
      })

      // Check that N/A appears for optional fields
      const main = screen.getByRole('main')
      const naCount = (main.textContent?.match(/N\/A/g) || []).length
      expect(naCount).toBeGreaterThan(5)
    })

    it('should not display price history section when empty', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockTitleDetail, priceHistory: [] }),
      } as Response)

      render(<TitleDetailPage params={{ id: '1' }} />)

      await waitFor(() => {
        const priceSection = screen.getByText('Price History').closest('div')
        expect(priceSection).toHaveTextContent('No price history available')
      })
    })
  })

  describe('Authentication', () => {
    it('should not fetch data when user is not signed in', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      })

      render(<TitleDetailPage params={{ id: '1' }} />)

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
