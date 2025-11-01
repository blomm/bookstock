# Invite-Only User Access Setup

This system is configured as **invite-only**. Users cannot self-register; they must be invited by an administrator.

## Table of Contents
- [Overview](#overview)
- [How It Works](#how-it-works)
- [Inviting New Users](#inviting-new-users)
- [Clerk Dashboard Configuration](#clerk-dashboard-configuration)
- [Managing User Roles](#managing-user-roles)
- [Troubleshooting](#troubleshooting)

## Overview

The BookStock system uses an invite-only access model to ensure:
- **Security**: Only authorized personnel can access the system
- **Control**: Admins control who gets access and what permissions they have
- **Compliance**: Maintains audit trails of who invited whom
- **Clean onboarding**: New users get the right permissions from day one

## How It Works

### User Registration Flow

1. **Admin sends invitation**
   - Admin logs into `/admin`
   - Fills out the "Invite New User" form
   - Selects appropriate role for the new user
   - Clicks "Send Invitation"

2. **User receives email**
   - Clerk sends an email with an invitation link
   - Link is valid for a limited time (configurable in Clerk)

3. **User accepts invitation**
   - Clicks the link in the email
   - Creates their account (sets password, etc.)
   - Automatically assigned the role selected by the admin

4. **User gains access**
   - Role is set in both Clerk metadata and the database
   - User can immediately access features based on their role
   - Audit log records the account creation

### Public Signup Prevention

- The `/sign-up` route is **blocked** at the middleware level
- Any attempts to access `/sign-up` redirect to `/access-denied`
- Homepage does not show a "Create Account" button
- Only sign-in and direct dashboard access are available publicly

## Inviting New Users

### Prerequisites

You must be logged in as a user with the **admin** role.

### Steps

1. Navigate to the admin panel: `/admin`

2. Locate the "Invite New User" section at the top of the page

3. Fill out the form:
   - **Email Address**: The email address of the person you want to invite
   - **Role**: Select the appropriate role from the dropdown

4. Click "Send Invitation"

5. The user will receive an email from Clerk with instructions

### Available Roles

When inviting a user, you can assign one of these roles:

| Role | Description | Typical Use Case |
|------|-------------|------------------|
| **Admin** | Full system access, can invite users | System administrators, IT staff |
| **Operations Manager** | Manage inventory and warehouses | Warehouse managers, operations leads |
| **Inventory Clerk** | Update inventory only | Data entry staff, warehouse workers |
| **Financial Controller** | View and export reports | Finance team, accountants |
| **Read Only User** | View-only access | Auditors, stakeholders, analysts |

See [User Roles & Permissions](../user-guides/roles-and-permissions.md) for detailed permission breakdowns.

## Clerk Dashboard Configuration

To ensure invite-only mode works correctly, configure the following in your Clerk Dashboard:

### 1. Disable Public Sign-up

1. Go to your Clerk Dashboard: https://dashboard.clerk.com
2. Select your application
3. Navigate to **User & Authentication** → **Email, Phone, Username**
4. Under **Authentication strategies**, ensure you have:
   - Email address (enabled)
   - Password (enabled)
5. Navigate to **User & Authentication** → **Restrictions**
6. Enable **Allowlist mode** or configure **Email Domain Restrictions** if needed

### 2. Configure Invitation Settings

1. In Clerk Dashboard, go to **User & Authentication** → **Invitations**
2. Customize:
   - Invitation expiration time (default: 7 days)
   - Email template for invitations
   - Redirect URL after acceptance (should be `/dashboard`)

### 3. Set Up Webhooks

The system uses webhooks to sync user data. Ensure webhooks are configured:

1. In Clerk Dashboard, go to **Webhooks**
2. Add endpoint: `https://yourdomain.com/api/auth/webhook`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the webhook signing secret
5. Add to `.env.local`:
   ```
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

## Managing User Roles

### Viewing All Users

1. Navigate to `/admin`
2. Scroll to "User Management" section
3. View all users with their current roles

### Changing a User's Role

You can change user roles in two ways:

#### Option 1: Using the Admin Interface (Recommended)

1. Navigate to `/admin`
2. Find the user in the "User Management" table
3. Click "Edit" next to their name
4. Update their role
5. Click "Save"

#### Option 2: Using the CLI Script

For bulk operations or troubleshooting:

```bash
npx tsx scripts/set-clerk-role.ts user@example.com operations_manager
```

### Deactivating Users

1. Navigate to `/admin`
2. Find the user in the table
3. Click "Deactivate"
4. User is soft-deleted (data preserved for auditing)

## Troubleshooting

### User Can't Sign Up

**Expected behavior**. This is an invite-only system. The admin must send an invitation.

### Invitation Email Not Received

1. **Check spam folder**: Clerk emails sometimes land in spam
2. **Verify email address**: Ensure no typos in the email address
3. **Check Clerk Dashboard**: View invitation status in Clerk Dashboard → Users → Invitations
4. **Resend invitation**: Delete the pending invitation and send a new one

### User Has No Role After Accepting Invitation

This indicates a webhook configuration issue:

1. **Check webhook is configured** in Clerk Dashboard
2. **Verify webhook secret** in `.env.local`:
   ```bash
   echo $CLERK_WEBHOOK_SECRET
   ```
3. **Check webhook logs** in Clerk Dashboard → Webhooks → View Logs
4. **Manually assign role** as a workaround:
   ```bash
   npx tsx scripts/set-clerk-role.ts user@example.com read_only_user
   ```

### User Gets "Access Denied" After Login

Possible causes:

1. **No role assigned**: Check the user's role in `/admin`
2. **Webhook failed**: Check Clerk webhook logs
3. **Browser cache**: Try incognito mode or clear cookies
4. **Manual fix**:
   ```bash
   npx tsx scripts/set-clerk-role.ts user@example.com their_role
   ```

### Creating the First Admin User

If you need to bootstrap the first admin (e.g., after fresh installation):

1. **Option A**: Use the setup script:
   ```bash
   npx tsx scripts/set-clerk-role.ts your@email.com admin
   ```

2. **Option B**: Directly in Clerk Dashboard:
   - Go to Users → Select your user
   - Edit → Public metadata
   - Add: `{ "role": "admin" }`

## Environment Variables

Required environment variables for invite-only mode:

```bash
# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Webhooks (Required for auto role assignment)
CLERK_WEBHOOK_SECRET=whsec_...

# URLs (Optional - defaults shown)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Security Best Practices

1. **Review invitations regularly**: Check pending invitations in Clerk Dashboard
2. **Revoke unused invitations**: Delete expired or unused invitations
3. **Use least privilege**: Assign the minimum role needed for each user
4. **Audit user activity**: Review audit logs regularly at `/admin/audit-logs`
5. **Deactivate instead of delete**: Soft-delete users to preserve audit trails
6. **Monitor webhook health**: Set up alerts for webhook failures in Clerk

## Additional Resources

- [Clerk Invitations Documentation](https://clerk.com/docs/authentication/invitations)
- [User Roles & Permissions](../user-guides/roles-and-permissions.md)
- [Webhook Configuration](../admin-guides/webhook-setup.md)
- [Security Best Practices](../admin-guides/security.md)
