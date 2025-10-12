import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuth, useUser } from '@clerk/nextjs'
import AccessDeniedPage from '@/app/access-denied/page'

// Mock Clerk hooks
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useUser: vi.fn()
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn()
  }))
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseUser = vi.mocked(useUser)

describe('AccessDeniedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render access denied message', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.getByText("You don't have permission to access this resource")).toBeInTheDocument()
  })

  test('should show user information when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Jane',
        lastName: 'Smith',
        emailAddresses: [{ emailAddress: 'jane@example.com' }],
        publicMetadata: { role: 'inventory_clerk' }
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('You are signed in as: jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Current role: Inventory Clerk')).toBeInTheDocument()
  })

  test('should show sign-in message when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: null
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('Please sign in to access this resource')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  test('should show loading state when Clerk is loading', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: false
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('should have navigation options', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('should display contact information', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('Need access?')).toBeInTheDocument()
    expect(screen.getByText('Contact your system administrator to request additional permissions')).toBeInTheDocument()
  })

  test('should show different message for users with no role', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'No',
        lastName: 'Role',
        emailAddresses: [{ emailAddress: 'norole@example.com' }],
        publicMetadata: {}
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('Current role: No Role Assigned')).toBeInTheDocument()
    expect(screen.getByText('Your account has not been assigned any permissions yet')).toBeInTheDocument()
  })

  test('should format role names properly', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Manager',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'manager@example.com' }],
        publicMetadata: { role: 'operations_manager' }
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByText('Current role: Operations Manager')).toBeInTheDocument()
  })

  test('should be properly styled and responsive', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    render(<AccessDeniedPage />)

    const container = screen.getByTestId('access-denied-container')
    expect(container).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center')
  })

  test('should have proper error icon', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    render(<AccessDeniedPage />)

    expect(screen.getByTestId('access-denied-icon')).toBeInTheDocument()
  })
})