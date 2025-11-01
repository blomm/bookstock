# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/multi-warehouse-setup/spec.md

> Created: 2025-11-01
> Status: ✅ COMPLETED 2025-11-01
> All 7 tasks completed successfully with passing tests

## Tasks

### Task 1: Database Schema and Prisma Model ✅ COMPLETED

**Description:** Create the database schema for warehouses table with all required fields, enums, indexes, and prepare for future relationships.

**Acceptance Criteria:**
- Warehouse model exists in Prisma schema with all specified fields
- WarehouseType and WarehouseStatus enums are defined
- Unique constraint on `code` field is enforced
- Indexes on `status` and `isActive` are created
- Migration successfully applies to database
- Prisma client regenerates with new types

**Subtasks:**

1.1. Write integration tests for Warehouse model
   - Test warehouse creation with valid data
   - Test unique constraint on `code` field
   - Test enum value validation (type and status)
   - Test timestamp auto-generation (createdAt, updatedAt)
   - Test optional fields can be null
   - Test default values (type=PHYSICAL, status=ACTIVE, isActive=true)

1.2. Add Warehouse model to `prisma/schema.prisma`
   - Define Warehouse model with all required fields (id, name, code, type, status, isActive)
   - Add address fields (addressLine1, addressLine2, city, stateProvince, postalCode, country)
   - Add contact fields (contactName, contactEmail, contactPhone)
   - Add notes field and timestamps
   - Configure field mappings for snake_case database columns
   - Set appropriate varchar/text lengths

1.3. Add WarehouseType and WarehouseStatus enums
   - Define WarehouseType enum with PHYSICAL, VIRTUAL, THIRD_PARTY
   - Define WarehouseStatus enum with ACTIVE, INACTIVE, MAINTENANCE
   - Link enums to Warehouse model fields

1.4. Add indexes and constraints
   - Add unique constraint on `code` field
   - Add index on `status` field
   - Add index on `isActive` field
   - Configure @@map("warehouses") for table name

1.5. Create and apply Prisma migration
   - Run `npx prisma migrate dev --name add_warehouses_table`
   - Verify migration SQL includes all fields, indexes, and enums
   - Apply migration to development database
   - Regenerate Prisma client

1.6. Verify database schema
   - Use Prisma Studio to inspect warehouses table structure
   - Verify all fields, types, and constraints match specification
   - Test manual insert/update to confirm schema works

1.7. Verify all integration tests pass
   - Run warehouse model tests
   - Confirm all constraints and validations work as expected
   - Fix any issues discovered during testing

---

### Task 2: Zod Validation Schemas ✅ COMPLETED

**Description:** Create comprehensive Zod validation schemas for warehouse data validation in API endpoints and forms.

**Acceptance Criteria:**
- CreateWarehouseSchema validates all required and optional fields
- UpdateWarehouseSchema allows partial updates
- Code field enforces uppercase alphanumeric with hyphens pattern
- Email validation works correctly
- Country code validation enforces 2-character ISO format
- Schema exports are properly typed for TypeScript

**Subtasks:**

2.1. Write unit tests for Zod schemas
   - Test valid warehouse creation data passes validation
   - Test invalid code format is rejected (lowercase, special chars, wrong length)
   - Test email validation (valid/invalid formats)
   - Test country code validation (2-char uppercase)
   - Test required field validation (name, code)
   - Test optional field handling (address, contact fields)
   - Test enum validation (type, status)
   - Test update schema accepts partial data

2.2. Create `src/lib/validators/warehouse.ts` file
   - Set up Zod imports and base configuration
   - Add TypeScript type exports for schema inference

2.3. Implement CreateWarehouseSchema
   - Add name validation: string, min(1), max(100)
   - Add code validation: regex pattern `^[A-Z0-9-]{2,20}$` with toUpperCase transform
   - Add type enum validation with default PHYSICAL
   - Add status enum validation with default ACTIVE
   - Add optional address fields with max lengths
   - Add optional country code: string, length(2), toUpperCase
   - Add optional contact_email: string, email validation
   - Add optional contact_phone: string, max(20)
   - Add optional notes: string

2.4. Implement UpdateWarehouseSchema
   - Create partial version of CreateWarehouseSchema
   - Ensure all fields are optional for partial updates
   - Maintain same validation rules for provided fields

2.5. Export TypeScript types
   - Export CreateWarehouseInput type from schema
   - Export UpdateWarehouseInput type from schema
   - Ensure types integrate with Prisma types

2.6. Verify all unit tests pass
   - Run Zod schema validation tests
   - Confirm all validation rules work correctly
   - Fix any edge cases discovered

