import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkClient } from '@clerk/backend'
import { has_permission } from '@/lib/clerk'

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

/**
 * POST /api/admin/invites
 * Send an invitation to a new user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the current user to check permissions
    const currentUser = await clerkClient.users.getUser(userId)
    const userRole = currentUser.publicMetadata?.role as string | undefined

    // Check if user has permission to invite users
    if (!has_permission(userRole as any, 'user:create')) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await req.json()
    const { email, role = 'read_only_user' } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'operations_manager', 'inventory_clerk', 'financial_controller', 'read_only_user']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Create the invitation
    // Build absolute redirect URL for invitations
    // Always use NEXT_PUBLIC_APP_URL in production for consistent URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const redirectPath = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/dashboard'
    const redirectUrl = redirectPath.startsWith('http') ? redirectPath : `${baseUrl}${redirectPath}`

    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role: role,
        invited_by: userId,
        invited_at: new Date().toISOString()
      },
      redirectUrl
    })

    return NextResponse.json({
      message: 'Invitation sent successfully',
      data: {
        id: invitation.id,
        email: invitation.emailAddress,
        role: role,
        status: invitation.status
      }
    })
  } catch (error: any) {
    console.error('Error creating invitation:', error)

    // Handle specific Clerk errors
    if (error.status === 422) {
      return NextResponse.json(
        { error: 'User with this email already exists or invitation already sent' },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/invites
 * List all pending invitations
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the current user to check permissions
    const currentUser = await clerkClient.users.getUser(userId)
    const userRole = currentUser.publicMetadata?.role as string | undefined

    // Check if user has permission to view users
    if (!has_permission(userRole as any, 'user:read')) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get all pending invitations
    const invitations = await clerkClient.invitations.getInvitationList({
      status: 'pending'
    })

    const formattedInvitations = invitations.data.map(inv => ({
      id: inv.id,
      email: inv.emailAddress,
      role: inv.publicMetadata?.role || 'read_only_user',
      status: inv.status,
      createdAt: inv.createdAt,
      invitedBy: inv.publicMetadata?.invited_by
    }))

    return NextResponse.json({
      data: formattedInvitations
    })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}
