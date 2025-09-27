# User Authentication Specification

**Phase:** 1 (Core Inventory Management)
**Feature:** User Authentication - Secure login system with role-based access control
**Effort:** M (1 week)
**Status:** Pending Implementation

## Overview

Implement secure user authentication and role-based authorization using Clerk authentication service with custom role management stored in PostgreSQL. This system will provide secure access control for the BookStock inventory management platform with different permission levels for publishing operations team members.

## Requirements

### Functional Requirements

#### Authentication
- **Secure Login/Signup**: Email-based authentication with password requirements
- **Session Management**: JWT-based sessions managed by Clerk
- **Password Security**: Clerk-managed password policies and reset functionality
- **Multi-Factor Authentication**: Optional MFA for enhanced security
- **Account Verification**: Email verification for new accounts

#### Authorization
- **Role-Based Access Control (RBAC)**: Hierarchical permission system
- **User Roles**: Predefined roles with specific permissions
- **Permission Enforcement**: API and UI-level access controls
- **Role Assignment**: Administrative ability to assign/modify user roles

#### User Management
- **User Profiles**: Basic user information and preferences
- **Account Settings**: User-managed account preferences
- **Activity Logging**: Track user actions for audit purposes

### Non-Functional Requirements

- **Security**: Industry-standard authentication with JWT tokens
- **Performance**: Sub-500ms authentication checks
- **Scalability**: Support for 50+ concurrent users initially
- **Availability**: 99.9% uptime leveraging Clerk's infrastructure
- **Compliance**: GDPR-compliant user data handling

## Technical Architecture

### Authentication Provider
- **Primary**: Clerk (JWT sessions)
- **Fallback**: None (Clerk handles redundancy)
- **Token Storage**: Clerk-managed secure cookies
- **Session Duration**: Configurable (default: 7 days)

### Database Schema

#### User Model
```prisma
model User {
  id              String    @id @default(cuid())
  clerkId         String    @unique @map("clerk_id")
  email           String    @unique
  firstName       String?   @map("first_name") @db.VarChar(100)
  lastName        String?   @map("last_name") @db.VarChar(100)
  isActive        Boolean   @default(true) @map("is_active")
  lastLoginAt     DateTime? @map("last_login_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relationships
  userRoles       UserRole[]
  auditLogs       AuditLog[]

  @@map("users")
  @@index([clerkId])
  @@index([email])
  @@index([isActive])
}
```

#### Role Model
```prisma
model Role {
  id              String    @id @default(cuid())
  name            String    @unique @db.VarChar(50)
  description     String?   @db.Text
  permissions     Json      // Array of permission strings
  isSystem        Boolean   @default(false) @map("is_system")
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relationships
  userRoles       UserRole[]

  @@map("roles")
  @@index([name])
  @@index([isActive])
}
```

#### UserRole Model
```prisma
model UserRole {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  roleId          String    @map("role_id")
  assignedBy      String?   @map("assigned_by")
  assignedAt      DateTime  @default(now()) @map("assigned_at")
  expiresAt       DateTime? @map("expires_at")
  isActive        Boolean   @default(true) @map("is_active")

  // Relationships
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  role            Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@map("user_roles")
  @@index([userId])
  @@index([roleId])
  @@index([isActive])
}
```

#### Audit Log Model
```prisma
model AuditLog {
  id              String    @id @default(cuid())
  userId          String?   @map("user_id")
  action          String    @db.VarChar(100)
  resource        String?   @db.VarChar(100)
  resourceId      String?   @map("resource_id")
  details         Json?     // Additional context data
  ipAddress       String?   @map("ip_address") @db.VarChar(45)
  userAgent       String?   @map("user_agent") @db.Text
  timestamp       DateTime  @default(now())

  // Relationships
  user            User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@map("audit_logs")
  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([timestamp])
}
```

## Role Definitions

### Admin
- **Description**: Full system access for system administrators
- **Permissions**:
  - `user:*` (all user management)
  - `role:*` (all role management)
  - `title:*` (all title operations)
  - `inventory:*` (all inventory operations)
  - `warehouse:*` (all warehouse operations)
  - `settings:*` (system configuration)
  - `audit:read` (access audit logs)

### Operations Manager
- **Description**: Publishing operations team lead with broad inventory management access
- **Permissions**:
  - `title:read,create,update` (title management)
  - `inventory:read,update` (inventory management)
  - `warehouse:read,update` (warehouse operations)
  - `movement:read,create,approve` (stock movements)
  - `report:read,create` (reporting access)
  - `user:read` (view team members)

### Inventory Clerk
- **Description**: Staff member responsible for day-to-day inventory operations
- **Permissions**:
  - `title:read` (view titles)
  - `inventory:read,update` (inventory updates)
  - `movement:read,create` (stock movements)
  - `warehouse:read` (view warehouse info)
  - `report:read` (basic reporting)

### Financial Controller
- **Description**: Finance team member with access to financial data and reports
- **Permissions**:
  - `title:read` (view title information)
  - `inventory:read` (view inventory values)
  - `financial:read,create` (financial reports)
  - `report:read,create,export` (comprehensive reporting)
  - `royalty:read,calculate` (royalty calculations)

