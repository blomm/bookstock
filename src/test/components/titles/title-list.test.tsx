import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import TitlesPage from '@/app/titles/page'
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

describe('TitlesPage Component', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }

  const mockTitlesResponse = {
    data: [
      {
        id: 1,
        isbn: '9781234567890',
        title: 'Test Book One',
        author: 'John Doe',
        format: 'PAPERBACK' as Format,
        rrp: '29.99',
        unitCost: '8.50',
        publisher: 'Test Publisher',
        series: {
          id: 1,
          name: 'Test Series',
        },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
      },
      {
        id: 2,
        isbn: '9789876543210',
        title: 'Test Book Two',
        author: 'Jane Smith',
        format: 'HARDCOVER' as Format,
        rrp: '39.99',
        unitCost: '12.00',
        publisher: 'Another Publisher',
        series: null,
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-11T00:00:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
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
      json: async () => mockTitlesResponse,
    } as Response)
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

      render(<TitlesPage />)

      expect(screen.getByText('Loading titles...')).toBeInTheDocument()
    })

    it('should redirect to sign-in if not authenticated', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      })

      render(<TitlesPage />)

      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
    })

    it('should show loading state while fetching data', () => {
      render(<TitlesPage />)

      expect(screen.getByText('Loading titles...')).toBeInTheDocument()
    })
  })

  describe('Title List Display', () => {
    it('should display titles table with data', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Test Book Two')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('9781234567890')).toBeInTheDocument()
      expect(screen.getByText('Test Publisher')).toBeInTheDocument()
    })

    it('should display series name when available', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display formatted RRP', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('$29.99')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('$39.99')).toBeInTheDocument()
    })

    it('should display format badges', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        // Use getAllByText since "Paperback" appears both in dropdown and badge
        const paperbackElements = screen.getAllByText('Paperback')
        expect(paperbackElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      const hardcoverElements = screen.getAllByText('Hardcover')
      expect(hardcoverElements.length).toBeGreaterThan(0)
    })

    it('should display results summary', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        const summaryText = screen.getByText(/Showing/)
        expect(summaryText).toBeInTheDocument()
        const parent = summaryText.closest('p')
        expect(parent).toHaveTextContent('Showing 2 of 2 titles')
      }, { timeout: 3000 })
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no titles found', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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

      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('No titles found')).toBeInTheDocument()
      })

      expect(screen.getByText('Get started by creating a new title')).toBeInTheDocument()
    })

    it('should show adjusted empty state message when filters are active', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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

      render(<TitlesPage />)

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Title, author, or ISBN...')
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
      })

      await waitFor(
        () => {
          expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument()
        },
        { timeout: 1000 }
      )
    })
  })

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      } as Response)

      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Error loading titles')).toBeInTheDocument()
      })

      expect(screen.getByText(/Failed to fetch titles/)).toBeInTheDocument()
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('should allow retry on error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      } as Response)

      const reloadSpy = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      })

      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Try again')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Try again')
      fireEvent.click(retryButton)

      expect(reloadSpy).toHaveBeenCalled()
    })
  })

  describe('Search Functionality', () => {
    it('should have search input field', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Title, author, or ISBN...')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should update search input value', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Title, author, or ISBN...')).toBeInTheDocument()
      }, { timeout: 3000 })

      const searchInput = screen.getByPlaceholderText('Title, author, or ISBN...') as HTMLInputElement
      fireEvent.change(searchInput, { target: { value: 'test search' } })

      expect(searchInput.value).toBe('test search')
    })
  })

  describe('Filter Functionality', () => {
    it('should have format filter dropdown', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Format')).toBeInTheDocument()
      }, { timeout: 3000 })

      const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement
      expect(formatSelect.value).toBe('')

      fireEvent.change(formatSelect, { target: { value: 'PAPERBACK' } })
      expect(formatSelect.value).toBe('PAPERBACK')
    })

    it('should have category filter input', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Category')).toBeInTheDocument()
      }, { timeout: 3000 })

      const categoryInput = screen.getByLabelText('Category') as HTMLInputElement
      fireEvent.change(categoryInput, { target: { value: 'Fiction' } })

      expect(categoryInput.value).toBe('Fiction')
    })

    it('should have publisher filter input', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Publisher')).toBeInTheDocument()
      }, { timeout: 3000 })

      const publisherInput = screen.getByLabelText('Publisher') as HTMLInputElement
      fireEvent.change(publisherInput, { target: { value: 'Test Publisher' } })

      expect(publisherInput.value).toBe('Test Publisher')
    })
  })

  describe('Sorting', () => {
    it('should have sortable column headers', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      const titleHeader = screen.getByText('Title').closest('th')
      const authorHeader = screen.getByText('Author').closest('th')

      expect(titleHeader).toBeInTheDocument()
      expect(authorHeader).toBeInTheDocument()
      expect(titleHeader).toHaveClass('cursor-pointer')
      expect(authorHeader).toHaveClass('cursor-pointer')
    })
  })

  describe('Pagination', () => {
    it('should display pagination when multiple pages exist', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTitlesResponse,
          pagination: {
            page: 1,
            limit: 20,
            total: 50,
            totalPages: 3,
          },
        }),
      } as Response)

      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText(/Page.*1.*of.*3/)).toBeInTheDocument()
      }, { timeout: 3000 })

      const prevButtons = screen.getAllByText('Previous')
      const nextButtons = screen.getAllByText('Next')

      expect(prevButtons[0]).toBeDisabled()
      expect(nextButtons[0]).not.toBeDisabled()
    })

    it('should not display pagination for single page', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.queryByText(/Page.*of/)).not.toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should navigate to title detail when row is clicked', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      const row = screen.getByText('Test Book One').closest('tr')
      if (row) {
        fireEvent.click(row)
      }

      expect(mockRouter.push).toHaveBeenCalledWith('/titles/1')
    })

    it('should navigate to title detail when View button is clicked', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Book One')).toBeInTheDocument()
      }, { timeout: 3000 })

      const viewButtons = screen.getAllByText('View')
      fireEvent.click(viewButtons[0])

      expect(mockRouter.push).toHaveBeenCalledWith('/titles/1')
    })

    it('should navigate to create page when Create Title button is clicked', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Create Title')).toBeInTheDocument()
      }, { timeout: 3000 })

      const createButton = screen.getByText('Create Title')
      fireEvent.click(createButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/titles/new')
    })
  })

  describe('Permission-Based Rendering', () => {
    it('should display Create Title button when user has permission', async () => {
      render(<TitlesPage />)

      await waitFor(() => {
        expect(screen.getByText('Create Title')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})
