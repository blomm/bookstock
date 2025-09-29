import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/database'
import { clerk_config, DEFAULT_USER_ROLE } from '@/lib/clerk'

/**
 * Clerk Webhook Handler
 *
 * This API route handles webhooks from Clerk to synchronize user data
 * between Clerk and our local database. It handles user creation, updates,
 * and deletion events.
 */

export async function POST(req: NextRequest) {
  // Get the body
  const body = await req.text()

  // Get the headers
  const svix_id = headers().get('svix-id')
  const svix_timestamp = headers().get('svix-timestamp')
  const svix_signature = headers().get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing required Svix headers' },
      { status: 400 }
    )
  }

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(clerk_config.webhook_secret)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 401 }
    )
  }

  const { id } = evt.data
  const event_type = evt.type

  console.log(`Webhook ${id} received: ${event_type}`)

  try {
    // Handle the webhook
    switch (event_type) {
      case 'user.created':
        await handle_user_created(evt)
        break
      case 'user.updated':
        await handle_user_updated(evt)
        break
      case 'user.deleted':
        await handle_user_deleted(evt)
        break
      default:
        console.log(`Unhandled webhook event type: ${event_type}`)
    }

    return NextResponse.json({ message: 'Webhook processed successfully' })
  } catch (error) {
    console.error(`Error processing webhook ${id}:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle user.created webhook event
 * Creates a new user in the database and assigns default role
 */
async function handle_user_created(evt: WebhookEvent) {
  const { id, email_addresses, first_name, last_name, created_at } = evt.data

  // Get primary email address
  const primary_email = email_addresses?.find(email =>
    email.id === evt.data.primary_email_address_id
  )?.email_address || email_addresses?.[0]?.email_address

  if (!primary_email) {
    throw new Error('No email address found for user')
  }

  console.log(`Creating user in database: ${id} (${primary_email})`)

  // Create user in database
  const user = await prisma.user.create({
    data: {
      clerk_id: id,
      email: primary_email,
      first_name: first_name || null,
      last_name: last_name || null,
      is_active: true,
      created_at: created_at ? new Date(created_at) : new Date(),
      updated_at: new Date(),
    },
  })

  // Assign default role to new user
  const default_role = await prisma.role.findFirst({
    where: { name: DEFAULT_USER_ROLE }
  })

  if (default_role) {
    await prisma.userRole.create({
      data: {
        user_id: user.id,
        role_id: default_role.id,
        assigned_at: new Date(),
        assigned_by: 'system',
      },
    })

    console.log(`Assigned default role '${DEFAULT_USER_ROLE}' to user ${id}`)
  } else {
    console.error(`Default role '${DEFAULT_USER_ROLE}' not found in database`)
  }

  // Log the user creation event
  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: 'user_created',
      details: {
        clerk_id: id,
        email: primary_email,
        source: 'clerk_webhook'
      },
      ip_address: null,
      user_agent: 'Clerk Webhook',
      timestamp: new Date(),
    },
  })

  console.log(`Successfully created user: ${id}`)
}

/**
 * Handle user.updated webhook event
 * Updates existing user information in the database
 */
async function handle_user_updated(evt: WebhookEvent) {
  const { id, email_addresses, first_name, last_name, updated_at } = evt.data

  // Get primary email address
  const primary_email = email_addresses?.find(email =>
    email.id === evt.data.primary_email_address_id
  )?.email_address || email_addresses?.[0]?.email_address

  console.log(`Updating user in database: ${id}`)

  // Find existing user
  const existing_user = await prisma.user.findUnique({
    where: { clerk_id: id }
  })

  if (!existing_user) {
    console.warn(`User ${id} not found in database, skipping update`)
    return
  }

  // Update user in database
  const updated_user = await prisma.user.update({
    where: { clerk_id: id },
    data: {
      email: primary_email || existing_user.email,
      first_name: first_name !== undefined ? first_name : existing_user.first_name,
      last_name: last_name !== undefined ? last_name : existing_user.last_name,
      updated_at: updated_at ? new Date(updated_at) : new Date(),
    },
  })

  // Log the user update event
  await prisma.auditLog.create({
    data: {
      user_id: updated_user.id,
      action: 'user_updated',
      details: {
        clerk_id: id,
        email: primary_email,
        source: 'clerk_webhook'
      },
      ip_address: null,
      user_agent: 'Clerk Webhook',
      timestamp: new Date(),
    },
  })

  console.log(`Successfully updated user: ${id}`)
}

/**
 * Handle user.deleted webhook event
 * Soft deletes user from the database (preserves audit logs)
 */
async function handle_user_deleted(evt: WebhookEvent) {
  const { id } = evt.data

  console.log(`Deleting user from database: ${id}`)

  // Find existing user
  const existing_user = await prisma.user.findUnique({
    where: { clerk_id: id }
  })

  if (!existing_user) {
    console.warn(`User ${id} not found in database, skipping deletion`)
    return
  }

  // Soft delete user (preserve audit logs)
  await prisma.user.update({
    where: { clerk_id: id },
    data: {
      is_active: false,
      deleted_at: new Date(),
      updated_at: new Date(),
    },
  })

  // Log the user deletion event
  await prisma.auditLog.create({
    data: {
      user_id: existing_user.id,
      action: 'user_deleted',
      details: {
        clerk_id: id,
        source: 'clerk_webhook'
      },
      ip_address: null,
      user_agent: 'Clerk Webhook',
      timestamp: new Date(),
    },
  })

  console.log(`Successfully soft-deleted user: ${id}`)
}