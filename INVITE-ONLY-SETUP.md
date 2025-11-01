# Invite-Only System Setup - Summary

The BookStock system is now configured as **invite-only**. Users cannot self-register.

## What Changed

### 1. Public Signup Blocked ✅
- `/sign-up` route now redirects to `/access-denied`
- Homepage no longer shows "Create Account" button
- Added message: "This is an invite-only system. Contact your administrator for access."

### 2. Webhook Enhanced ✅
- Updated `/api/auth/webhook/route.ts` to set roles in **both**:
  - PostgreSQL database (UserRole table)
  - Clerk publicMetadata (what the app actually reads)
- New users automatically get `read_only_user` role when invited

### 3. Admin Interface Created ✅
- New "Invite New User" form on `/admin` page
- Admins can send invitations with pre-assigned roles
- API endpoint: `POST /api/admin/invites`
- Shows pending invitations: `GET /api/admin/invites`

### 4. Documentation Added ✅
- Complete guide: `docs/admin-guides/invite-only-setup.md`
- Covers: invitation flow, Clerk config, troubleshooting

## How to Invite Users

1. **As admin, navigate to**: http://localhost:3000/admin

2. **Fill out the form**:
   - Email address of the person to invite
   - Select their role (admin, operations_manager, etc.)

3. **Click "Send Invitation"**

4. **User receives email** from Clerk with invitation link

5. **User clicks link** and creates their account

6. **User automatically gets assigned role** and can access the system

## Files Modified

- `src/middleware.ts` - Block signup routes
- `src/app/page.tsx` - Remove signup button
- `src/app/api/auth/webhook/route.ts` - Set role in Clerk metadata
- `src/app/admin/page.tsx` - Add invite form

## Files Created

- `src/app/api/admin/invites/route.ts` - API for sending invites
- `src/components/admin/invite-user-form.tsx` - Invite form component
- `docs/admin-guides/invite-only-setup.md` - Complete documentation

## Next Steps: Clerk Configuration

To complete the setup, configure Clerk Dashboard:

1. **Go to**: https://dashboard.clerk.com
2. **Navigate to**: User & Authentication → Restrictions
3. **Enable**: Allowlist mode or domain restrictions (optional but recommended)
4. **Configure**: User & Authentication → Invitations
   - Set invitation expiration time
   - Customize email template
   - Set redirect URL to `/dashboard`

## Testing the Flow

### Test 1: Signup is Blocked
1. Visit: http://localhost:3000/sign-up
2. **Expected**: Redirects to `/access-denied`

### Test 2: Send an Invitation
1. Login as admin
2. Go to: http://localhost:3000/admin
3. Fill out "Invite New User" form
4. **Expected**: Success message, invitation email sent

### Test 3: Accept Invitation
1. Check email inbox (the email you invited)
2. Click invitation link
3. Create account
4. Login
5. **Expected**: Dashboard shows the role you assigned

## Managing Your Admin Account

Your account (mike_geomatics@yahoo.com) is already set as admin via the script we ran:

```bash
npx tsx scripts/set-clerk-role.ts mike_geomatics@yahoo.com admin
```

You can use this script to manually assign roles if needed:

```bash
# Syntax
npx tsx scripts/set-clerk-role.ts <email> <role>

# Example
npx tsx scripts/set-clerk-role.ts user@example.com operations_manager
```

## Available Roles

- `admin` - Full system access (you)
- `operations_manager` - Manage inventory and warehouses
- `inventory_clerk` - Update inventory only
- `financial_controller` - View and export reports
- `read_only_user` - View-only access (default for new invites)

## Troubleshooting

**Problem**: User has no role after accepting invite
**Solution**: Check webhook configuration in Clerk Dashboard, or manually assign:
```bash
npx tsx scripts/set-clerk-role.ts user@example.com read_only_user
```

**Problem**: Invitation email not received
**Solution**:
- Check spam folder
- Verify email address in Clerk Dashboard → Users → Invitations
- Resend invitation

For more details, see: `docs/admin-guides/invite-only-setup.md`
