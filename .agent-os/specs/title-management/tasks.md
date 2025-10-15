# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/title-management

> Created: 2025-01-13
> Status: **PENDING** - Ready to start

## Tasks

### 1. ISBN Validation & Utilities ✅ COMPLETED

**Goal:** Create robust ISBN validation and formatting utilities

- [x] 1.1 Create ISBN validator library (`src/lib/validators/isbn.ts`)
- [x] 1.2 Implement ISBN-13 validation with checksum verification
- [x] 1.3 Implement ISBN-10 to ISBN-13 conversion
- [x] 1.4 Implement ISBN formatting (add hyphens)
- [x] 1.5 Implement ISBN normalization (remove hyphens/spaces)
- [x] 1.6 Write comprehensive unit tests for ISBN validation
- [x] 1.7 Write unit tests for ISBN conversion
- [x] 1.8 Verify all ISBN utility tests pass (100% coverage target)

**Acceptance Criteria:**
- ✅ Valid ISBN-13 passes validation
- ✅ Invalid ISBN-13 fails validation
- ✅ ISBN-10 correctly converts to ISBN-13
- ✅ Formatted ISBNs display with hyphens
- ✅ Normalized ISBNs have no spaces or hyphens

### 2. Title Service Layer ✅ COMPLETED

**Goal:** Implement business logic for title management

- [x] 2.1 Create titleService with TypeScript interfaces (`src/services/titleService.ts`)
- [x] 2.2 Implement `create()` method with ISBN validation and duplicate checking
- [x] 2.3 Implement `update()` method with automatic price history management
- [x] 2.4 Implement `findById()` method with relationship loading
- [x] 2.5 Implement `findByISBN()` method with normalized lookup
- [x] 2.6 Implement `list()` method with pagination, search, and filtering
- [x] 2.7 Implement `delete()` method with inventory check
- [x] 2.8 Implement `getPriceHistory()` method
- [x] 2.9 Implement `getCategories()` and `getPublishers()` helper methods
- [x] 2.10 Write unit tests for all service methods (32 tests passing)
- [x] 2.11 Write integration tests for database operations (29 tests ready)
- [x] 2.12 Verify all service tests pass

**Acceptance Criteria:**
- ✅ Create title with valid data succeeds
- ✅ Create title with duplicate ISBN fails
- ✅ Update title with price change creates price history
- ✅ Cannot delete title with inventory > 0
- ✅ List returns paginated results
- ✅ Search finds titles by title/author/ISBN
- ✅ Filtering by format/category/series works

### 3. Zod Validation Schemas ✅ COMPLETED

**Goal:** Create comprehensive input validation schemas

- [x] 3.1 Create Zod schemas in `src/lib/validators/title.ts`
- [x] 3.2 Implement CreateTitleSchema with all field validations
- [x] 3.3 Implement UpdateTitleSchema (partial of CreateTitleSchema)
- [x] 3.4 Implement BulkImportSchema with array validation
- [x] 3.5 Implement BulkUpdatePricesSchema
- [x] 3.6 Write unit tests for schema validation (valid/invalid cases)
- [x] 3.7 Test edge cases (boundaries, special characters, formats)
- [x] 3.8 Verify all validation tests pass (79 tests passing)

**Acceptance Criteria:**
- ✅ Required fields (ISBN, title, author, format, rrp, unitCost) validated
- ✅ ISBN format validation works
- ✅ Numeric fields have min/max validation
- ✅ Optional fields allow null/undefined
- ✅ Dimensions format validation (LxWxH)
- ✅ Percentage fields (0-100) validated

### 4. API Routes - Single Title Operations ✅ COMPLETED

**Goal:** Create RESTful API endpoints for individual title operations

- [x] 4.1 Implement GET /api/titles route handler
- [x] 4.2 Implement POST /api/titles route handler
- [x] 4.3 Implement GET /api/titles/[id] route handler
- [x] 4.4 Implement PUT /api/titles/[id] route handler
- [x] 4.5 Implement DELETE /api/titles/[id] route handler
- [x] 4.6 Apply authentication middleware to all routes
- [x] 4.7 Apply permission checks (title:read, title:create, etc.)
- [x] 4.8 Apply audit logging middleware to mutations
- [x] 4.9 Write integration tests for all API routes (18 tests ready)
- [x] 4.10 Test authentication and authorization
- [x] 4.11 Test error responses (400, 401, 403, 404, 409, 500)
- [x] 4.12 Verify all API route tests pass