### Read-Only User
- **Description**: View-only access for stakeholders and junior team members
- **Permissions**:
  - `title:read` (view titles)
  - `inventory:read` (view inventory)
  - `report:read` (basic reporting)

## Implementation Tasks

### Phase 1.6.1: Database Schema Setup
- [ ] Add User, Role, UserRole, and AuditLog models to Prisma schema
- [ ] Create and run database migration
- [ ] Seed initial roles (Admin, Operations Manager, Inventory Clerk, Financial Controller, Read-Only User)
- [ ] Create user service for database operations

### Phase 1.6.2: Clerk Integration
- [ ] Install and configure Clerk SDK
- [ ] Set up Clerk environment variables
- [ ] Create Clerk webhook handler for user sync
- [ ] Implement middleware for authentication checks
- [ ] Create user registration/login flows

### Phase 1.6.3: Authorization System
- [ ] Create permission checking utilities
- [ ] Implement role-based route protection
- [ ] Add authorization to API routes
- [ ] Create admin interface for user management
- [ ] Implement audit logging system

### Phase 1.6.4: UI Components
- [ ] Create login/signup pages
- [ ] Build user profile management
- [ ] Develop role assignment interface (admin only)
- [ ] Add user menu and logout functionality
- [ ] Create access denied pages

### Phase 1.6.5: Testing & Security
- [ ] Unit tests for authentication utilities
- [ ] Integration tests for protected routes
- [ ] Security testing for authorization bypass
- [ ] Performance testing for auth checks
- [ ] Documentation and user guides

## API Endpoints

### Authentication Routes
- `POST /api/auth/webhook` - Clerk webhook handler
- `GET /api/auth/user` - Get current user profile
- `PUT /api/auth/user` - Update user profile
- `POST /api/auth/logout` - Logout user

### User Management Routes (Admin only)
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/[id]` - Get user details
- `PUT /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Deactivate user
- `POST /api/admin/users/[id]/roles` - Assign role to user
- `DELETE /api/admin/users/[id]/roles/[roleId]` - Remove role from user

### Audit Routes
- `GET /api/audit/logs` - Get audit logs (filtered)
- `GET /api/audit/user/[id]` - Get user activity logs

## Environment Variables

```env
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
CLERK_WEBHOOK_SECRET=whsec_...

# Security
AUTH_TOKEN_EXPIRY=7d
SESSION_SECRET=your-session-secret
```

## Security Considerations

### Authentication Security
- JWT tokens managed by Clerk with automatic rotation
- Secure cookie storage with httpOnly and secure flags
- XSS protection through proper token handling
- CSRF protection via SameSite cookie settings

### Authorization Security
- Permission checks at both API and UI levels
- Least privilege principle for role permissions
- Audit logging for all user actions
- Regular review of user permissions and access

### Data Protection
- Sensitive user data stored securely
- GDPR compliance for user data handling
- Audit logs for data access tracking
- Secure password handling via Clerk

## Success Criteria

### Functional Success
- [ ] Users can securely register and login
- [ ] Role-based permissions enforced across all features
- [ ] Admin users can manage other user accounts and roles
- [ ] Audit logs capture all user actions
- [ ] Session management works reliably across browser sessions

### Performance Success
- [ ] Authentication checks complete in <500ms
- [ ] Login/logout operations complete in <2s
- [ ] Role permission checks complete in <100ms
- [ ] User interface responds smoothly with auth state

### Security Success
- [ ] No authentication bypass vulnerabilities
- [ ] All API endpoints properly protected
- [ ] Audit logs capture security-relevant events
- [ ] Password and session security meet industry standards

## Dependencies

### Technical Dependencies
- Clerk authentication service
- PostgreSQL database with user schema
- Next.js middleware system
- Prisma ORM for user data

### Business Dependencies
- User role definitions approved by stakeholders
- Security requirements defined
- Compliance requirements (GDPR) understood
- Initial admin user access method defined

## Rollout Plan

### Phase 1: Foundation (Days 1-2)
- Database schema implementation
- Clerk setup and configuration
- Basic authentication flows

### Phase 2: Authorization (Days 3-4)
- Role-based permission system
- API route protection
- Admin user management interface

### Phase 3: Integration (Days 5-6)
- UI integration across existing features
- Audit logging implementation
- Security testing and fixes

### Phase 4: Testing & Documentation (Day 7)
- Comprehensive testing
- Documentation completion
- Stakeholder review and approval

## Post-Implementation

### Monitoring
- User authentication success rates
- Failed login attempt tracking
- Session duration analytics
- Role usage statistics

### Maintenance
- Regular security updates via Clerk
- Periodic review of user roles and permissions
- Audit log cleanup and archival
- User account cleanup (inactive users)

### Future Enhancements
- Single Sign-On (SSO) integration
- Advanced MFA options
- Integration with external user directories
- Advanced audit reporting and analytics