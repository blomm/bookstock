import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAuth, useUser } from '@clerk/nextjs'
import UserProfile from '@/components/auth/user-profile'

// Mock Clerk hooks
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(),
  UserProfile: vi.fn(() => <div data-testid="clerk-user-profile">Clerk UserProfile Component</div>)
}))

// Mock Next.js router
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace
  }))
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseUser = vi.mocked(useUser)

describe('UserProfile Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render user profile when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserProfile />)

    expect(screen.getByText('Profile Settings')).toBeInTheDocument()
    expect(screen.getByText('Manage your account settings and preferences')).toBeInTheDocument()
    expect(screen.getByTestId('clerk-user-profile')).toBeInTheDocument()
  })

  test('should show loading state when Clerk is loading', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: false
    } as any)

    mockUseUser.mockReturnValue({
      user: null
    } as any)

    render(<UserProfile />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  test('should redirect to sign-in when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: null
    } as any)

    render(<UserProfile />)

    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })

  test('should display user information summary', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_123',
        firstName: 'Jane',
        lastName: 'Smith',
        emailAddresses: [{ emailAddress: 'jane@example.com' }],
        publicMetadata: { role: 'operations_manager' }
      }
    } as any)

    render(<UserProfile />)

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Operations Manager')).toBeInTheDocument()
  })

  test('should show role information with proper formatting', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_123',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'inventory_clerk' }
      }
    } as any)

    render(<UserProfile />)

    expect(screen.getByText('Inventory Clerk')).toBeInTheDocument()
  })

  test('should handle user with no role assigned', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_123',
        firstName: 'No',
        lastName: 'Role',
        emailAddresses: [{ emailAddress: 'norole@example.com' }],
        publicMetadata: {}
      }
    } as any)

    render(<UserProfile />)

    expect(screen.getByText('No Role Assigned')).toBeInTheDocument()
  })

  test('should be responsive', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_123',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserProfile />)

    const container = screen.getByTestId('profile-container')
    expect(container).toHaveClass('max-w-4xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8')
  })

  test('should have proper navigation structure', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_123',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserProfile />)

    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument()
  })
})