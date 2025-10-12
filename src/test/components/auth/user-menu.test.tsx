import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAuth, useUser, useClerk } from '@clerk/nextjs'
import { UserMenu } from '@/components/auth/user-menu'

// Mock Clerk hooks
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(),
  useClerk: vi.fn()
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  }))
}))

// Mock protected-route for usePermissions
const mockUsePermissions = vi.fn()
vi.mock('@/components/auth/protected-route', () => ({
  usePermissions: () => mockUsePermissions()
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseUser = vi.mocked(useUser)
const mockUseClerk = vi.mocked(useClerk)

describe('UserMenu Component', () => {
  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseClerk.mockReturnValue({
      signOut: mockSignOut
    } as any)
    mockUsePermissions.mockReturnValue({
      user_role: 'admin',
      has_role: vi.fn((role: string) => role === 'admin'),
      has_permission: vi.fn(() => true)
    })
  })

  test('should render user menu when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserMenu />)

    // Should show user initials or avatar
    expect(screen.getByTestId('user-menu-trigger')).toBeInTheDocument()
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  test('should show sign-in link when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: null
    } as any)

    render(<UserMenu />)

    const signInLink = screen.getByRole('link', { name: /sign in/i })
    expect(signInLink).toBeInTheDocument()
    expect(signInLink).toHaveAttribute('href', '/sign-in')
  })

  test('should show loading state when Clerk is loading', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: false
    } as any)

    render(<UserMenu />)

    expect(screen.getByTestId('user-menu-loading')).toBeInTheDocument()
  })

  test('should open dropdown menu when clicked', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Jane',
        lastName: 'Smith',
        emailAddresses: [{ emailAddress: 'jane@example.com' }],
        publicMetadata: { role: 'operations_manager' }
      }
    } as any)

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')
    fireEvent.click(menuTrigger)

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })

  test('should show user information in dropdown', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Alice',
        lastName: 'Johnson',
        emailAddresses: [{ emailAddress: 'alice@example.com' }],
        publicMetadata: { role: 'inventory_clerk' }
      }
    } as any)

    mockUsePermissions.mockReturnValue({
      user_role: 'inventory_clerk',
      has_role: vi.fn((role: string) => role === 'inventory_clerk'),
      has_permission: vi.fn(() => true)
    })

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')
    fireEvent.click(menuTrigger)

    await waitFor(() => {
      expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThan(0)
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      expect(screen.getByText('Inventory Clerk')).toBeInTheDocument()
    })
  })

  test('should show menu options', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Bob',
        lastName: 'Wilson',
        emailAddresses: [{ emailAddress: 'bob@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')
    fireEvent.click(menuTrigger)

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
    })
  })

  test('should show admin-only options for admin users', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Admin',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'admin@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')
    fireEvent.click(menuTrigger)

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /admin panel/i })).toBeInTheDocument()
    })
  })

  test('should not show admin options for non-admin users', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Regular',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'user@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    mockUsePermissions.mockReturnValue({
      user_role: 'read_only_user',
      has_role: vi.fn((role: string) => role === 'read_only_user'),
      has_permission: vi.fn(() => false)
    })

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')
    fireEvent.click(menuTrigger)

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /admin panel/i })).not.toBeInTheDocument()
    })
  })

  test('should handle sign out', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')
    fireEvent.click(menuTrigger)

    await waitFor(() => {
      const signOutButton = screen.getByRole('menuitem', { name: /sign out/i })
      fireEvent.click(signOutButton)
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  test('should handle missing user name gracefully', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: null,
        lastName: null,
        emailAddresses: [{ emailAddress: 'noname@example.com' }],
        publicMetadata: { role: 'read_only_user' }
      }
    } as any)

    render(<UserMenu />)

    // Should show initials from email (first letter)
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  test('should be keyboard accessible', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true
    } as any)

    mockUseUser.mockReturnValue({
      user: {
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'admin' }
      }
    } as any)

    render(<UserMenu />)

    const menuTrigger = screen.getByTestId('user-menu-trigger')

    // Should be focusable
    menuTrigger.focus()
    expect(document.activeElement).toBe(menuTrigger)

    // Should open with Enter key
    fireEvent.keyDown(menuTrigger, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })
})