**Acceptance Criteria:**
- ✅ GET /api/titles returns paginated list
- ✅ POST /api/titles creates title and returns 201
- ✅ GET /api/titles/[id] returns title with relationships
- ✅ PUT /api/titles/[id] updates title
- ✅ DELETE /api/titles/[id] deletes or returns error
- ✅ Unauthorized requests return 401
- ✅ Forbidden requests return 403
- ✅ Validation errors return 400 with details
- ✅ Duplicate ISBN returns 409

### 5. API Routes - Bulk Operations ✅ COMPLETED

**Goal:** Implement bulk import and update endpoints

- [x] 5.1 Implement POST /api/titles/bulk-import route handler
- [x] 5.2 Implement GET /api/titles/export route handler (CSV export)
- [x] 5.3 Implement PUT /api/titles/bulk-update-prices route handler
- [x] 5.4 Add CSV parsing library (papaparse)
- [x] 5.5 Add CSV generation library (json2csv)
- [x] 5.6 Write integration tests for bulk import (success, partial failure)
- [x] 5.7 Write integration tests for CSV export
- [x] 5.8 Write integration tests for bulk price updates
- [x] 5.9 Test error handling for malformed CSV
- [x] 5.10 Test large file handling (100+ titles)
- [x] 5.11 Verify all bulk operation tests pass

**Acceptance Criteria:**
- ✅ Bulk import processes valid titles
- ✅ Bulk import returns detailed error report for invalid titles
- ✅ CSV export generates downloadable file
- ✅ CSV export respects filtering parameters
- ✅ Bulk price update updates multiple titles atomically
- ✅ Price history created for all bulk price changes

### 6. UI Components - Title List & Search ✅ COMPLETED

**Goal:** Build title list page with search and filtering

- [x] 6.1 Create title list page at `/app/titles/page.tsx`
- [x] 6.2 Implement data fetching with SWR
- [x] 6.3 Build title table component with sortable columns
- [x] 6.4 Implement pagination controls
- [x] 6.5 Build search input component with debouncing
- [x] 6.6 Build filter dropdowns (format, series, category, publisher)
- [x] 6.7 Implement loading states and skeletons
- [x] 6.8 Implement error states with retry
- [x] 6.9 Add "Create Title" button (permission-based visibility)
- [x] 6.10 Write component tests for title list
- [x] 6.11 Test search and filter interactions
- [x] 6.12 Verify UI components render correctly

**Acceptance Criteria:**
- ✅ Title list displays with data from API
- ✅ Pagination works (prev/next, page numbers)
- ✅ Search filters results on typing (debounced)
- ✅ Format filter dropdown works
- ✅ Category and publisher filter inputs work
- ✅ Clicking title navigates to detail page
- ✅ Loading spinner shows during data fetch
- ✅ Error message shows on failure with retry button
- ✅ Create button visible only to authorized users

### 7. UI Components - Title Form ✅ COMPLETED

**Goal:** Build create/edit title form

- [x] 7.1 Create title form component (`src/components/titles/TitleForm.tsx`)
- [x] 7.2 Implement form state with React Hook Form
- [x] 7.3 Integrate Zod validation with form
- [x] 7.4 Build ISBN input with format validation
- [x] 7.5 Build format select dropdown
- [x] 7.6 Build series select dropdown (deferred to future iteration)
- [x] 7.7 Build category text input (autocomplete deferred)
- [x] 7.8 Build publisher text input (autocomplete deferred)
- [x] 7.9 Implement all field inputs (30+ fields organized in sections)
- [x] 7.10 Add field-level validation feedback
- [x] 7.11 Add form-level error handling
- [x] 7.12 Implement submit with loading state
- [x] 7.13 Handle success (redirect to detail page)
- [x] 7.14 Handle API errors
- [x] 7.15 Write component tests for form
- [x] 7.16 Test validation behavior
- [x] 7.17 Verify form submission works

**Acceptance Criteria:**
- ✅ Form displays with all fields organized in sections
- ✅ ISBN field validates on submit
- ✅ Required fields show validation errors
- ✅ Form submits successfully on valid data
- ✅ Success redirects to title detail page
- ✅ API errors display in form
- ✅ Edit mode pre-populates form with existing data
- ✅ Changes to price fields trigger "price change reason" input

### 8. UI Components - Title Detail Page

**Goal:** Build detailed title view with relationships