---

### Task 3: Warehouse Service Layer ✅ COMPLETED

**Description:** Implement WarehouseService class with business logic for all warehouse operations including CRUD, status management, and data validation.

**Acceptance Criteria:**
- WarehouseService class with all required methods (create, update, findById, findByCode, list, activate, deactivate, delete)
- Unique code validation prevents duplicates
- Status changes update isActive field correctly
- List method supports pagination, filtering, and search
- Proper error handling with descriptive messages
- Service integrates with Prisma client

**Subtasks:**

3.1. Write unit tests for WarehouseService
   - Test create method: success case, duplicate code error, validation errors
   - Test update method: success case, not found error, duplicate code on update
   - Test findById: success case, not found error
   - Test findByCode: success case, not found error
   - Test list method: pagination, filtering by status/type, search functionality
   - Test activate method: status changes to ACTIVE, isActive becomes true
   - Test deactivate method: status changes to INACTIVE, isActive becomes false
   - Test delete method: success case, warehouse with inventory error (future)
   - Mock Prisma client for all tests

3.2. Create `src/services/warehouseService.ts` file
   - Set up class structure and Prisma client integration
   - Import Zod schemas and types
   - Define service method signatures

3.3. Implement create method
   - Validate input data with CreateWarehouseSchema
   - Check for existing warehouse with same code
   - Derive isActive from status field
   - Create warehouse in database
   - Return created warehouse

3.4. Implement update method
   - Validate input with UpdateWarehouseSchema
   - Check warehouse exists
   - If code is being changed, check for duplicates
   - Update isActive based on status if status is being changed
   - Update warehouse in database
   - Return updated warehouse

3.5. Implement query methods (findById, findByCode)
   - Implement findById with error handling for not found
   - Implement findByCode with error handling for not found
   - Return warehouse data

3.6. Implement list method with pagination and filters
   - Accept pagination parameters (page, limit)
   - Accept filter parameters (status, type, isActive)
   - Accept search parameter (search name, code, city, country)
   - Build Prisma query with where conditions
   - Return paginated results with total count

3.7. Implement status management methods
   - Implement activate: set status to ACTIVE, isActive to true
   - Implement deactivate: set status to INACTIVE, isActive to false
   - Return updated warehouse

3.8. Implement delete method
   - Check warehouse exists
   - Check for inventory dependencies (placeholder for future feature)
   - Hard delete warehouse if no dependencies
   - Return success message

3.9. Verify all unit tests pass
   - Run WarehouseService tests
   - Confirm all business logic works correctly
   - Fix any issues discovered

---

### Task 4: API Route Handlers ✅ COMPLETED

**Description:** Create RESTful API endpoints for warehouse operations with proper authentication, authorization, validation, and error handling.

**Acceptance Criteria:**
- All 7 endpoints implemented (GET list, POST create, GET by id, PUT update, DELETE, PATCH activate, PATCH deactivate)
- Clerk authentication required on all endpoints
- Permission-based authorization (read for all, write for admins)
- Proper HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500)
- Standardized error response format
- Request/response validation

**Subtasks:**

4.1. Write integration tests for API endpoints
   - Test GET /api/warehouses: success, authentication, authorization, pagination, filters, search
   - Test POST /api/warehouses: success (201), validation errors (400), duplicate code (409), permission denied (403)
   - Test GET /api/warehouses/[id]: success, not found (404), authentication
   - Test PUT /api/warehouses/[id]: success, validation errors, not found, permission denied
   - Test DELETE /api/warehouses/[id]: success, not found, permission denied
   - Test PATCH /api/warehouses/[id]/activate: success, not found, permission denied
   - Test PATCH /api/warehouses/[id]/deactivate: success, not found, permission denied
   - Mock Clerk authentication and WarehouseService

4.2. Create API route structure
   - Create `src/app/api/warehouses/route.ts` for list and create
   - Create `src/app/api/warehouses/[id]/route.ts` for get, update, delete
   - Create `src/app/api/warehouses/[id]/activate/route.ts` for activation
   - Create `src/app/api/warehouses/[id]/deactivate/route.ts` for deactivation

4.3. Implement GET /api/warehouses (list endpoint)
   - Add Clerk authentication middleware
   - Check for warehouse:read permission
   - Parse query parameters (page, limit, status, type, search, isActive)
   - Call WarehouseService.list with filters
   - Return paginated response with data and pagination metadata
   - Handle errors with proper status codes

