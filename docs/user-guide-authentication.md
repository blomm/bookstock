# BookStock User Guide: Authentication & Access

## Welcome to BookStock!

This guide will help you understand how to access BookStock, manage your account, and work within your assigned permissions.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Signing In](#signing-in)
3. [Your User Profile](#your-user-profile)
4. [Understanding Your Role](#understanding-your-role)
5. [What You Can Do](#what-you-can-do)
6. [Troubleshooting](#troubleshooting)
7. [Getting Help](#getting-help)

## Getting Started

### First-Time Access

When you first receive access to BookStock, you'll get an email invitation from your administrator. Follow these steps:

1. **Check Your Email**
   - Look for an email from BookStock (via Clerk)
   - Subject: "Welcome to BookStock"
   - Click the invitation link

2. **Create Your Account**
   - Enter your email address (use the email you were invited with)
   - Create a strong password:
     - At least 8 characters
     - Mix of uppercase and lowercase letters
     - Include numbers and symbols
   - Confirm your password

3. **Verify Your Email**
   - Check for a verification email
   - Click the verification link
   - You'll be redirected to BookStock

4. **First Login**
   - You'll automatically be logged in
   - You'll be assigned a default "Read-Only User" role
   - An administrator will upgrade your role based on your job function

### System Requirements

BookStock works best with:
- **Browsers**: Chrome, Firefox, Safari, or Edge (latest version)
- **Internet**: Stable connection required
- **Screen**: 1280x720 or larger recommended
- **JavaScript**: Must be enabled

## Signing In

### Regular Sign In

1. **Navigate to BookStock**
   - Go to your company's BookStock URL
   - Usually: `https://bookstock.yourcompany.com`

2. **Enter Credentials**
   - Email address
   - Password
   - Click "Sign In"

3. **Two-Factor Authentication** (if enabled)
   - Enter the code from your authenticator app
   - Or enter the code sent to your email/phone

4. **Stay Signed In** (optional)
   - Check "Remember me" to stay signed in for 7 days
   - Don't use this on shared computers!

### Forgot Password?

If you've forgotten your password:

1. Click "Forgot Password?" on the sign-in page
2. Enter your email address
3. Check your email for a reset link
4. Click the link and create a new password
5. Sign in with your new password

### Sign Out

To sign out:

1. Click your name in the top-right corner
2. Click "Sign Out"
3. You'll be returned to the sign-in page

**Always sign out when:**
- Using a shared computer
- Leaving your desk for extended periods
- At the end of your workday

## Your User Profile

### Viewing Your Profile

1. Click your name in the top-right corner
2. Select "Profile" or "Account Settings"
3. View your:
   - Name
   - Email address
   - Role and permissions
   - Account creation date

### Updating Your Profile

You can update:

**Name:**
1. Go to Profile Settings
2. Click "Edit" next to your name
3. Update first name and/or last name
4. Click "Save"

**Email Address:**
1. Go to Profile Settings
2. Click "Change Email"
3. Enter new email address
4. Verify via email link
5. Email will be updated

**Password:**
1. Go to Profile Settings
2. Click "Change Password"
3. Enter current password
4. Enter new password (twice)
5. Click "Update Password"

**Profile Photo:**
1. Go to Profile Settings
2. Click on your profile photo
3. Upload a new photo
4. Crop as desired
5. Click "Save"

### Security Settings

**Two-Factor Authentication (2FA):**

We strongly recommend enabling 2FA for added security:

1. Go to Profile Settings → Security
2. Click "Enable Two-Factor Authentication"
3. Choose your method:
   - **Authenticator App** (recommended): Google Authenticator, Authy, etc.
   - **SMS**: Receive codes via text message
   - **Email**: Receive codes via email
4. Follow the setup instructions
5. Save your backup codes in a safe place

**Active Sessions:**

View and manage your active sessions:

1. Go to Profile Settings → Security → Active Sessions
2. See where you're signed in
3. Sign out of individual sessions if needed
4. Use "Sign out everywhere" to end all sessions

## Understanding Your Role

### What is a User Role?

A user role determines what you can do in BookStock. Your role is assigned by an administrator based on your job function.

### The Five Roles

#### Read-Only User 🔍
**What you can do:**
- View book titles and information
- View inventory levels
- View basic reports
- Search and filter data

**What you can't do:**
- Create or modify records
- Delete data
- Access admin features
- Manage users

**Typical jobs:** External partners, report viewers, stakeholders

#### Inventory Clerk 📦
**What you can do:**
- Everything Read-Only Users can do, PLUS:
- Update inventory quantities
- Record stock adjustments
- View warehouse details
- Generate inventory reports

**What you can't do:**
- Create new titles or warehouses
- Delete records
- Manage users
- Access financial reports

**Typical jobs:** Warehouse staff, stock handlers, inventory counters

#### Financial Controller 💰
**What you can do:**
- View all titles and inventory
- Generate detailed financial reports
- Export data for analysis
- View audit logs
- Access royalty calculations

**What you can't do:**
- Modify inventory
- Create or delete titles
- Manage warehouses
- Manage users

**Typical jobs:** Finance team, accountants, auditors

#### Operations Manager 🎯
**What you can do:**
- Everything Inventory Clerks can do, PLUS:
- Create new titles
- Manage warehouses
- Full inventory control
- Generate all reports
- View audit logs

**What you can't do:**
- Manage user accounts
- Assign roles
- Change system settings

**Typical jobs:** Warehouse managers, operations supervisors, logistics coordinators

#### Administrator 👑
**What you can do:**
- Everything! Full system access
- Manage users and roles
- System configuration
- Access all features
- View complete audit logs

**Typical jobs:** System administrators, IT staff, senior management

### Checking Your Role

To see your current role:

1. Click your name in the top-right corner
2. Your role is displayed under your name
3. Or go to Profile → Account Details

### Requesting a Role Change

If you need different permissions:

1. Contact your system administrator
2. Explain what tasks you need to perform
3. Administrator will review and update your role if appropriate
4. You'll receive an email notification of the change
5. Sign out and back in for changes to take effect

## What You Can Do

### Features by Role

#### Viewing Titles
**Who can:** Everyone

**How to:**
1. Click "Titles" in the main menu
2. Browse the list of books
3. Use search box to find specific titles
4. Click a title to see details
5. View ISBN, author, publisher, pricing, and inventory

#### Managing Inventory
**Who can:** Inventory Clerks, Operations Managers, Admins

**How to:**
1. Click "Inventory" in the main menu
2. Find the title you want to update
3. Click "Adjust Stock"
4. Enter the new quantity or adjustment
5. Add a note explaining the change
6. Click "Save"

#### Creating New Titles
**Who can:** Operations Managers, Admins

**How to:**
1. Click "Titles" → "Add New Title"
2. Enter required information:
   - ISBN
   - Title
   - Author
   - Publisher (optional)
   - Retail Price
   - Cost Price
3. Click "Create Title"
4. Title is now in the system

#### Managing Warehouses
**Who can:** Operations Managers, Admins

**How to:**
1. Click "Warehouses" in the main menu
2. Click "Add Warehouse" to create new
3. Or click existing warehouse to edit
4. Update warehouse details
5. Click "Save"

#### Generating Reports
**Who can:** Everyone (different reports by role)

**How to:**
1. Click "Reports" in the main menu
2. Choose report type:
   - Inventory Report
   - Sales Report
   - Financial Report (Financial Controllers, Admins)
   - Audit Report (Operations Managers, Admins)
3. Select date range and filters
4. Click "Generate Report"
5. View online or export to Excel/PDF

#### Managing Users
**Who can:** Admins only

**How to:**
1. Click "Admin" → "User Management"
2. View list of all users
3. Click user to edit
4. Update details or change role
5. Or click "Deactivate" to disable account
6. Click "Save"

### Access Denied?

If you see "Access Denied" or "Forbidden" when trying to access a feature:

1. **Check Your Role**: You may not have permission
2. **Contact Admin**: Request appropriate role if needed
3. **Refresh Page**: Sometimes helps after role changes
4. **Sign Out and In**: Ensures latest permissions are loaded

## Troubleshooting

### Can't Sign In

**"Invalid email or password"**
- Double-check your email address
- Check for typos in password
- Try "Forgot Password?" to reset

**"Account not found"**
- You may not be invited yet
- Contact your administrator
- Check you're using the correct email

**"Account locked"**
- Too many failed login attempts
- Wait 30 minutes and try again
- Or contact administrator to unlock

### Two-Factor Code Not Working

**"Invalid code"**
- Check your clock is synchronized
- Ensure you're using the latest code
- Codes expire after 30 seconds
- Try using a backup code

**Lost access to authenticator?**
1. Click "Use backup code"
2. Enter one of your saved backup codes
3. Once logged in, reset 2FA settings

### Features Missing or Grayed Out

**Some buttons are grayed out or hidden:**
- This is normal! You only see features you have permission to use
- If you need access, request a role change from administrator

**Features disappeared after update:**
- Sign out and back in
- Clear your browser cache
- Check for role changes with administrator

### Slow Performance

**BookStock is loading slowly:**
- Check your internet connection
- Close unused browser tabs
- Clear browser cache
- Try a different browser
- Contact IT if problem persists

### Page Errors

**"Something went wrong" error:**
1. Refresh the page
2. Sign out and back in
3. Try a different browser
4. Report the issue with details:
   - What you were doing
   - Error message
   - Screenshot if possible

## Getting Help

### In-App Help

- Click the "?" icon in the top-right for context-sensitive help
- Hover over labels for tooltips
- Look for "Learn more" links throughout the app

### Contact Support

**Your System Administrator:**
- For access and permission issues
- Role changes
- Account problems
- General questions

**IT Help Desk:**
- Technical problems
- Login issues
- Browser problems
- System errors

**Training Resources:**
- User training videos
- Quick reference guides
- FAQ document
- Training sessions

### Reporting Issues

When reporting a problem, include:

1. **What happened**: Describe the issue
2. **What you expected**: What should have happened
3. **Steps to reproduce**: How to make it happen again
4. **Screenshots**: If applicable
5. **Your role**: What permissions you have
6. **Browser/device**: What you're using

## Best Practices

### Security

- ✅ Use a strong, unique password
- ✅ Enable two-factor authentication
- ✅ Sign out when leaving your desk
- ✅ Don't share your password
- ✅ Report suspicious activity
- ❌ Don't use "Remember me" on shared computers
- ❌ Don't share your account
- ❌ Don't write down your password

### Daily Use

- ✅ Check your permissions before starting tasks
- ✅ Add notes when adjusting inventory
- ✅ Double-check data before saving
- ✅ Sign out at end of day
- ✅ Report errors immediately
- ❌ Don't attempt to access unauthorized features
- ❌ Don't share sensitive data externally
- ❌ Don't use on public Wi-Fi without VPN

### Data Entry

- ✅ Verify ISBNs are correct
- ✅ Use consistent formatting
- ✅ Add explanatory notes
- ✅ Double-check quantities
- ✅ Save your work frequently
- ❌ Don't leave forms half-completed
- ❌ Don't enter placeholder data
- ❌ Don't guess at information

## Privacy & Data Protection

### Your Data Rights

Under GDPR and similar regulations, you have the right to:

1. **Access**: View all your personal data
2. **Rectify**: Correct inaccurate information
3. **Erase**: Request deletion of your account
4. **Port**: Export your data
5. **Object**: Opt out of certain processing

### Requesting Your Data

To request a copy of your personal data:

1. Go to Profile → Privacy
2. Click "Request My Data"
3. Confirm your request
4. Receive export within 30 days

### Deleting Your Account

To request account deletion:

1. Go to Profile → Privacy
2. Click "Delete My Account"
3. Confirm you understand the implications
4. Account will be deleted within 30 days
5. Audit logs will be anonymized

### What We Store

BookStock stores:

- Your name and email address
- Your role and permissions
- Your activity logs (for audit purposes)
- Your profile photo (if uploaded)
- Session information

We **don't** store:

- Your password (encrypted by Clerk)
- Payment information
- Personal documents
- Tracking cookies

## Frequently Asked Questions

**Q: How long do I stay signed in?**
A: 7 days if you check "Remember me", otherwise until you close your browser.

**Q: Can I have multiple roles?**
A: Yes! Administrators can assign multiple roles to your account. You'll have all permissions from all assigned roles.

**Q: What happens if I forget to sign out?**
A: Your session will expire after 7 days. For security, always sign out when finished.

**Q: Can I access BookStock on my phone?**
A: Yes! BookStock is responsive and works on mobile devices, though some features work better on larger screens.

**Q: Why can't I see the Admin menu?**
A: You need Administrator role to access admin features. Contact your admin if you need this access.

**Q: How do I change my role?**
A: You can't change your own role. Contact your administrator to request a role change.

**Q: What happens if I enter wrong data?**
A: Depending on your role, you may be able to edit or delete the entry. Otherwise, contact an Operations Manager or Admin for help.

**Q: Can I download/export data?**
A: Yes! Most reports can be exported to Excel or PDF format. Some exports require higher permission levels.

**Q: Is my password secure?**
A: Yes! Passwords are encrypted and never stored in plain text. We use Clerk, an industry-leading authentication provider.

**Q: What is two-factor authentication?**
A: An extra security layer that requires a code from your phone in addition to your password. Highly recommended!

---

**Need more help?** Contact your system administrator or IT support team.

**Document Version:** 1.0
**Last Updated:** January 2025
