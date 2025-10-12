import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignInPage from '@/app/sign-in/[[...rest]]/page'

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  SignIn: vi.fn(({ appearance, signUpUrl, afterSignInUrl }) => (
    <div data-testid="clerk-signin">
      <div data-testid="signin-form">Clerk SignIn Component</div>
      <div data-testid="signin-config">
        signUpUrl: {signUpUrl}
        afterSignInUrl: {afterSignInUrl}
      </div>
    </div>
  ))
}))

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render sign-in page with proper layout', () => {
    render(<SignInPage />)

    expect(screen.getByText('Welcome Back to BookStock')).toBeInTheDocument()
    expect(screen.getByText('Sign in to access the inventory management system')).toBeInTheDocument()
    expect(screen.getByTestId('clerk-signin')).toBeInTheDocument()
  })

  test('should display BookStock branding and logo', () => {
    render(<SignInPage />)

    // Check for BookStock logo/icon
    const logo = screen.getByTestId('bookstock-logo')
    expect(logo).toBeInTheDocument()

    // Check branding text
    expect(screen.getByText('Welcome Back to BookStock')).toBeInTheDocument()
  })

  test('should configure Clerk SignIn with correct URLs', () => {
    render(<SignInPage />)

    const config = screen.getByTestId('signin-config')
    expect(config).toHaveTextContent('signUpUrl: /sign-up')
    expect(config).toHaveTextContent('afterSignInUrl: /dashboard')
  })

  test('should have link to sign-up page', () => {
    render(<SignInPage />)

    const signUpLink = screen.getByRole('link', { name: /sign up here/i })
    expect(signUpLink).toBeInTheDocument()
    expect(signUpLink).toHaveAttribute('href', '/sign-up')
  })

  test('should display feature information for new users', () => {
    render(<SignInPage />)

    expect(screen.getByText('Access Features:')).toBeInTheDocument()
    expect(screen.getByText('Book inventory tracking')).toBeInTheDocument()
    expect(screen.getByText('Multi-warehouse management')).toBeInTheDocument()
    expect(screen.getByText('Real-time analytics')).toBeInTheDocument()
    expect(screen.getByText('Role-based access control')).toBeInTheDocument()
  })

  test('should apply custom styling and appearance', () => {
    render(<SignInPage />)

    const container = screen.getByTestId('signin-container')
    expect(container).toHaveClass('min-h-screen', 'bg-gray-50')
  })

  test('should be responsive', () => {
    render(<SignInPage />)

    const container = screen.getByTestId('signin-container')
    expect(container).toHaveClass('px-4', 'sm:px-6', 'lg:px-8')
  })
})