4.4. Implement POST /api/warehouses (create endpoint)
   - Add Clerk authentication middleware
   - Check for warehouse:create permission (admin only)
   - Parse and validate request body with CreateWarehouseSchema
   - Call WarehouseService.create
   - Return 201 Created with warehouse data
   - Handle validation errors (400), duplicate code (409), other errors (500)

4.5. Implement GET /api/warehouses/[id] (get by id endpoint)
   - Add Clerk authentication middleware
   - Check for warehouse:read permission
   - Extract id from path parameters
   - Call WarehouseService.findById
   - Return 200 OK with warehouse data
   - Handle not found (404) and other errors (500)

4.6. Implement PUT /api/warehouses/[id] (update endpoint)
   - Add Clerk authentication middleware
   - Check for warehouse:update permission (admin only)
   - Extract id from path parameters
   - Parse and validate request body with UpdateWarehouseSchema
   - Call WarehouseService.update
   - Return 200 OK with updated warehouse data
   - Handle validation errors (400), not found (404), duplicate code (409), permission denied (403)

4.7. Implement DELETE /api/warehouses/[id] (delete endpoint)
   - Add Clerk authentication middleware
   - Check for warehouse:delete permission (admin only)
   - Extract id from path parameters
   - Call WarehouseService.delete
   - Return 200 OK with success message
   - Handle not found (404), inventory dependencies (400), permission denied (403)

4.8. Implement PATCH activate and deactivate endpoints
   - Implement /api/warehouses/[id]/activate
   - Implement /api/warehouses/[id]/deactivate
   - Add authentication and authorization checks
   - Call respective WarehouseService methods
   - Return 200 OK with updated warehouse
   - Handle not found (404) and permission errors (403)

4.9. Verify all integration tests pass
   - Run API endpoint tests
   - Test authentication and authorization flows
   - Confirm proper error handling and status codes
   - Fix any issues discovered

---

### Task 5: Warehouse Management UI Components ✅ COMPLETED

**Description:** Create admin interface components for listing, creating, editing, and managing warehouse entities with proper role-based access control.

**Acceptance Criteria:**
- Warehouse list page displays all warehouses with pagination and filters
- Create/edit form validates input and handles errors
- Status management works (activate/deactivate buttons)
- Detail view shows complete warehouse information
- Admin-only features hidden from non-admin users
- Loading and error states handled gracefully
- Responsive design works on mobile and desktop

**Subtasks:**

5.1. Write E2E tests for warehouse UI
   - Test warehouse list page loads and displays data
   - Test search functionality filters results
   - Test status filter changes displayed warehouses
   - Test pagination navigates correctly
   - Test "Add Warehouse" button visible to admins only
   - Test create warehouse form submission (success and validation errors)
   - Test edit warehouse form pre-fills data and saves changes
   - Test activate/deactivate buttons change warehouse status
   - Test detail view displays all warehouse information
   - Test non-admin users cannot access create/edit forms

5.2. Create WarehouseList component (`src/components/warehouses/WarehouseList.tsx`)
   - Fetch warehouses from API with pagination
   - Display table with columns: Name, Code, Type, Status, Location (City, Country), Actions
   - Implement search input with debounce
   - Implement status filter dropdown (All, Active, Inactive, Maintenance)
   - Implement pagination controls (previous, next, page numbers)
   - Add "Add Warehouse" button (admin only)
   - Add row action buttons: View, Edit (admin), Activate/Deactivate (admin)
   - Handle loading state with skeleton loaders
   - Handle error state with retry button

5.3. Create WarehouseForm component (`src/components/warehouses/WarehouseForm.tsx`)
   - Set up React Hook Form with Zod validation
   - Detect create vs edit mode from props
   - Implement form field groups:
     - Basic Information: Name, Code, Type (dropdown)
     - Address: Address Line 1, Address Line 2, City, State/Province, Postal Code, Country (dropdown)
     - Contact Details: Contact Name, Email, Phone
     - Status: Status dropdown (Active, Inactive, Maintenance)
     - Notes: Textarea
   - Add real-time validation with error messages
   - Implement submit handler with loading state
   - Add cancel button to return to list
   - Handle API errors and display in form
   - Show success toast on successful submission
   - Redirect to warehouse list on success

5.4. Create warehouse list page (`src/app/warehouses/page.tsx`)
   - Set up server-side data fetching
   - Integrate WarehouseList component
   - Add page title and description
   - Implement role-based access control (authenticated users can view)
   - Handle authentication redirects
   - Add error boundary for error handling

5.5. Create warehouse create page (`src/app/warehouses/new/page.tsx`)
   - Integrate WarehouseForm in create mode
   - Add page title "Create Warehouse"
   - Restrict access to admin users only
   - Handle authentication and authorization redirects