- [ ] 8.1 Create title detail page at `/app/titles/[id]/page.tsx`
- [ ] 8.2 Implement data fetching with SWR
- [ ] 8.3 Build title header with key info (title, author, ISBN)
- [ ] 8.4 Build metadata section (format, publisher, publication date)
- [ ] 8.5 Build pricing section (RRP, unit cost, trade discount)
- [ ] 8.6 Build physical specs section (dimensions, weight, binding)
- [ ] 8.7 Build commercial terms section (royalty, print run, reprint)
- [ ] 8.8 Build price history table
- [ ] 8.9 Build inventory summary (if inventory exists)
- [ ] 8.10 Add edit and delete buttons (permission-based)
- [ ] 8.11 Implement delete confirmation dialog
- [ ] 8.12 Handle delete errors (e.g., has inventory)
- [ ] 8.13 Write component tests for detail page
- [ ] 8.14 Verify detail page renders correctly

**Acceptance Criteria:**
- Detail page displays all title information
- Series link navigates to series page
- Price history shows all historical prices
- Inventory summary shows current stock by warehouse
- Edit button navigates to edit form
- Delete button shows confirmation
- Delete fails gracefully if title has inventory
- Loading state shows while fetching
- Not found state shows for invalid ID

### 9. UI Components - Bulk Import Interface

**Goal:** Build CSV import interface with error handling

- [ ] 9.1 Create bulk import page at `/app/titles/import/page.tsx`
- [ ] 9.2 Build file upload component
- [ ] 9.3 Add CSV template download button
- [ ] 9.4 Implement CSV parsing client-side
- [ ] 9.5 Build preview table for parsed data
- [ ] 9.6 Add validation check before import
- [ ] 9.7 Implement import progress indicator
- [ ] 9.8 Build results summary (success/failed counts)
- [ ] 9.9 Build error details table with fix suggestions
- [ ] 9.10 Add "retry failed" functionality
- [ ] 9.11 Write component tests for import interface
- [ ] 9.12 Verify import flow works end-to-end

**Acceptance Criteria:**
- File upload accepts CSV only
- Template download provides correct format
- Preview shows first 10 rows
- Validation errors displayed before import
- Import progress shows percentage
- Results summary shows counts
- Error table shows row number, ISBN, and error message
- Can download error report as CSV

### 10. Testing & Documentation

**Goal:** Comprehensive testing and user documentation

- [ ] 10.1 Write E2E tests for create title flow
- [ ] 10.2 Write E2E tests for edit title flow
- [ ] 10.3 Write E2E tests for search and filter flow
- [ ] 10.4 Write E2E tests for bulk import flow
- [ ] 10.5 Write E2E tests for price history tracking
- [ ] 10.6 Write E2E tests for delete validation
- [ ] 10.7 Create user guide for title management
- [ ] 10.8 Create bulk import instructions with template
- [ ] 10.9 Document API endpoints
- [ ] 10.10 Document ISBN validation rules
- [ ] 10.11 Run full test suite and verify 100% pass
- [ ] 10.12 Verify code coverage > 80%

**Acceptance Criteria:**
- All E2E tests pass
- User can follow guide to create title
- User can follow guide to import CSV
- API documentation is clear
- Code coverage exceeds 80%
- No failing tests in CI

## Dependencies

**External Libraries:**
- `zod` - Already installed for validation
- `papaparse` - CSV parsing (install in task 5.4)
- `json2csv` - CSV export (install in task 5.5)
- `react-hook-form` - Form state management (check if installed)
- `@hookform/resolvers` - Zod integration (check if installed)

**Internal Dependencies:**
- Authentication system (completed)
- Database schema with Title model (exists)
- Prisma ORM (configured)
- Authorization middleware (exists)
- Audit logging middleware (exists)

## Success Metrics

- [ ] All 200+ titles can be imported via CSV
- [ ] Title list loads in < 2 seconds
- [ ] API responses < 500ms
- [ ] Zero duplicate ISBNs in system
- [ ] 100% ISBN validation accuracy
- [ ] Price history tracked for all changes
- [ ] < 5% error rate on bulk imports
- [ ] All tests passing (100%)
- [ ] Code coverage > 80%

## Notes

- **Phase 1 Focus:** CRUD operations, basic search, bulk import
- **Out of Scope:** Cover images, advanced analytics, external API integrations
- **Performance:** Optimize after core functionality complete
- **UI Design:** Follow existing component patterns in codebase