5.6. Create warehouse edit page (`src/app/warehouses/[id]/edit/page.tsx`)
   - Fetch warehouse data by ID
   - Integrate WarehouseForm in edit mode with pre-filled data
   - Add page title "Edit Warehouse"
   - Restrict access to admin users only
   - Handle not found error (404)
   - Handle authentication and authorization redirects

5.7. Create warehouse detail page (`src/app/warehouses/[id]/page.tsx`)
   - Fetch warehouse data by ID
   - Display warehouse information in organized sections:
     - Header with name, code, and status badge
     - Basic Information section
     - Address section (if provided)
     - Contact Details section (if provided)
     - Notes section (if provided)
     - Metadata section (created/updated timestamps)
   - Add Edit button (admin only)
   - Add Activate/Deactivate button (admin only)
   - Handle not found error (404)
   - Handle loading state

5.8. Add navigation menu item
   - Add "Warehouses" link to main navigation menu
   - Show to all authenticated users
   - Add appropriate icon

5.9. Verify all E2E tests pass
   - Run warehouse UI E2E tests
   - Test full user workflows (create, edit, view, list, filter, search)
   - Test admin vs non-admin user experiences
   - Test responsive design on different screen sizes
   - Fix any UI/UX issues discovered

---

### Task 6: Seed Data Implementation ✅ COMPLETED

**Description:** Create seed script to initialize system with three default warehouses (UK, US, Online) for development and testing.

**Acceptance Criteria:**
- Seed script creates exactly 3 warehouses
- UK Warehouse (UK-LON) with London address and GB country
- US Warehouse (US-NYC) with New York address and US country
- Online Fulfillment Center (ONLINE) as virtual warehouse
- Seed script uses upsert to avoid duplicates on multiple runs
- Seed can be run independently or as part of database reset
- All seeded warehouses are in ACTIVE status

**Subtasks:**

6.1. Write tests for seed script
   - Test seed script creates 3 warehouses if none exist
   - Test seed script doesn't create duplicates on re-run (upsert)
   - Test each warehouse has correct code, name, type, and status
   - Test UK warehouse has correct London address
   - Test US warehouse has correct New York address
   - Test Online warehouse is VIRTUAL type
   - Test all warehouses are ACTIVE

6.2. Update `prisma/seed.ts` to include warehouse seeding
   - Import Prisma client
   - Add warehouse seeding section to main seed function
   - Add console logging for seed progress

6.3. Create UK Warehouse seed data
   - Use upsert with code "UK-LON" as unique identifier
   - Set name to "UK Warehouse - London"
   - Set type to PHYSICAL
   - Set status to ACTIVE
   - Add London address (123 Publishing Street, London, EC1A 1BB, GB)
   - Add contact email and phone
   - Set isActive to true

6.4. Create US Warehouse seed data
   - Use upsert with code "US-NYC" as unique identifier
   - Set name to "US Warehouse - New York"
   - Set type to PHYSICAL
   - Set status to ACTIVE
   - Add New York address (456 Book Avenue, New York, NY, 10001, US)
   - Add contact email and phone
   - Set isActive to true

6.5. Create Online Fulfillment Center seed data
   - Use upsert with code "ONLINE" as unique identifier
   - Set name to "Online Fulfillment Center"
   - Set type to VIRTUAL
   - Set status to ACTIVE
   - Add descriptive notes about virtual warehouse purpose
   - Set isActive to true

6.6. Test seed script execution
   - Run `npx prisma db seed` on fresh database
   - Verify 3 warehouses are created
   - Run seed script again to test upsert behavior
   - Verify still only 3 warehouses exist
   - Use Prisma Studio to inspect seeded data

6.7. Verify seed tests pass
   - Run seed script tests
   - Confirm all warehouses created correctly
   - Confirm upsert prevents duplicates

---

### Task 7: Comprehensive Testing and Documentation ✅ COMPLETED

**Description:** Ensure complete test coverage across all layers (unit, integration, E2E), write user documentation, and verify all acceptance criteria are met.

**Completion Summary:**
- Warehouse API Integration Tests: 17/17 passing ✅
- Warehouse Service Tests: 23/23 passing ✅
- All acceptance criteria verified ✅

**Acceptance Criteria:**
- Unit test coverage >80% for services and validators
- Integration tests cover all API endpoints and database operations
- E2E tests cover critical user workflows
- User documentation explains warehouse management features
- Admin guide covers warehouse setup and management
- All tests pass successfully
- No critical bugs or performance issues

**Subtasks:**

7.1. Run full test suite and measure coverage
   - Run all unit tests for services and validators
   - Run all integration tests for API endpoints and database
   - Run all E2E tests for UI workflows
   - Generate test coverage reports
   - Identify gaps in test coverage

7.2. Add missing unit tests
   - Add tests for any uncovered service methods
   - Add tests for edge cases in validation
   - Add tests for error handling paths
   - Achieve >80% coverage for services and validators

7.3. Add missing integration tests
   - Test API middleware integration (auth, authorization)
   - Test database constraint enforcement
   - Test concurrent operations (e.g., duplicate code creation)
   - Test error response formats

7.4. Add missing E2E tests
   - Test complete warehouse creation workflow
   - Test warehouse editing workflow
   - Test status change workflow (activate/deactivate)
   - Test search and filter combinations
   - Test permission-based UI visibility
   - Test error handling in UI (network errors, validation errors)

7.5. Write user documentation
   - Create `docs/features/warehouse-management.md`
   - Document how to view warehouse list
   - Document how to create a new warehouse (admin)
   - Document how to edit warehouse details (admin)
   - Document how to activate/deactivate warehouses (admin)
   - Include screenshots of key UI components
   - Explain warehouse types and statuses

7.6. Write admin guide
   - Create `docs/admin-guides/warehouse-setup.md`
   - Document initial warehouse configuration
   - Document best practices for warehouse codes
   - Document when to use each warehouse type
   - Document status management guidelines
   - Include troubleshooting section

7.7. Perform manual QA testing
   - Test as admin user: create, edit, view, list, activate/deactivate
   - Test as non-admin user: view list, view details, verify no edit access
   - Test search functionality with various inputs
   - Test filters (status, type)
   - Test pagination with different page sizes
   - Test form validation errors display correctly
   - Test responsive design on mobile, tablet, desktop
   - Test browser compatibility (Chrome, Firefox, Safari)

7.8. Performance testing
   - Test warehouse list page load time (<500ms target)
   - Test API response times (<200ms target)
   - Test with 50+ warehouses to verify pagination performance
   - Test search and filter performance with large dataset
   - Optimize any slow queries or components

7.9. Verify all acceptance criteria
   - Review spec requirements and confirm all are met
   - Verify all API endpoints work correctly
   - Verify database schema matches specification
   - Verify UI components match design requirements
   - Verify role-based access control works correctly
   - Verify seed data initializes correctly
   - Document any known limitations or future improvements

7.10. Fix any discovered issues
   - Address bugs found during testing
   - Fix performance issues
   - Improve error messages and user feedback
   - Refactor code for better maintainability
   - Update documentation if behavior changes

7.11. Final verification - all tests pass
   - Run complete test suite one final time
   - Verify 100% of tests pass
   - Verify no console errors or warnings
   - Verify test coverage meets targets
   - Commit all changes and prepare for code review

---

## Implementation Notes

### Dependencies Between Tasks
- Task 1 (Database) must complete before Tasks 2-7 can begin
- Tasks 2 (Validation) and 3 (Service) can run in parallel after Task 1
- Task 4 (API) depends on Tasks 2 and 3
- Task 5 (UI) depends on Task 4
- Task 6 (Seed) depends on Task 1 (can run parallel with other tasks)
- Task 7 (Testing) should run continuously but final verification depends on Tasks 1-6

### Test-Driven Development (TDD) Approach
Each major task follows TDD:
1. First subtask: Write tests (failing)
2. Middle subtasks: Implement functionality
3. Last subtask: Verify tests pass

### Code Quality Standards
- All TypeScript code must pass lint checks
- All code must be properly typed (no `any` types)
- All functions must have proper error handling
- All API responses must follow standard format
- All UI components must handle loading and error states

### Performance Targets
- Warehouse list page: <500ms load time
- API endpoints: <200ms response time
- Search and filters: Real-time with debounce (300ms)
- Form validation: Real-time feedback

### Security Considerations
- All API endpoints require authentication
- Write operations restricted to admins
- Input validation on both client and server
- SQL injection prevention via Prisma
- XSS prevention via React
- CSRF protection via Next.js

### Accessibility Requirements
- All forms must be keyboard navigable
- All interactive elements must have proper ARIA labels
- Error messages must be associated with form fields
- Status badges must have text alternatives
- Tables must have proper headers

### Browser Compatibility
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### Future Feature Preparation
This implementation prepares for:
- Stock Level Tracking (inventory relationship)
- Inter-warehouse Transfers (transfer relationships)
- Warehouse Analytics (activity logging)
- Capacity Planning (capacity fields)
- Geographic Optimization (location coordinates)
